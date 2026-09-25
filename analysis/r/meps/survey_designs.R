source(file.path("analysis", "r", "lib", "survey_helpers.R"))

valid_design_rows <- function(data, weight_variable) {
  weight <- suppressWarnings(as.numeric(data[[weight_variable]]))
  !is.na(weight) &
    weight > 0 &
    !is.na(data$VARSTR) &
    !is.na(data$VARPSU)
}

design_row_filter_diagnostics <- function(
  data,
  weight_variable,
  eligibility = rep(TRUE, nrow(data)),
  eligibility_applies = FALSE
) {
  if (length(eligibility) != nrow(data)) {
    stop("Design eligibility must have one value per input row.", call. = FALSE)
  }

  weight <- suppressWarnings(as.numeric(data[[weight_variable]]))
  eligibility <- as.logical(eligibility)

  eligibility_missing <- if (eligibility_applies) is.na(eligibility) else rep(FALSE, nrow(data))
  eligibility_false <- if (eligibility_applies) {
    !is.na(eligibility) & !eligibility
  } else {
    rep(FALSE, nrow(data))
  }
  eligibility_keep <- if (eligibility_applies) {
    !is.na(eligibility) & eligibility
  } else {
    rep(TRUE, nrow(data))
  }

  reason_flags <- list(
    eligibility_missing = eligibility_missing,
    eligibility_false = eligibility_false,
    weight_missing = is.na(weight),
    weight_zero = !is.na(weight) & weight == 0,
    weight_negative = !is.na(weight) & weight < 0,
    varstr_missing = is.na(data$VARSTR),
    varpsu_missing = is.na(data$VARPSU)
  )

  keep <- eligibility_keep & valid_design_rows(data, weight_variable)
  excluded <- !keep

  reason_combinations <- list()
  if (any(excluded)) {
    labels <- vapply(which(excluded), function(i) {
      reasons <- names(reason_flags)[vapply(reason_flags, function(flag) isTRUE(flag[[i]]), logical(1))]
      paste(reasons, collapse = "+")
    }, character(1))
    counts <- table(labels)
    reason_combinations <- as.list(stats::setNames(as.integer(counts), names(counts)))
  }

  total_input_n <- nrow(data)
  retained_n <- sum(keep)
  excluded_any_n <- sum(excluded)

  list(
    total_input_n = total_input_n,
    retained_n = retained_n,
    excluded_any_n = excluded_any_n,
    eligibility_excluded_n = sum(eligibility_missing | eligibility_false),
    eligibility_missing_n = sum(eligibility_missing),
    eligibility_false_n = sum(eligibility_false),
    weight_missing_n = sum(reason_flags$weight_missing),
    weight_zero_n = sum(reason_flags$weight_zero),
    weight_negative_n = sum(reason_flags$weight_negative),
    varstr_missing_n = sum(reason_flags$varstr_missing),
    varpsu_missing_n = sum(reason_flags$varpsu_missing),
    criterion_counts_are_non_mutually_exclusive = TRUE,
    exclusion_reason_combinations = reason_combinations,
    reconciliation = list(
      retained_plus_excluded_n = retained_n + excluded_any_n,
      equals_total_input_n = identical(
        as.integer(retained_n + excluded_any_n),
        as.integer(total_input_n)
      )
    )
  )
}

build_meps_design <- function(
  data,
  weight_variable,
  eligibility = rep(TRUE, nrow(data)),
  eligibility_applies = FALSE
) {
  assert_survey_available()
  configure_meps_survey_options()

  row_filtering <- design_row_filter_diagnostics(
    data,
    weight_variable,
    eligibility = eligibility,
    eligibility_applies = eligibility_applies
  )

  eligibility_keep <- if (eligibility_applies) {
    !is.na(eligibility) & as.logical(eligibility)
  } else {
    rep(TRUE, nrow(data))
  }
  keep <- eligibility_keep & valid_design_rows(data, weight_variable)
  if (!any(keep)) {
    stop("No eligible positive-weight records for design ", weight_variable, call. = FALSE)
  }

  frame <- data[keep, , drop = FALSE]
  weight_formula <- stats::as.formula(paste0("~", weight_variable))
  design <- survey::svydesign(
    ids = ~VARPSU,
    strata = ~VARSTR,
    weights = weight_formula,
    data = frame,
    nest = TRUE
  )
  attr(design, "do_weight_variable") <- weight_variable
  attr(design, "do_variance_stratum") <- "VARSTR"
  attr(design, "do_variance_psu") <- "VARPSU"
  attr(design, "do_row_filtering") <- row_filtering
  design
}

build_meps_designs <- function(data) {
  required <- c(
    "PERWT24F", "ESAQWT24F", "SAQWT24F", "PESAQWT24F",
    "ESAQELIG", "SAQELIG", "VARSTR", "VARPSU"
  )
  missing <- setdiff(required, names(data))
  if (length(missing)) {
    stop("Cannot construct MEPS survey designs; missing: ", paste(missing, collapse = ", "), call. = FALSE)
  }

  person <- build_meps_design(data, "PERWT24F")
  esaq <- build_meps_design(
    data,
    "ESAQWT24F",
    eligibility = as.numeric(data$ESAQELIG) == 1,
    eligibility_applies = TRUE
  )
  psaq <- build_meps_design(
    data,
    "SAQWT24F",
    eligibility = as.numeric(data$SAQELIG) == 1,
    eligibility_applies = TRUE
  )

  list(
    person = person,
    esaq = esaq,
    psaq = psaq,
    metadata = list(
      person_weight = "PERWT24F",
      esaq_weight = "ESAQWT24F",
      psaq_weight = "SAQWT24F",
      joint_psaq_esaq_weight = "PESAQWT24F",
      joint_weight_status = "not_used_in_current_pipeline",
      variance_stratum = "VARSTR",
      variance_psu = "VARPSU",
      variance_method = "Taylor series linearization; with-replacement design",
      lonely_psu_policy = paste(
        "survey.lonely.psu='adjust' for any actual full-design lonely PSU;",
        "survey.adjust.domain.lonely=FALSE for ordinary full-design domain variance"
      ),
      row_filtering = list(
        person = attr(person, "do_row_filtering"),
        esaq = attr(esaq, "do_row_filtering"),
        psaq = attr(psaq, "do_row_filtering")
      )
    )
  )
}

current_long_covid_domain <- function(design) {
  base::subset(
    design,
    do_age_18_64 & !is.na(do_current_long_covid) & do_current_long_covid
  )
}
