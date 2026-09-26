linked_condition_source_config_path <- function() {
  repo_path("analysis", "r", "config", "meps_linked_condition_sources.json")
}

read_linked_condition_source_config <- function(path = linked_condition_source_config_path()) {
  if (!requireNamespace("jsonlite", quietly = TRUE)) {
    stop("Package 'jsonlite' is required.", call. = FALSE)
  }
  cfg <- jsonlite::fromJSON(path, simplifyVector = FALSE)
  if (!identical(cfg$status, "feasibility-only")) {
    stop("Linked-condition source registry must remain feasibility-only in Phase A.", call. = FALSE)
  }
  cfg
}

assert_linked_condition_source_pins <- function(cfg = read_linked_condition_source_config()) {
  new_sources <- Filter(function(x) !identical(x$puf_id, "HC-256"), cfg$sources)
  unpinned <- vapply(
    new_sources,
    function(x) {
      zip_hash <- if (is.null(x$expected_zip_sha256)) "" else x$expected_zip_sha256
      dta_hash <- if (is.null(x$expected_extracted_dta_sha256)) "" else x$expected_extracted_dta_sha256
      !grepl("^[0-9a-fA-F]{64}$", zip_hash) ||
        !grepl("^[0-9a-fA-F]{64}$", dta_hash)
    },
    logical(1)
  )
  if (any(unpinned)) {
    stop(
      "Linked-condition source hashes are not fully pinned from verified official bytes: ",
      paste(vapply(new_sources[unpinned], function(x) x$puf_id, character(1)), collapse = ", "),
      ". Refusing real-data acquisition.",
      call. = FALSE
    )
  }
  invisible(TRUE)
}

validate_required_variables <- function(data, source) {
  names_upper <- toupper(names(data))
  required <- toupper(unlist(source$required_variables, use.names = FALSE))
  missing <- setdiff(required, names_upper)
  if (length(missing)) {
    stop(
      source$puf_id, " required-variable contract failed; missing: ",
      paste(missing, collapse = ", "),
      call. = FALSE
    )
  }
  invisible(TRUE)
}

normalize_meps_names <- function(data) {
  names(data) <- toupper(names(data))
  data
}

canonical_event_family <- function(eventype) {
  map <- c("1" = "office", "2" = "outpatient", "3" = "emergency", "4" = "inpatient")
  out <- unname(map[as.character(eventype)])
  as.character(out)
}

validate_condition_table <- function(conditions) {
  required <- c("DUPERSID", "CONDN", "CONDIDX", "ICD10CDX")
  missing <- setdiff(required, names(conditions))
  if (length(missing)) stop("HC-255 validation missing: ", paste(missing, collapse = ", "), call. = FALSE)

  if (anyDuplicated(as.character(conditions$CONDIDX))) {
    dup <- unique(as.character(conditions$CONDIDX)[duplicated(as.character(conditions$CONDIDX))])
    stop("HC-255 CONDIDX must map to exactly one condition record; duplicate: ", dup[[1]], call. = FALSE)
  }
  prefix <- substr(as.character(conditions$CONDIDX), 1, nchar(as.character(conditions$DUPERSID)))
  bad <- which(prefix != as.character(conditions$DUPERSID))
  if (length(bad)) stop("HC-255 CONDIDX is not person-consistent with DUPERSID.", call. = FALSE)
  invisible(TRUE)
}

validate_link_table <- function(links) {
  required <- c("DUPERSID", "CONDIDX", "EVNTIDX", "CLNKIDX", "EVENTYPE")
  missing <- setdiff(required, names(links))
  if (length(missing)) stop("HC-254I validation missing: ", paste(missing, collapse = ", "), call. = FALSE)

  clnk <- as.character(links$CLNKIDX)
  pair_key <- paste(as.character(links$CONDIDX), as.character(links$EVNTIDX), sep = "::")
  duplicate_clnk <- duplicated(clnk) | duplicated(clnk, fromLast = TRUE)
  duplicate_pair <- duplicated(pair_key) | duplicated(pair_key, fromLast = TRUE)
  expected_clnk <- paste0(as.character(links$CONDIDX), as.character(links$EVNTIDX))
  clnk_composition_mismatch <- !is.na(clnk) & clnk != expected_clnk

  supported <- as.character(links$EVENTYPE) %in% c("1", "2", "3", "4")
  excluded <- as.character(links$EVENTYPE) %in% c("7", "8")
  unsupported <- !(supported | excluded)

  list(
    duplicate_clnkidx_n = sum(duplicate_clnk),
    duplicate_clnkidx_values = unique(as.character(links$CLNKIDX[duplicate_clnk])),
    duplicate_condition_event_pair_n = sum(duplicate_pair),
    clnkidx_composition_mismatch_n = sum(clnk_composition_mismatch),
    unsupported_eventype_n = sum(unsupported),
    unsupported_eventype_values = sort(unique(as.character(links$EVENTYPE[unsupported])))
  )
}

select_u09_conditions <- function(conditions) {
  code <- toupper(trimws(as.character(conditions$ICD10CDX)))
  conditions[!is.na(code) & code == "U09", , drop = FALSE]
}

build_event_index <- function(event_files) {
  expected <- c(office = "1", outpatient = "2", emergency = "3", inpatient = "4")
  pieces <- lapply(names(expected), function(family) {
    x <- event_files[[family]]
    if (is.null(x)) stop("Missing event family: ", family, call. = FALSE)
    x <- normalize_meps_names(x)
    req <- c("DUPERSID", "EVNTIDX")
    miss <- setdiff(req, names(x))
    if (length(miss)) stop(family, " event file missing: ", paste(miss, collapse = ", "), call. = FALSE)
    data.frame(
      DUPERSID = as.character(x$DUPERSID),
      EVNTIDX = as.character(x$EVNTIDX),
      event_family = rep(family, nrow(x)),
      EVENTYPE = rep(expected[[family]], nrow(x)),
      stringsAsFactors = FALSE
    )
  })
  out <- do.call(rbind, pieces)
  rownames(out) <- NULL
  if (anyDuplicated(paste(out$DUPERSID, out$EVNTIDX, sep = "::"))) {
    stop("Event files contain duplicate DUPERSID × EVNTIDX keys.", call. = FALSE)
  }
  out
}

validate_linkage_invariants <- function(conditions, links, event_files) {
  conditions <- normalize_meps_names(conditions)
  links <- normalize_meps_names(links)
  validate_condition_table(conditions)
  link_diag <- validate_link_table(links)
  event_index <- build_event_index(event_files)

  cond_person <- setNames(as.character(conditions$DUPERSID), as.character(conditions$CONDIDX))
  cond_match <- unname(cond_person[as.character(links$CONDIDX)])
  unmatched_cond <- is.na(cond_match)
  cond_person_mismatch <- !unmatched_cond & cond_match != as.character(links$DUPERSID)

  event_key <- paste(event_index$DUPERSID, event_index$EVNTIDX, sep = "::")
  link_key <- paste(as.character(links$DUPERSID), as.character(links$EVNTIDX), sep = "::")
  event_match <- match(link_key, event_key)
  expected_family <- canonical_event_family(links$EVENTYPE)
  actual_family <- ifelse(is.na(event_match), NA_character_, event_index$event_family[event_match])
  supported <- as.character(links$EVENTYPE) %in% c("1", "2", "3", "4")
  unmatched_event <- supported & is.na(event_match)
  event_family_mismatch <- supported & !is.na(event_match) & expected_family != actual_family

  list(
    unmatched_condidx_n = sum(unmatched_cond),
    condidx_person_mismatch_n = sum(cond_person_mismatch),
    unmatched_evntidx_n = sum(unmatched_event),
    event_family_mismatch_n = sum(event_family_mismatch),
    duplicate_clnkidx_n = link_diag$duplicate_clnkidx_n,
    duplicate_condition_event_pair_n = link_diag$duplicate_condition_event_pair_n,
    clnkidx_composition_mismatch_n = link_diag$clnkidx_composition_mismatch_n,
    unsupported_eventype_n = link_diag$unsupported_eventype_n,
    unsupported_eventype_values = link_diag$unsupported_eventype_values
  )
}

derive_u09_event_footprint <- function(conditions, links, event_files) {
  conditions <- normalize_meps_names(conditions)
  links <- normalize_meps_names(links)
  validate_condition_table(conditions)
  event_index <- build_event_index(event_files)

  u09 <- select_u09_conditions(conditions)
  u09_ids <- unique(as.character(u09$CONDIDX))
  u09_condition_person <- setNames(
    as.character(u09$DUPERSID),
    as.character(u09$CONDIDX)
  )

  # Preserve all links whose condition resolves to exact U09 so excluded or bad
  # links remain visible for feasibility diagnostics. Only EVENTYPE 1-4 links
  # are eligible to proceed to event reconciliation.
  u09_raw_links <- links[
    as.character(links$CONDIDX) %in% u09_ids,
    ,
    drop = FALSE
  ]
  supported <- as.character(u09_raw_links$EVENTYPE) %in% c("1", "2", "3", "4")
  u09_supported_links <- u09_raw_links[supported, , drop = FALSE]

  if (nrow(u09_supported_links)) {
    condition_person <- unname(
      u09_condition_person[as.character(u09_supported_links$CONDIDX)]
    )
    condition_person_matches <-
      !is.na(condition_person) &
      condition_person == as.character(u09_supported_links$DUPERSID)

    event_key <- paste(
      event_index$DUPERSID,
      event_index$EVNTIDX,
      sep = "::"
    )
    link_event_key <- paste(
      as.character(u09_supported_links$DUPERSID),
      as.character(u09_supported_links$EVNTIDX),
      sep = "::"
    )
    event_match <- match(link_event_key, event_key)
    event_exists <- !is.na(event_match)
    expected_family <- canonical_event_family(u09_supported_links$EVENTYPE)
    actual_family <- ifelse(
      event_exists,
      event_index$event_family[event_match],
      NA_character_
    )
    event_family_matches <-
      event_exists &
      !is.na(expected_family) &
      expected_family == actual_family

    reconciled <- condition_person_matches & event_exists & event_family_matches
    u09_reconciled_links <- u09_supported_links[reconciled, , drop = FALSE]
  } else {
    u09_reconciled_links <- u09_supported_links
  }

  if (nrow(u09_reconciled_links)) {
    key <- paste(
      as.character(u09_reconciled_links$DUPERSID),
      as.character(u09_reconciled_links$EVNTIDX),
      sep = "::"
    )
    first <- !duplicated(key)
    unique_events <- data.frame(
      DUPERSID = as.character(u09_reconciled_links$DUPERSID[first]),
      EVNTIDX = as.character(u09_reconciled_links$EVNTIDX[first]),
      event_family = canonical_event_family(u09_reconciled_links$EVENTYPE[first]),
      stringsAsFactors = FALSE
    )
  } else {
    unique_events <- data.frame(
      DUPERSID = character(),
      EVNTIDX = character(),
      event_family = character(),
      stringsAsFactors = FALSE
    )
  }

  # Condition presence is independent of whether any qualifying Phase-A event
  # reconciles. This preserves U09-positive persons with zero valid D/E/F/G
  # encounter links.
  cond_by_person <- table(as.character(u09$DUPERSID))
  event_by_person <- table(unique_events$DUPERSID)
  persons <- union(names(cond_by_person), names(event_by_person))
  per_person <- data.frame(
    DUPERSID = persons,
    u09_condition_n = as.integer(cond_by_person[persons]),
    u09_event_n = as.integer(event_by_person[persons]),
    stringsAsFactors = FALSE
  )
  per_person$u09_condition_n[is.na(per_person$u09_condition_n)] <- 0L
  per_person$u09_event_n[is.na(per_person$u09_event_n)] <- 0L

  list(
    u09_conditions = u09,
    u09_raw_links = u09_raw_links,
    u09_supported_links = u09_supported_links,
    u09_reconciled_links = u09_reconciled_links,
    unique_u09_events = unique_events,
    per_person = per_person
  )
}

collapse_u09_to_hc256 <- function(hc256, footprint) {
  hc256 <- normalize_meps_names(hc256)
  if (!"DUPERSID" %in% names(hc256)) stop("HC-256 requires DUPERSID.", call. = FALSE)

  per <- footprint$per_person
  idx <- match(as.character(hc256$DUPERSID), as.character(per$DUPERSID))
  hc256$do_u09_condition_n <- ifelse(is.na(idx), 0L, per$u09_condition_n[idx])
  hc256$do_u09_linked_event_n <- ifelse(is.na(idx), 0L, per$u09_event_n[idx])
  hc256$do_has_u09_condition <- hc256$do_u09_condition_n > 0L
  hc256$do_has_u09_linked_event <- hc256$do_u09_linked_event_n > 0L
  hc256
}

linked_condition_guardrails <- function() {
  c(
    "HC-255 U09 frequency is not Long COVID prevalence.",
    "A U09-linked event is not an event caused by Long COVID.",
    "Absence of U09 linkage is not absence of Long COVID.",
    "Absence of U09 linkage is not absence of healthcare.",
    "U09 is not equivalent to the HC-256 operational-current Long COVID cohort.",
    "Condition-event link rows are not encounter counts.",
    "Linked expenditures cannot be naively summed and Phase A has no spending estimator.",
    "No arbitrary spending allocation across diagnoses is permitted.",
    "No diagnostic-delay, referral, or provider-recognition-rate claim is permitted.",
    "Annual events can precede or follow the point-in-time HC-256 current-status anchor.",
    "Home health and prescribed medicines are excluded from the initial encounter denominator.",
    "Final survey-design semantics remain person based."
  )
}
