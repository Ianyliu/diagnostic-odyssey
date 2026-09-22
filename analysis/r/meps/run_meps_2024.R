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
source(file.path("analysis", "r", "meps", "build_candidate_artifact.R"))

required_packages <- c("haven", "jsonlite", "survey")
missing_packages <- required_packages[!vapply(required_packages, requireNamespace, logical(1), quietly = TRUE)]
if (length(missing_packages)) {
  stop(
    "Missing R packages: ", paste(missing_packages, collapse = ", "),
    ". Run Rscript analysis/r/install_dependencies.R",
    call. = FALSE
  )
}

args <- commandArgs(trailingOnly = TRUE)
download_if_missing <- "--download" %in% args
output_arg <- grep("^--output=", args, value = TRUE)
output_dir <- if (length(output_arg)) {
  sub("^--output=", "", output_arg[[1]])
} else {
  repo_path("artifacts", "generated", "meps-2024-long-covid-candidate")
}

if (!file.exists(hc256_dta_path()) && !file.exists(hc256_zip_path()) && download_if_missing) {
  status <- system2(
    file.path(R.home("bin"), "Rscript"),
    repo_path("pipelines", "data", "download_meps_hc256.R")
  )
  if (!identical(status, 0L)) stop("Automatic HC-256 acquisition failed.", call. = FALSE)
}

data <- load_hc256()
input_path <- attr(data, "hc256_path")
if (is.null(input_path) || !nzchar(input_path) || !file.exists(input_path)) {
  stop("HC-256 loader did not preserve a valid input path for provenance.", call. = FALSE)
}
data <- construct_long_covid_cohort(data)
designs <- build_meps_designs(data)

generated_at <- format(Sys.time(), tz = "UTC", format = "%Y-%m-%dT%H:%M:%SZ")
run_stamp <- format(Sys.time(), tz = "UTC", format = "%Y%m%dT%H%M%SZ")
artifact_version <- paste0("meps-2024-long-covid-candidate-", run_stamp)
code_commit <- tryCatch(
  trimws(system("git rev-parse HEAD", intern = TRUE, ignore.stderr = TRUE)[[1]]),
  error = function(e) "unknown"
)
run_id <- paste0("meps24-", run_stamp)

population <- estimate_represented_population(designs, artifact_version)
spending <- estimate_spending(designs, artifact_version)
utilization <- estimate_utilization(designs, artifact_version)
admin <- estimate_admin_burden(designs, artifact_version)
mental <- estimate_mental_health(designs, artifact_version)

bundle <- build_candidate_bundle(
  economic_measures = c(list(population), spending, utilization),
  admin_measures = admin,
  mental_measures = mental,
  artifact_version = artifact_version,
  generated_at = generated_at,
  code_commit = code_commit,
  run_id = run_id
)
bundle_path <- write_candidate_bundle(bundle, output_dir)

esaq_case_domain <- current_long_covid_domain(designs$esaq)
psaq_case_domain <- current_long_covid_domain(designs$psaq)

diagnostics <- list(
  run_id = run_id,
  generated_at = generated_at,
  input_path = input_path,
  input_md5 = unname(tools::md5sum(input_path)),
  rows_hc256 = nrow(data),
  age_18_64_positive_person_weight_n = sum(data$do_age_18_64 & data$do_positive_person_weight, na.rm = TRUE),
  current_long_covid_known_n = sum(data$do_current_long_covid_known, na.rm = TRUE),
  current_long_covid_unclassified_n = sum(
    data$do_age_18_64 & data$do_positive_person_weight &
      is.na(data$do_current_long_covid_classification),
    na.rm = TRUE
  ),
  current_long_covid_case_n = sum(data$do_current_long_covid %in% TRUE, na.rm = TRUE),
  current_long_covid_weighted_population = unname(population$value),
  long_covid_history_conflict_n = sum(data$do_lc_history_conflict, na.rm = TRUE),
  current_symptoms_without_history_n = sum(data$do_current_symptoms_without_history, na.rm = TRUE),
  current_status_fallback_round31_case_n = sum(
    data$do_current_long_covid %in% TRUE & data$do_current_symptoms_round == "31",
    na.rm = TRUE
  ),
  history_positive_missing_current_status_n = sum(
    data$do_age_18_64 & data$do_positive_person_weight &
      data$do_lc_history_positive %in% TRUE &
      is.na(data$do_current_symptoms_latest),
    na.rm = TRUE
  ),
  esaq_current_long_covid_unweighted_n = nrow(esaq_case_domain$variables),
  esaq_current_long_covid_weighted_n = sum(stats::weights(esaq_case_domain)),
  psaq_current_long_covid_unweighted_n = nrow(psaq_case_domain$variables),
  psaq_current_long_covid_weighted_n = sum(stats::weights(psaq_case_domain)),
  design = designs$metadata,
  package_versions = as.list(vapply(required_packages, function(x) as.character(utils::packageVersion(x)), character(1))),
  r_version = R.version.string
)
jsonlite::write_json(
  diagnostics,
  file.path(output_dir, "diagnostics.json"),
  pretty = TRUE, auto_unbox = TRUE, null = "null", na = "null"
)

review_manifest <- list(
  artifact_version = artifact_version,
  candidate_bundle = "bundle.json",
  candidate_bundle_md5 = unname(tools::md5sum(bundle_path)),
  release_status = "candidate_pending_review",
  automatic_release = FALSE,
  checks = list(
    list(id = "methods_review", status = "pending"),
    list(id = "cohort_review", status = "pending"),
    list(id = "weighted_unweighted_n_review", status = "pending"),
    list(id = "interval_review", status = "pending"),
    list(id = "denominator_universe_review", status = "pending"),
    list(id = "plausibility_review", status = "pending"),
    list(id = "provenance_review", status = "pending"),
    list(id = "interpretation_review", status = "pending")
  )
)
jsonlite::write_json(
  review_manifest,
  file.path(output_dir, "review-manifest.json"),
  pretty = TRUE, auto_unbox = TRUE, null = "null"
)

node <- Sys.which("node")
if (!nzchar(node)) {
  stop("Node 22+ is required to validate the generated artifact against TypeScript contracts.", call. = FALSE)
}
validation_status <- system2(
  node,
  c(
    "--experimental-strip-types",
    repo_path("packages", "contracts", "src", "validate-artifact-cli.ts"),
    bundle_path
  )
)
if (!identical(validation_status, 0L)) {
  stop("Generated candidate failed TypeScript artifact validation.", call. = FALSE)
}

message("Candidate analytical artifact generated and contract-validated.")
message("Bundle: ", bundle_path)
message("Diagnostics: ", file.path(output_dir, "diagnostics.json"))
message("Review manifest: ", file.path(output_dir, "review-manifest.json"))
message("All numeric estimates remain release_status='preliminary'.")
