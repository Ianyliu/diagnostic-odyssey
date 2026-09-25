#!/usr/bin/env Rscript

source(file.path("analysis", "r", "meps", "bootstrap.R"))

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
github_sha <- Sys.getenv("GITHUB_SHA", unset = "")
assert_code_commit_matches_github_sha(code_commit, github_sha)

source_integrity_policy <- read_hc256_source_integrity()
input_sha256 <- assert_sha256_matches(
  input_path,
  source_integrity_policy$expected_extracted_dta_sha256,
  "MEPS HC-256 analytical input"
)

run_id <- paste0("meps24-", run_stamp)

warning_registry <- new_warning_registry()

population <- run_stage_with_warning_capture(
  "represented_population",
  estimate_represented_population(designs, artifact_version),
  warning_registry
)
spending <- run_stage_with_warning_capture(
  "spending",
  estimate_spending(designs, artifact_version),
  warning_registry
)
utilization <- run_stage_with_warning_capture(
  "utilization",
  estimate_utilization(designs, artifact_version),
  warning_registry
)
admin <- run_stage_with_warning_capture(
  "esaq",
  estimate_admin_burden(designs, artifact_version),
  warning_registry
)
mental <- run_stage_with_warning_capture(
  "psaq",
  estimate_mental_health(designs, artifact_version),
  warning_registry
)

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

cohort_diagnostics <- build_corrected_cohort_diagnostics(
  data,
  designs,
  population
)

source_metadata_path <- repo_path(
  "data", "raw", "meps", "2024", "hc256_source_metadata.json"
)
source_metadata <- if (file.exists(source_metadata_path)) {
  jsonlite::fromJSON(source_metadata_path, simplifyVector = FALSE)
} else {
  NULL
}

all_estimate_records <- c(list(population), spending, utilization, admin, mental)
variance_design_diagnostics <- build_variance_design_diagnostics(designs)

diagnostics <- list(
  run_id = run_id,
  generated_at = generated_at,
  code_commit = code_commit,
  github_sha = if (nzchar(github_sha)) github_sha else NULL,
  code_commit_matches_github_sha = if (nzchar(github_sha)) TRUE else NULL,
  dataset_release = "AHRQ MEPS HC-256: 2024 Full Year Consolidated Data File (August 2026)",
  input_path = input_path,
  input_md5 = unname(tools::md5sum(input_path)),
  input_sha256 = input_sha256,
  expected_input_sha256 = source_integrity_policy$expected_extracted_dta_sha256,
  input_sha256_match = TRUE,
  source_metadata = source_metadata,
  cohort = cohort_diagnostics,
  variance = variance_design_diagnostics,
  estimate_ci_degrees_of_freedom = ci_df_diagnostics(all_estimate_records),
  analytical_warnings = warning_registry_records(warning_registry),
  design = designs$metadata,
  package_versions = as.list(vapply(
    required_packages,
    function(x) as.character(utils::packageVersion(x)),
    character(1)
  )),
  r_version = R.version.string
)
jsonlite::write_json(
  diagnostics,
  file.path(output_dir, "diagnostics.json"),
  pretty = TRUE, auto_unbox = TRUE, null = "null", na = "null"
)

diagnostics_path <- file.path(output_dir, "diagnostics.json")
bundle_sha256 <- sha256_file(bundle_path)
diagnostics_sha256 <- sha256_file(diagnostics_path)

review_manifest <- list(
  artifact_version = artifact_version,
  candidate_bundle = "bundle.json",
  candidate_bundle_md5 = unname(tools::md5sum(bundle_path)),
  candidate_bundle_sha256 = bundle_sha256,
  diagnostics = "diagnostics.json",
  diagnostics_sha256 = diagnostics_sha256,
  code_commit = code_commit,
  github_sha = if (nzchar(github_sha)) github_sha else NULL,
  code_commit_matches_github_sha = if (nzchar(github_sha)) TRUE else NULL,
  source_input_sha256 = input_sha256,
  expected_source_input_sha256 = source_integrity_policy$expected_extracted_dta_sha256,
  source_input_sha256_match = TRUE,
  release_status = "preliminary",
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
