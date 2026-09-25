# Canonical MEPS analytical module loader.
# Source this file once from a repository-root working directory.
.meps_bootstrap_target <- environment()
.meps_bootstrap_sources <- c(
  file.path("analysis", "r", "lib", "paths.R"),
  file.path("analysis", "r", "lib", "file_integrity.R"),
  file.path("analysis", "r", "lib", "meps_values.R"),
  file.path("analysis", "r", "lib", "meps_source_guardrails.R"),
  file.path("analysis", "r", "lib", "meps_config.R"),
  file.path("analysis", "r", "lib", "survey_helpers.R"),
  file.path("analysis", "r", "lib", "result_helpers.R"),
  file.path("analysis", "r", "lib", "warning_capture.R"),
  file.path("analysis", "r", "lib", "survey_design_diagnostics.R"),
  file.path("analysis", "r", "meps", "load_hc256.R"),
  file.path("analysis", "r", "meps", "cohort_long_covid.R"),
  file.path("analysis", "r", "meps", "survey_designs.R"),
  file.path("analysis", "r", "meps", "cohort_diagnostics.R"),
  file.path("analysis", "r", "meps", "estimate_population.R"),
  file.path("analysis", "r", "meps", "estimate_spending.R"),
  file.path("analysis", "r", "meps", "estimate_utilization.R"),
  file.path("analysis", "r", "meps", "estimate_admin_burden.R"),
  file.path("analysis", "r", "meps", "estimate_mental_health.R"),
  file.path("analysis", "r", "meps", "build_candidate_artifact.R")
)
for (.meps_bootstrap_source in .meps_bootstrap_sources) {
  source(.meps_bootstrap_source, local = .meps_bootstrap_target)
}
rm(.meps_bootstrap_source, .meps_bootstrap_sources, .meps_bootstrap_target)
