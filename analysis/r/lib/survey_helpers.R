configure_meps_survey_options <- function() {
  options(
    survey.lonely.psu = "adjust",
    survey.adjust.domain.lonely = TRUE
  )
}

assert_survey_available <- function() {
  if (!requireNamespace("survey", quietly = TRUE)) {
    stop("Package 'survey' is required. Run Rscript analysis/r/install_dependencies.R", call. = FALSE)
  }
}

set_design_variable <- function(design, name, values) {
  if (length(values) != nrow(design$variables)) {
    stop("Design variable length mismatch for ", name, call. = FALSE)
  }
  design$variables[[name]] <- values
  design
}

design_with_clean_value <- function(design, source_variable, cleaner, target = ".do_value") {
  if (!source_variable %in% names(design$variables)) {
    stop("Variable not present in survey design: ", source_variable, call. = FALSE)
  }
  set_design_variable(design, target, cleaner(design$variables[[source_variable]]))
}

survey_df <- function(design, label = "survey design") {
  df <- survey::degf(design)
  if (length(df) != 1L || !is.finite(df) || df <= 0) {
    stop(
      sprintf(
        "Invalid survey design degrees of freedom for %s: %s. Analytical estimation cannot continue.",
        label,
        paste(df, collapse = ", ")
      ),
      call. = FALSE
    )
  }
  unname(df)
}

validate_ci_df <- function(ci_df, ci_df_source) {
  if (length(ci_df) != 1L || !is.finite(ci_df) || ci_df <= 0) {
    stop(
      sprintf(
        "Invalid confidence-interval degrees of freedom from %s: %s.",
        ci_df_source,
        paste(ci_df, collapse = ", ")
      ),
      call. = FALSE
    )
  }
  unname(ci_df)
}

t_interval <- function(estimate, standard_error, ci_df, level = 0.95) {
  alpha <- 1 - level
  critical <- stats::qt(1 - alpha / 2, df = ci_df)
  c(
    low = estimate - critical * standard_error,
    high = estimate + critical * standard_error
  )
}

stat_point_se <- function(statistic) {
  estimate <- unname(stats::coef(statistic)[[1]])
  variance <- stats::vcov(statistic)
  standard_error <- sqrt(unname(variance[1, 1]))
  c(estimate = estimate, standard_error = standard_error)
}

survey_weighted_valid_n <- function(design, variable = ".do_value") {
  valid <- !is.na(design$variables[[variable]])
  tmp <- set_design_variable(design, ".do_valid", as.numeric(valid))
  unname(stats::coef(survey::svytotal(~.do_valid, tmp, na.rm = TRUE))[[1]])
}

survey_unweighted_valid_n <- function(design, variable = ".do_value") {
  sum(!is.na(design$variables[[variable]]))
}

survey_precision_metadata <- function(
  design,
  variable,
  estimate,
  standard_error,
  interval_low,
  interval_high,
  ci_degrees_of_freedom,
  ci_df_source
) {
  valid_n <- survey_unweighted_valid_n(design, variable)
  total_n <- nrow(design$variables)
  list(
    unweighted_n = valid_n,
    weighted_denominator = survey_weighted_valid_n(design, variable),
    relative_standard_error = if (is.finite(estimate) && estimate != 0) {
      abs(standard_error / estimate)
    } else {
      NA_real_
    },
    interval_width = if (is.finite(interval_low) && is.finite(interval_high)) {
      interval_high - interval_low
    } else {
      NA_real_
    },
    unweighted_excluded_or_missing_n = as.integer(total_n - valid_n),
    ci_degrees_of_freedom = ci_degrees_of_freedom,
    ci_df_source = ci_df_source
  )
}

survey_total_result <- function(
  design,
  source_variable,
  cleaner,
  ci_reference_design,
  ci_df_source,
  level = 0.95
) {
  assert_survey_available()
  tmp <- design_with_clean_value(design, source_variable, cleaner)
  stat <- survey::svytotal(~.do_value, tmp, na.rm = TRUE)
  point <- stat_point_se(stat)
  ci_df <- validate_ci_df(survey_df(ci_reference_design, ci_df_source), ci_df_source)
  ci <- t_interval(point[["estimate"]], point[["standard_error"]], ci_df, level)
  c(
    list(
      value = point[["estimate"]],
      standard_error = point[["standard_error"]],
      interval_low = ci[["low"]],
      interval_high = ci[["high"]],
      interval_type = sprintf(
        "%d%% t CI (Taylor linearization; df=%g from %s)",
        round(level * 100), ci_df, ci_df_source
      )
    ),
    survey_precision_metadata(
      tmp, ".do_value", point[["estimate"]], point[["standard_error"]],
      ci[["low"]], ci[["high"]], ci_df, ci_df_source
    )
  )
}

survey_mean_result <- function(
  design,
  source_variable,
  cleaner,
  ci_reference_design,
  ci_df_source,
  level = 0.95
) {
  assert_survey_available()
  tmp <- design_with_clean_value(design, source_variable, cleaner)
  stat <- survey::svymean(~.do_value, tmp, na.rm = TRUE)
  point <- stat_point_se(stat)
  ci_df <- validate_ci_df(survey_df(ci_reference_design, ci_df_source), ci_df_source)
  ci <- t_interval(point[["estimate"]], point[["standard_error"]], ci_df, level)
  c(
    list(
      value = point[["estimate"]],
      standard_error = point[["standard_error"]],
      interval_low = ci[["low"]],
      interval_high = ci[["high"]],
      interval_type = sprintf(
        "%d%% t CI (Taylor linearization; df=%g from %s)",
        round(level * 100), ci_df, ci_df_source
      )
    ),
    survey_precision_metadata(
      tmp, ".do_value", point[["estimate"]], point[["standard_error"]],
      ci[["low"]], ci[["high"]], ci_df, ci_df_source
    )
  )
}

survey_proportion_result <- function(
  design,
  source_variable,
  cleaner,
  ci_reference_design,
  ci_df_source,
  level = 0.95
) {
  assert_survey_available()
  tmp <- design_with_clean_value(design, source_variable, cleaner)
  stat <- survey::svymean(~.do_value, tmp, na.rm = TRUE)
  point <- stat_point_se(stat)
  ci_df <- validate_ci_df(survey_df(ci_reference_design, ci_df_source), ci_df_source)
  ci <- t_interval(point[["estimate"]], point[["standard_error"]], ci_df, level)
  bounded_low <- max(0, ci[["low"]])
  bounded_high <- min(1, ci[["high"]])
  c(
    list(
      value = point[["estimate"]],
      standard_error = point[["standard_error"]],
      interval_low = bounded_low,
      interval_high = bounded_high,
      interval_type = sprintf(
        "%d%% t CI, bounded [0,1] (Taylor linearization; df=%g from %s)",
        round(level * 100), ci_df, ci_df_source
      ),
      unweighted_numerator_n = sum(tmp$variables$.do_value == 1, na.rm = TRUE)
    ),
    survey_precision_metadata(
      tmp, ".do_value", point[["estimate"]], point[["standard_error"]],
      bounded_low, bounded_high, ci_df, ci_df_source
    )
  )
}
