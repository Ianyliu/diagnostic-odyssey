#!/usr/bin/env Rscript

source(file.path("analysis", "r", "lib", "paths.R"))
source(file.path("analysis", "r", "meps", "load_hc256.R"))
source(file.path("analysis", "r", "meps", "cohort_long_covid.R"))
source(file.path("analysis", "r", "meps", "survey_designs.R"))
source(file.path("analysis", "r", "meps", "estimate_population.R"))
source(file.path("analysis", "r", "meps", "estimate_spending.R"))
source(file.path("analysis", "r", "meps", "estimate_utilization.R"))
source(file.path("analysis", "r", "meps", "estimate_admin_burden.R"))
source(file.path("analysis", "r", "meps", "estimate_mental_health.R"))
source(file.path("analysis", "r", "lib", "warning_capture.R"))

required_packages <- c("haven", "jsonlite", "survey")
missing_packages <- required_packages[!vapply(required_packages, requireNamespace, logical(1), quietly = TRUE)]
if (length(missing_packages)) {
  stop("Missing R packages: ", paste(missing_packages, collapse = ", "), call. = FALSE)
}

args <- commandArgs(trailingOnly = TRUE)
download_if_missing <- "--download" %in% args
output_arg <- grep("^--output=", args, value = TRUE)
output_dir <- if (length(output_arg)) {
  sub("^--output=", "", output_arg[[1]])
} else {
  repo_path("artifacts", "generated", "meps-variance-policy-review")
}
dir.create(output_dir, recursive = TRUE, showWarnings = FALSE)

if (!file.exists(hc256_dta_path()) && !file.exists(hc256_zip_path()) && download_if_missing) {
  status <- system2(
    file.path(R.home("bin"), "Rscript"),
    repo_path("pipelines", "data", "download_meps_hc256.R")
  )
  if (!identical(status, 0L)) stop("Automatic HC-256 acquisition failed.", call. = FALSE)
}

data <- load_hc256()
input_path <- attr(data, "hc256_path")
data <- construct_long_covid_cohort(data)
designs <- build_meps_designs(data)

design_psu_diagnostics <- function(design, label) {
  frame <- design$variables
  combos <- unique(data.frame(
    VARSTR = as.numeric(frame$VARSTR),
    VARPSU = as.numeric(frame$VARPSU)
  ))
  counts <- stats::aggregate(
    VARPSU ~ VARSTR,
    data = combos,
    FUN = function(x) length(unique(x))
  )
  names(counts)[2] <- "n_psu"
  dist <- table(counts$n_psu)

  list(
    label = label,
    weight_variable = attr(design, "do_weight_variable"),
    unweighted_design_n = nrow(frame),
    variance_strata_n = nrow(counts),
    unique_varstr_varpsu_n = nrow(combos),
    minimum_psus_per_stratum = min(counts$n_psu),
    maximum_psus_per_stratum = max(counts$n_psu),
    psus_per_stratum_distribution = as.list(
      stats::setNames(as.integer(dist), paste0("n_psu_", names(dist)))
    ),
    true_singleton_strata_n = sum(counts$n_psu == 1),
    true_singleton_strata = as.list(as.numeric(counts$VARSTR[counts$n_psu == 1])),
    survey_degf = unname(survey::degf(design))
  )
}

domain_psu_diagnostics <- function(design, label) {
  domain <- current_long_covid_domain(design)
  d <- design_psu_diagnostics(domain, label)
  d$domain_unweighted_n <- nrow(domain$variables)
  d
}

all_design_diagnostics <- list(
  person = design_psu_diagnostics(designs$person, "Full PERSON / PERWT24F design"),
  esaq = design_psu_diagnostics(designs$esaq, "Full ESAQ / ESAQWT24F design"),
  psaq = design_psu_diagnostics(designs$psaq, "Full PSAQ / SAQWT24F design")
)

true_singleton_total <- sum(vapply(
  all_design_diagnostics,
  function(x) x$true_singleton_strata_n,
  numeric(1)
))

domain_diagnostics <- list(
  person_current_case = domain_psu_diagnostics(
    designs$person,
    "Current-case PERSON domain"
  ),
  esaq_current_case = domain_psu_diagnostics(
    designs$esaq,
    "Current-case ESAQ domain"
  ),
  psaq_current_case = domain_psu_diagnostics(
    designs$psaq,
    "Current-case PSAQ domain"
  )
)

run_all_estimators <- function(adjust_domain_lonely) {
  options(
    survey.lonely.psu = "adjust",
    survey.adjust.domain.lonely = adjust_domain_lonely
  )

  warning_registry <- new_warning_registry()
  run_quiet <- function(stage, expr) {
    withCallingHandlers(
      run_stage_with_warning_capture(stage, expr, warning_registry),
      warning = function(w) invokeRestart("muffleWarning")
    )
  }

  version <- paste0(
    "variance-review-",
    if (adjust_domain_lonely) "adjusted" else "ordinary-domain"
  )

  population <- run_quiet(
    "represented_population",
    estimate_represented_population(designs, version)
  )
  spending <- run_quiet(
    "spending",
    estimate_spending(designs, version)
  )
  utilization <- run_quiet(
    "utilization",
    estimate_utilization(designs, version)
  )
  admin <- run_quiet(
    "esaq",
    estimate_admin_burden(designs, version)
  )
  mental <- run_quiet(
    "psaq",
    estimate_mental_health(designs, version)
  )

  list(
    records = c(list(population), spending, utilization, admin, mental),
    warnings = warning_registry_records(warning_registry)
  )
}

adjusted <- run_all_estimators(TRUE)
ordinary <- run_all_estimators(FALSE)

index_records <- function(records) {
  stats::setNames(records, vapply(records, function(x) x$estimate_id, character(1)))
}
a <- index_records(adjusted$records)
b <- index_records(ordinary$records)

if (!identical(sort(names(a)), sort(names(b)))) {
  stop("Sensitivity policies produced different estimate sets.", call. = FALSE)
}

estimate_ids <- sort(names(a))
comparison <- lapply(estimate_ids, function(id) {
  x <- a[[id]]
  y <- b[[id]]
  point_scale <- max(1, abs(x$value), abs(y$value))
  point_abs_diff <- abs(x$value - y$value)
  list(
    estimate_id = id,
    measure_id = x$measure_id,
    weight_variable = x$weight_variable,
    adjusted_domain_lonely = list(
      value = x$value,
      standard_error = x$standard_error,
      interval_low = x$interval_low,
      interval_high = x$interval_high,
      relative_standard_error = x$relative_standard_error,
      interval_width = x$interval_width
    ),
    ordinary_domain = list(
      value = y$value,
      standard_error = y$standard_error,
      interval_low = y$interval_low,
      interval_high = y$interval_high,
      relative_standard_error = y$relative_standard_error,
      interval_width = y$interval_width
    ),
    point_absolute_difference = point_abs_diff,
    point_relative_difference = point_abs_diff / point_scale,
    se_absolute_difference = y$standard_error - x$standard_error,
    se_percent_change_vs_adjusted = if (
      is.finite(x$standard_error) && x$standard_error != 0
    ) {
      100 * (y$standard_error / x$standard_error - 1)
    } else {
      NA_real_
    },
    interval_width_percent_change_vs_adjusted = if (
      is.finite(x$interval_width) && x$interval_width != 0
    ) {
      100 * (y$interval_width / x$interval_width - 1)
    } else {
      NA_real_
    }
  )
})

max_point_rel_diff <- max(vapply(
  comparison,
  function(x) x$point_relative_difference,
  numeric(1)
), na.rm = TRUE)
if (max_point_rel_diff > 1e-10) {
  stop(
    "Variance-policy sensitivity changed point estimates unexpectedly; max relative difference = ",
    format(max_point_rel_diff, scientific = TRUE),
    call. = FALSE
  )
}

clean_age <- function(x) {
  raw <- as.numeric(x)
  valid <- !is.na(raw) & raw >= 0 & raw <= 85
  out <- rep(NA_real_, length(raw))
  out[valid] <- raw[valid]
  out
}
age31 <- clean_age(data$AGE31X)
age24 <- clean_age(data$AGE24X)
raw31 <- as.numeric(data$AGE31X)
raw24 <- as.numeric(data$AGE24X)
elig31 <- !is.na(age31) & age31 >= 18 & age31 <= 64
elig24 <- !is.na(age24) & age24 >= 18 & age24 <= 64
positive <- !is.na(data$PERWT24F) & as.numeric(data$PERWT24F) > 0
difference <- positive & xor(elig31, elig24)

category <- rep(NA_character_, nrow(data))
category[difference & !is.na(age31) & age31 < 18 & elig24] <-
  "valid_AGE31X_under18_to_AGE24X_18_64"
category[difference & elig31 & !is.na(age24) & age24 >= 65] <-
  "valid_AGE31X_18_64_to_AGE24X_65plus"
category[difference & elig31 & !is.na(age24) & age24 < 18] <-
  "valid_AGE31X_18_64_to_AGE24X_under18"
category[difference & !is.na(age31) & age31 >= 65 & elig24] <-
  "valid_AGE31X_65plus_to_AGE24X_18_64"
category[difference & is.na(age31) & elig24] <-
  "AGE31X_reserved_or_missing_to_valid_AGE24X_18_64"
category[difference & elig31 & is.na(age24)] <-
  "valid_AGE31X_18_64_to_AGE24X_reserved_or_missing"
category[difference & is.na(category)] <- "other_eligibility_difference"

age_category_counts <- sort(table(category[difference]), decreasing = TRUE)
age_partition_total <- sum(age_category_counts)
age_difference_total <- sum(difference)
if (age_partition_total != age_difference_total) {
  stop("Age-transition diagnostic categories do not reconcile.", call. = FALSE)
}

output <- list(
  review_type = "MEPS 2024 Long COVID domain-singleton variance sensitivity",
  generated_at_utc = format(Sys.time(), tz = "UTC", usetz = TRUE),
  code_commit = tryCatch(
    trimws(system("git rev-parse HEAD", intern = TRUE, ignore.stderr = TRUE)[[1]]),
    error = function(e) "unknown"
  ),
  input_md5 = unname(tools::md5sum(input_path)),
  policy_under_review = list(
    survey_lonely_psu = "adjust",
    adjusted_domain_lonely = TRUE,
    ordinary_domain_lonely = FALSE,
    note = paste(
      "Both sensitivity arms retain the same weight-specific full survey designs",
      "and subset(survey.design, domain) domain-estimation approach."
    )
  ),
  full_design_diagnostics = all_design_diagnostics,
  true_full_design_singleton_strata_total_across_weight_specific_designs =
    true_singleton_total,
  current_case_domain_diagnostics = domain_diagnostics,
  sensitivity = list(
    estimate_count = length(comparison),
    maximum_point_relative_difference = max_point_rel_diff,
    adjusted_warning_count = sum(vapply(
      adjusted$warnings, function(x) x$count, integer(1)
    )),
    ordinary_domain_warning_count = sum(vapply(
      ordinary$warnings, function(x) x$count, integer(1)
    )),
    adjusted_warning_records = adjusted$warnings,
    ordinary_domain_warning_records = ordinary$warnings,
    measures = comparison
  ),
  age_transition_review = list(
    cleaning_rule = "AGE values outside reviewed 0-85 range are diagnostic missing/reserved, not genuine ages.",
    eligibility_definition = "18-64",
    total_eligibility_differences = age_difference_total,
    categories = as.list(stats::setNames(
      as.integer(age_category_counts),
      names(age_category_counts)
    )),
    reconciliation_total = age_partition_total,
    reconciles = identical(as.integer(age_partition_total), as.integer(age_difference_total)),
    raw_reserved_counts = list(
      AGE31X_negative_reserved_n = sum(positive & !is.na(raw31) & raw31 < 0),
      AGE24X_negative_reserved_n = sum(positive & !is.na(raw24) & raw24 < 0)
    )
  ),
  software = list(
    R = R.version.string,
    survey = as.character(utils::packageVersion("survey")),
    haven = as.character(utils::packageVersion("haven")),
    jsonlite = as.character(utils::packageVersion("jsonlite"))
  )
)

jsonlite::write_json(
  output,
  file.path(output_dir, "variance-review.json"),
  pretty = TRUE,
  auto_unbox = TRUE,
  null = "null",
  na = "null",
  digits = 15
)

message("Variance-policy review diagnostics complete.")
message("True full-design singleton strata across weight-specific designs: ", true_singleton_total)
message("Measures compared: ", length(comparison))
message("Maximum point-estimate relative difference: ", max_point_rel_diff)
message("Age-transition categories reconcile: ", age_partition_total, " / ", age_difference_total)
