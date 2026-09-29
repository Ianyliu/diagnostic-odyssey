linked_condition_service_use_families <- function() {
  c("office", "outpatient", "emergency", "inpatient")
}

derive_u09_person_service_use <- function(hc256, footprint) {
  if (!is.data.frame(hc256) || !"DUPERSID" %in% names(hc256)) {
    stop("Candidate service-use attachment requires an HC-256 person frame with DUPERSID.", call. = FALSE)
  }
  if (anyDuplicated(as.character(hc256$DUPERSID))) {
    stop("Candidate service-use attachment requires one HC-256 row per DUPERSID.", call. = FALSE)
  }

  required_reviewed <- c("do_u09_linked_event_n", "do_has_u09_linked_event")
  missing_reviewed <- setdiff(required_reviewed, names(hc256))
  if (length(missing_reviewed)) {
    stop(
      "Candidate service-use attachment requires reviewed post-collapse fields: ",
      paste(missing_reviewed, collapse = ", "),
      ". Run collapse_u09_to_hc256() first.",
      call. = FALSE
    )
  }

  events <- footprint$unique_u09_events
  required_event_fields <- c("DUPERSID", "EVNTIDX", "event_family")
  if (!is.data.frame(events)) {
    stop("Candidate service-use attachment requires footprint$unique_u09_events.", call. = FALSE)
  }
  missing_event_fields <- setdiff(required_event_fields, names(events))
  if (length(missing_event_fields)) {
    stop(
      "Candidate service-use event footprint is missing: ",
      paste(missing_event_fields, collapse = ", "),
      call. = FALSE
    )
  }

  if (nrow(events)) {
    event_key <- paste(as.character(events$DUPERSID), as.character(events$EVNTIDX), sep = "::")
    if (anyDuplicated(event_key)) {
      stop("Candidate service-use footprint contains duplicate distinct encounter keys.", call. = FALSE)
    }
    family <- as.character(events$event_family)
    allowed <- linked_condition_service_use_families()
    if (any(is.na(family) | !(family %in% allowed))) {
      stop("Candidate service-use footprint contains a non-D/E/F/G event family.", call. = FALSE)
    }
  }

  original_names <- names(hc256)
  out <- hc256
  person_ids <- as.character(out$DUPERSID)
  family_fields <- c(
    office = "do_u09_linked_office_event_n",
    outpatient = "do_u09_linked_outpatient_event_n",
    emergency = "do_u09_linked_emergency_event_n",
    inpatient = "do_u09_linked_inpatient_event_n"
  )

  for (family in names(family_fields)) {
    family_events <- events[as.character(events$event_family) == family, , drop = FALSE]
    counts <- table(as.character(family_events$DUPERSID))
    values <- as.integer(counts[person_ids])
    values[is.na(values)] <- 0L
    out[[family_fields[[family]]]] <- values
  }

  family_total <- Reduce(
    `+`,
    lapply(unname(family_fields), function(field) as.integer(out[[field]]))
  )
  reviewed_total <- as.integer(out$do_u09_linked_event_n)
  if (any(is.na(reviewed_total)) || any(reviewed_total < 0L)) {
    stop("Reviewed do_u09_linked_event_n must contain nonnegative integer-like values.", call. = FALSE)
  }
  if (!identical(family_total, reviewed_total)) {
    bad <- which(family_total != reviewed_total)
    stop(
      "Candidate family counts do not reconcile to reviewed distinct-event totals",
      if (length(bad)) paste0(" (first mismatch DUPERSID=", person_ids[[bad[[1]]]], ")") else "",
      ".",
      call. = FALSE
    )
  }
  if (!identical(as.logical(out$do_has_u09_linked_event), reviewed_total > 0L)) {
    stop("Reviewed U09-linked-event indicator does not reconcile to reviewed event counts.", call. = FALSE)
  }

  if (!identical(names(out)[seq_along(original_names)], original_names)) {
    stop("Candidate service-use attachment altered original column order.", call. = FALSE)
  }
  out
}
