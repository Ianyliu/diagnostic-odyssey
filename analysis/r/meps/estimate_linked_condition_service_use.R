linked_condition_candidate_source_refs <- function() {
  c(
    "meps-hc256-2024",
    "meps-hc255-2024",
    "meps-hc254i-2024",
    "meps-hc254g-2024",
    "meps-hc254f-2024",
    "meps-hc254e-2024",
    "meps-hc254d-2024"
  )
}

linked_condition_target_support <- function(data, mask, label) {
  survey_representation_support(data, mask, label)
}

assert_linked_condition_candidate_design_integrity <- function(combined, person_design) {
  governed_target <- build_linked_condition_target(combined)
  target_data <- combined[governed_target, , drop = FALSE]

  target_missing_varstr_n <- sum(is.na(target_data$VARSTR))
  target_missing_varpsu_n <- sum(is.na(target_data$VARPSU))
  target_bad_weight_n <- sum(
    is.na(suppressWarnings(as.numeric(target_data$PERWT24F))) |
      suppressWarnings(as.numeric(target_data$PERWT24F)) <= 0
  )

  if (target_missing_varstr_n != 0L) {
    stop("Governed linked-condition target contains missing VARSTR; refusing candidate estimation.", call. = FALSE)
  }
  if (target_missing_varpsu_n != 0L) {
    stop("Governed linked-condition target contains missing VARPSU; refusing candidate estimation.", call. = FALSE)
  }
  if (target_bad_weight_n != 0L) {
    stop("Governed linked-condition target contains missing/nonpositive PERWT24F; refusing candidate estimation.", call. = FALSE)
  }

  design_ids <- as.character(person_design$variables$DUPERSID)
  target_ids <- as.character(target_data$DUPERSID)
  excluded_target_ids <- setdiff(target_ids, design_ids)
  if (length(excluded_target_ids)) {
    stop(
      "Full PERSON survey design silently excluded governed target members; first missing DUPERSID=",
      excluded_target_ids[[1]], ".",
      call. = FALSE
    )
  }

  domain <- current_long_covid_domain(person_design)
  domain_ids <- as.character(domain$variables$DUPERSID)
  if (!identical(sort(target_ids), sort(domain_ids))) {
    stop("PERSON survey-domain membership does not equal governed linked-condition target membership.", call. = FALSE)
  }

  list(
    governed_target = governed_target,
    target_missing_varstr_n = as.integer(target_missing_varstr_n),
    target_missing_varpsu_n = as.integer(target_missing_varpsu_n),
    target_missing_or_nonpositive_perwt24f_n = as.integer(target_bad_weight_n),
    target_excluded_from_full_person_design_n = as.integer(length(excluded_target_ids)),
    target_domain_membership_exact = TRUE
  )
}

linked_condition_candidate_metadata <- function(
  candidate_id,
  label,
  unit,
  result,
  domain,
  value_variable,
  observed_event_variable,
  ci_df_source = "full PERSON / PERWT24F survey design"
) {
  values <- as.numeric(domain$variables[[value_variable]])
  observed_values <- as.numeric(domain$variables[[observed_event_variable]])
  nonzero <- !is.na(values) & values > 0
  target_mask <- rep(TRUE, nrow(domain$variables))

  list(
    candidate_id = candidate_id,
    label = label,
    unit = unit,
    value = unname(result$value),
    standard_error = unname(result$standard_error),
    interval_low = unname(result$interval_low),
    interval_high = unname(result$interval_high),
    interval_type = result$interval_type,
    unweighted_target_n = as.integer(result$unweighted_n),
    unweighted_nonzero_person_n = as.integer(sum(nonzero)),
    observed_qualifying_event_n = as.integer(sum(observed_values, na.rm = TRUE)),
    weighted_denominator = unname(result$weighted_denominator),
    ci_degrees_of_freedom = unname(result$ci_degrees_of_freedom),
    ci_df_source = ci_df_source,
    target_support = linked_condition_target_support(
      domain$variables, target_mask, paste(candidate_id, "target domain")
    ),
    nonzero_support = linked_condition_target_support(
      domain$variables, nonzero, paste(candidate_id, "nonzero-person support")
    ),
    relative_standard_error = if (
      !is.null(result$relative_standard_error) &&
        length(result$relative_standard_error) == 1L &&
        is.finite(result$relative_standard_error)
    ) unname(result$relative_standard_error) else NULL,
    interval_width = if (
      !is.null(result$interval_width) &&
        length(result$interval_width) == 1L &&
        is.finite(result$interval_width)
    ) unname(result$interval_width) else NULL,
    allowed_interpretation = paste(
      "Descriptive annual documented exact-U09-linked D/E/F/G service-use footprint",
      "among adults in the governed HC-256 operational-current Long-COVID target."
    ),
    prohibited_interpretation = as.list(c(
      "Long-COVID prevalence",
      "diagnostic recognition rate",
      "referral rate",
      "diagnostic delay",
      "attributable utilization",
      "spending attribution",
      "causal effect"
    )),
    limitations = as.list(c(
      "U09 is not equivalent to the governed operational-current Long-COVID target.",
      "Absence of exact U09 is not evidence of absence of Long COVID.",
      "Absence of a qualifying U09-linked encounter is not evidence of absence of healthcare.",
      "Annual D/E/F/G events may occur before or after the Round 3/1 point-in-time current-status anchor.",
      "U09-linked encounters may also carry non-U09 condition links and are not uniquely attributable to Long COVID.",
      "Sampling precision is adjudicated after estimation under meps_hc_precision_v1; product release remains separately unauthorized."
    )),
    weight_variable = "PERWT24F",
    variance_stratum_variable = "VARSTR",
    variance_psu_variable = "VARPSU",
    cohort_definition = cohort_definition_text(),
    statistics_method = result$interval_type,
    source_refs = as.list(linked_condition_candidate_source_refs())
  )
}

estimate_linked_condition_service_use <- function(person_design) {
  required <- c(
    "DUPERSID",
    "do_age_18_64",
    "do_current_long_covid",
    "do_has_u09_linked_event",
    "do_u09_linked_event_n",
    "do_u09_linked_office_event_n",
    "do_u09_linked_outpatient_event_n",
    "do_u09_linked_emergency_event_n",
    "do_u09_linked_inpatient_event_n"
  )
  missing <- setdiff(required, names(person_design$variables))
  if (length(missing)) {
    stop("Linked-condition candidate design missing fields: ", paste(missing, collapse = ", "), call. = FALSE)
  }

  domain <- current_long_covid_domain(person_design)
  ci_source <- "full PERSON / PERWT24F survey design"

  proportion <- survey_proportion_result(
    domain,
    "do_has_u09_linked_event",
    function(x) as.numeric(as.logical(x)),
    person_design,
    ci_source
  )

  make_mean <- function(field) {
    survey_mean_result(
      domain,
      field,
      function(x) as.numeric(x),
      person_design,
      ci_source
    )
  }

  total_mean <- make_mean("do_u09_linked_event_n")
  family_fields <- c(
    office = "do_u09_linked_office_event_n",
    outpatient = "do_u09_linked_outpatient_event_n",
    emergency = "do_u09_linked_emergency_event_n",
    inpatient = "do_u09_linked_inpatient_event_n"
  )

  candidates <- list(
    linked_condition_candidate_metadata(
      "u09_linked_service_use_person_share",
      "Share with documented exact-U09-linked service use",
      "proportion",
      proportion,
      domain,
      "do_has_u09_linked_event",
      "do_u09_linked_event_n"
    ),
    linked_condition_candidate_metadata(
      "u09_linked_service_use_encounters_mean",
      "Mean documented exact-U09-linked encounters per target person",
      "encounters/person/year",
      total_mean,
      domain,
      "do_u09_linked_event_n",
      "do_u09_linked_event_n"
    )
  )

  for (family in names(family_fields)) {
    field <- family_fields[[family]]
    result <- make_mean(field)
    candidate <- linked_condition_candidate_metadata(
      paste0("u09_linked_service_use_", family, "_encounters_mean"),
      paste("Mean documented exact-U09-linked", family, "encounters per target person"),
      "encounters/person/year",
      result,
      domain,
      field,
      field
    )
    if (family == "emergency") {
      candidate$limitations <- c(
        candidate$limitations,
        list("The reviewed feasibility artifact observed only two qualifying emergency encounters; substantive interpretation is not authorized without later methods review.")
      )
    }
    if (family == "inpatient") {
      candidate$limitations <- c(
        candidate$limitations,
        list("The reviewed feasibility artifact observed zero qualifying inpatient encounters; a numerical 0 with zero estimated sampling variance must not be interpreted as proof of a population zero.")
      )
    }
    candidates[[length(candidates) + 1L]] <- candidate
  }

  names(candidates) <- vapply(candidates, function(x) x$candidate_id, character(1))
  candidates
}
