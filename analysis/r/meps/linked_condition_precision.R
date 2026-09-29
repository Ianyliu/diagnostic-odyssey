# Pure deterministic precision adjudication for Issue #57 candidate records.

linked_condition_precision_rule_version <- function() {
  "meps_hc_precision_v1"
}

linked_condition_precision_statuses <- function() {
  c(
    "meps_precise",
    "meps_questionable_precision",
    "meps_low_percentage_exception",
    "meps_unstable_precision",
    "insufficient_sample",
    "unsupported_zero",
    "review_required"
  )
}

linked_condition_precision_reporting_statuses <- function() {
  c(
    "reportable",
    "reportable_with_caution",
    "suppress_precision",
    "suppress_insufficient_sample",
    "suppress_unsupported_zero",
    "suppress_pending_review"
  )
}

linked_condition_precision_reason_code_vocabulary <- function() {
  c(
    "sample_n_below_60",
    "rse_30_to_50",
    "rse_above_50",
    "low_percentage_exception",
    "zero_positive_support",
    "precision_input_invalid"
  )
}

linked_condition_precision_reason_codes <- function(x) {
  vocabulary <- linked_condition_precision_reason_code_vocabulary()
  vocabulary[vocabulary %in% unique(as.character(x))]
}

linked_condition_precision_scalar_number <- function(x) {
  is.numeric(x) && length(x) == 1L && !is.na(x) && is.finite(x)
}

linked_condition_precision_nonnegative_integer <- function(x) {
  linked_condition_precision_scalar_number(x) &&
    x >= 0 &&
    x == floor(x)
}

adjudicate_linked_condition_precision <- function(candidate) {
  reasons <- character()
  invalid <- !is.list(candidate)

  get_field <- function(name) {
    if (!is.list(candidate)) return(NULL)
    candidate[[name]]
  }

  unit <- get_field("unit")
  target_n <- get_field("unweighted_target_n")
  value <- get_field("value")
  standard_error <- get_field("standard_error")
  interval_high <- get_field("interval_high")
  rse <- get_field("relative_standard_error")
  nonzero_n <- get_field("unweighted_nonzero_person_n")
  event_n <- get_field("observed_qualifying_event_n")

  unit_valid <- is.character(unit) &&
    length(unit) == 1L &&
    unit %in% c("proportion", "encounters/person/year")
  target_n_valid <- linked_condition_precision_nonnegative_integer(target_n)
  value_valid <- linked_condition_precision_scalar_number(value) && value >= 0
  if (isTRUE(unit == "proportion") && value_valid && value > 1) value_valid <- FALSE
  se_valid <- linked_condition_precision_scalar_number(standard_error) && standard_error >= 0
  interval_high_valid <- linked_condition_precision_scalar_number(interval_high)
  nonzero_n_valid <- linked_condition_precision_nonnegative_integer(nonzero_n)
  event_n_valid <- linked_condition_precision_nonnegative_integer(event_n)
  rse_valid <- is.null(rse) ||
    (linked_condition_precision_scalar_number(rse) && rse >= 0)

  if (target_n_valid && target_n < 60) {
    reasons <- c(reasons, "sample_n_below_60")
  }

  invalid <- invalid ||
    !unit_valid ||
    !target_n_valid ||
    !value_valid ||
    !se_valid ||
    !interval_high_valid ||
    !nonzero_n_valid ||
    !event_n_valid ||
    !rse_valid

  if (
    target_n_valid &&
    nonzero_n_valid &&
    nonzero_n > target_n
  ) {
    invalid <- TRUE
  }

  if (
    value_valid &&
    interval_high_valid &&
    interval_high < value
  ) {
    invalid <- TRUE
  }

  support_consistent <- nonzero_n_valid &&
    event_n_valid &&
    ((nonzero_n == 0 && event_n == 0) || (nonzero_n > 0 && event_n > 0))
  if (nonzero_n_valid && event_n_valid && !support_consistent) {
    invalid <- TRUE
  }

  exact_zero_support <- value_valid &&
    se_valid &&
    rse_valid &&
    nonzero_n_valid &&
    event_n_valid &&
    value == 0 &&
    standard_error == 0 &&
    is.null(rse) &&
    nonzero_n == 0 &&
    event_n == 0

  if (exact_zero_support) {
    reasons <- c(reasons, "zero_positive_support")
  }

  if (
    nonzero_n_valid &&
    event_n_valid &&
    nonzero_n == 0 &&
    event_n == 0 &&
    !exact_zero_support
  ) {
    invalid <- TRUE
  }

  if (
    value_valid &&
    value != 0 &&
    is.null(rse)
  ) {
    invalid <- TRUE
  }

  if (
    value_valid &&
    value == 0 &&
    nonzero_n_valid &&
    event_n_valid &&
    (nonzero_n > 0 || event_n > 0)
  ) {
    invalid <- TRUE
  }

  if (invalid) {
    reasons <- linked_condition_precision_reason_codes(c(reasons, "precision_input_invalid"))
    return(list(
      computationally_valid = FALSE,
      precision_status = "review_required",
      precision_reason_codes = as.list(reasons),
      precision_reporting_status = "suppress_pending_review",
      precision_rule_version = linked_condition_precision_rule_version(),
      product_release_eligible = FALSE
    ))
  }

  if (exact_zero_support) {
    return(list(
      computationally_valid = TRUE,
      precision_status = "unsupported_zero",
      precision_reason_codes = as.list(linked_condition_precision_reason_codes(reasons)),
      precision_reporting_status = "suppress_unsupported_zero",
      precision_rule_version = linked_condition_precision_rule_version(),
      product_release_eligible = FALSE
    ))
  }

  if (is.null(rse)) {
    reasons <- linked_condition_precision_reason_codes(c(reasons, "precision_input_invalid"))
    return(list(
      computationally_valid = FALSE,
      precision_status = "review_required",
      precision_reason_codes = as.list(reasons),
      precision_reporting_status = "suppress_pending_review",
      precision_rule_version = linked_condition_precision_rule_version(),
      product_release_eligible = FALSE
    ))
  }

  rse_status <- NULL
  reporting_status <- NULL

  if (rse < 0.30) {
    rse_status <- "meps_precise"
    reporting_status <- "reportable"
  } else if (rse <= 0.50) {
    reasons <- c(reasons, "rse_30_to_50")
    rse_status <- "meps_questionable_precision"
    reporting_status <- "reportable_with_caution"
  } else {
    reasons <- c(reasons, "rse_above_50")
    if (unit == "proportion" && interval_high <= 0.10) {
      reasons <- c(reasons, "low_percentage_exception")
      rse_status <- "meps_low_percentage_exception"
      reporting_status <- "reportable_with_caution"
    } else {
      rse_status <- "meps_unstable_precision"
      reporting_status <- "suppress_precision"
    }
  }

  reasons <- linked_condition_precision_reason_codes(reasons)

  if (target_n < 60) {
    return(list(
      computationally_valid = TRUE,
      precision_status = "insufficient_sample",
      precision_reason_codes = as.list(reasons),
      precision_reporting_status = "suppress_insufficient_sample",
      precision_rule_version = linked_condition_precision_rule_version(),
      product_release_eligible = FALSE
    ))
  }

  list(
    computationally_valid = TRUE,
    precision_status = rse_status,
    precision_reason_codes = as.list(reasons),
    precision_reporting_status = reporting_status,
    precision_rule_version = linked_condition_precision_rule_version(),
    product_release_eligible = FALSE
  )
}
