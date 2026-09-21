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

survey_df <- function(design) {
  max(1, survey::degf(design))
}

t_interval <- function(estimate, standard_error, design, level = 0.95) {
  alpha <- 1 - level
  critical <- stats::qt(1 - alpha / 2, df = survey_df(design))
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

survey_total_result <- function(design, source_variable, cleaner, level = 0.95) {
  assert_survey_available()
  tmp <- design_with_clean_value(design, source_variable, cleaner)
  stat <- survey::svytotal(~.do_value, tmp, na.rm = TRUE)
  point <- stat_point_se(stat)
  ci <- t_interval(point[["estimate"]], point[["standard_error"]], tmp, level)
  list(
    value = point[["estimate"]],
    standard_error = point[["standard_error"]],
    interval_low = ci[["low"]],
    interval_high = ci[["high"]],
    interval_type = sprintf("%d%% t CI (Taylor linearization)", round(level * 100)),
    unweighted_n = survey_unweighted_valid_n(tmp),
    weighted_denominator = survey_weighted_valid_n(tmp)
  )
}

survey_mean_result <- function(design, source_variable, cleaner, level = 0.95) {
  assert_survey_available()
  tmp <- design_with_clean_value(design, source_variable, cleaner)
  stat <- survey::svymean(~.do_value, tmp, na.rm = TRUE)
  point <- stat_point_se(stat)
  ci <- t_interval(point[["estimate"]], point[["standard_error"]], tmp, level)
  list(
    value = point[["estimate"]],
    standard_error = point[["standard_error"]],
    interval_low = ci[["low"]],
    interval_high = ci[["high"]],
    interval_type = sprintf("%d%% t CI (Taylor linearization)", round(level * 100)),
    unweighted_n = survey_unweighted_valid_n(tmp),
    weighted_denominator = survey_weighted_valid_n(tmp)
  )
}

survey_proportion_result <- function(design, source_variable, cleaner, level = 0.95) {
  assert_survey_available()
  tmp <- design_with_clean_value(design, source_variable, cleaner)
  stat <- survey::svymean(~.do_value, tmp, na.rm = TRUE)
  point <- stat_point_se(stat)
  ci <- t_interval(point[["estimate"]], point[["standard_error"]], tmp, level)
  list(
    value = point[["estimate"]],
    standard_error = point[["standard_error"]],
    interval_low = max(0, ci[["low"]]),
    interval_high = min(1, ci[["high"]]),
    interval_type = sprintf("%d%% t CI, bounded [0,1] (Taylor linearization)", round(level * 100)),
    unweighted_n = survey_unweighted_valid_n(tmp),
    weighted_denominator = survey_weighted_valid_n(tmp),
    unweighted_numerator_n = sum(tmp$variables$.do_value == 1, na.rm = TRUE)
  )
}
