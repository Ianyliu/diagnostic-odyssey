# Pure helpers for candidate-only reconciliation JSON serialization.

linked_condition_reconciliation_families <- function() {
  c("office", "outpatient", "emergency", "inpatient")
}

as_linked_condition_family_count_object <- function(x) {
  families <- linked_condition_reconciliation_families()
  values <- unlist(x, use.names = TRUE)

  if (
    length(values) != length(families) ||
      is.null(names(values)) ||
      anyDuplicated(names(values)) ||
      !setequal(names(values), families)
  ) {
    stop(
      "Linked-condition family counts must contain exactly office, outpatient, emergency, and inpatient.",
      call. = FALSE
    )
  }

  values <- values[families]
  numeric_values <- suppressWarnings(as.numeric(values))
  if (
    anyNA(numeric_values) ||
      any(!is.finite(numeric_values)) ||
      any(numeric_values < 0) ||
      any(numeric_values != floor(numeric_values))
  ) {
    stop("Linked-condition family counts must be finite non-negative integers.", call. = FALSE)
  }

  setNames(lapply(numeric_values, as.integer), families)
}
