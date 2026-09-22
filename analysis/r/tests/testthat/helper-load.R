repo_root <- Sys.getenv("DIAGNOSTIC_ODYSSEY_ROOT")
if (!nzchar(repo_root) || !dir.exists(repo_root)) {
  stop("DIAGNOSTIC_ODYSSEY_ROOT is not set to the repository root.", call. = FALSE)
}

old_wd <- getwd()
setwd(repo_root)
on.exit(setwd(old_wd), add = TRUE)

source(file.path("analysis", "r", "lib", "meps_values.R"))
source(file.path("analysis", "r", "lib", "survey_helpers.R"))
source(file.path("analysis", "r", "lib", "result_helpers.R"))
source(file.path("analysis", "r", "lib", "warning_capture.R"))
source(file.path("analysis", "r", "meps", "cohort_long_covid.R"))
source(file.path("analysis", "r", "meps", "survey_designs.R"))
source(file.path("analysis", "r", "meps", "cohort_diagnostics.R"))
source(file.path("analysis", "r", "meps", "estimate_population.R"))
source(file.path("analysis", "r", "meps", "build_candidate_artifact.R"))

setwd(old_wd)

synthetic_design_data <- function() {
  data.frame(
    DUPERSID = sprintf("P%02d", 1:8),
    VARSTR = rep(c(1, 2), each = 4),
    VARPSU = rep(c(1, 1, 2, 2), 2),
    PERWT24F = c(1, 2, 1, 2, 1, 2, 1, 2),
    ESAQWT24F = c(2, 4, 2, 4, 2, 4, 2, 4),
    SAQWT24F = c(3, 6, 3, 6, 3, 6, 3, 6),
    PESAQWT24F = c(4, 8, 4, 8, 4, 8, 4, 8),
    ESAQELIG = 1,
    SAQELIG = 1,
    AGE24X = rep(40, 8),
    do_age_18_64 = TRUE,
    do_current_long_covid = c(TRUE, TRUE, FALSE, FALSE, TRUE, FALSE, TRUE, FALSE),
    x = c(0, 1, 2, 3, 4, 5, NA, 7)
  )
}

valid_candidate_record <- function(
  measure_id = "example",
  component_of_measure_id = NULL,
  release_status = "preliminary"
) {
  list(
    estimate_id = paste0("id-", measure_id),
    measure_id = measure_id,
    label = "Example",
    value = 1,
    unit = "unit",
    interval_low = 0.5,
    interval_high = 1.5,
    interval_type = "95% t CI (Taylor linearization)",
    denominator = "Synthetic denominator",
    universe = "Synthetic universe",
    system_boundary = "Synthetic boundary",
    evidence_type = "survey_estimate",
    release_status = release_status,
    display_status = "analytical_artifact",
    source_ref = "meps-hc256-2024",
    artifact_version = "candidate-test",
    allowed_interpretation = "Synthetic test only",
    prohibited_interpretation = list("causal claim"),
    limitations = list("Synthetic"),
    standard_error = 0.1,
    weighted_denominator = 100,
    unweighted_n = 8L,
    weight_variable = "PERWT24F",
    variance_stratum_variable = "VARSTR",
    variance_psu_variable = "VARPSU",
    source_locator = "HC-256 test locator",
    cohort_definition = "Synthetic cohort",
    statistics_method = "Taylor linearization",
    component_of_measure_id = component_of_measure_id
  )
}
