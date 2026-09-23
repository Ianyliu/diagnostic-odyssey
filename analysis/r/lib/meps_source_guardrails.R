reviewed_round31_code_sets <- function() {
  list(
    COVIDEVER31 = c(-8, -7, -1, 1, 2),
    LCEVER31 = c(-8, -7, -1, 1, 2),
    COVSYMNOW31 = c(-8, -1, 1, 2)
  )
}

round31_code_diagnostics <- function(data) {
  reviewed <- reviewed_round31_code_sets()
  missing_variables <- setdiff(names(reviewed), names(data))
  if (length(missing_variables)) {
    stop(
      "Cannot validate reviewed HC-256 Round-31 code sets; missing variables: ",
      paste(missing_variables, collapse = ", "),
      call. = FALSE
    )
  }

  diagnostics <- lapply(names(reviewed), function(variable) {
    raw <- as.numeric(data[[variable]])
    allowed <- reviewed[[variable]]
    observed <- sort(unique(raw[!is.na(raw)]))
    unexpected <- setdiff(observed, allowed)

    counts <- vapply(
      allowed,
      function(code) sum(raw == code, na.rm = TRUE),
      integer(1)
    )
    names(counts) <- paste0("code_", allowed)

    list(
      variable = variable,
      allowable_codes = as.list(allowed),
      observed_codes = as.list(observed),
      observed_counts = as.list(counts),
      missing_na_n = sum(is.na(raw)),
      unexpected_codes = as.list(unexpected)
    )
  })
  names(diagnostics) <- names(reviewed)
  diagnostics
}

validate_reviewed_round31_code_sets <- function(data) {
  diagnostics <- round31_code_diagnostics(data)

  failures <- character()
  for (variable in names(diagnostics)) {
    d <- diagnostics[[variable]]
    if (d$missing_na_n > 0) {
      failures <- c(
        failures,
        paste0(variable, " contains ", d$missing_na_n, " NA value(s)")
      )
    }
    unexpected <- unlist(d$unexpected_codes, use.names = FALSE)
    if (length(unexpected)) {
      failures <- c(
        failures,
        paste0(
          variable,
          " contains unreviewed code(s): ",
          paste(unexpected, collapse = ", ")
        )
      )
    }
  }

  if (length(failures)) {
    stop(
      paste(
        "HC-256 Round-31 source-code validation failed.",
        paste(failures, collapse = "; "),
        "Review the official HC-256 codebook before changing any allowable code set."
      ),
      call. = FALSE
    )
  }

  diagnostics
}
