#!/usr/bin/env Rscript
# Review-only comparator candidate. Never edits reviewed artifacts or web/runtime data.
source(file.path("analysis", "r", "meps", "bootstrap.R"))
source(file.path("analysis", "r", "comparator", "comparator_methods.R"))

required_packages <- c("haven", "jsonlite", "survey")
missing_packages <- required_packages[
  !vapply(required_packages, requireNamespace, logical(1), quietly = TRUE)
]
if (length(missing_packages)) {
  stop("Required R packages unavailable: ", paste(missing_packages, collapse = ", "),
       call. = FALSE)
}

args <- commandArgs(trailingOnly = TRUE)
if (length(args)) {
  stop("This candidate runner takes no arguments and never auto-downloads data.", call. = FALSE)
}

if (!file.exists(hc256_dta_path()) && !file.exists(hc256_zip_path())) {
  stop(paste(
    "BLOCKED: authorized raw HC-256 (2024) unavailable.",
    "Place the verified data/raw/meps/2024/h256.dta or",
    "data/raw/meps/2024/meps_hc256_2024_stata.zip locally.",
    "No synthetic values will be substituted."
  ), call. = FALSE)
}

source_config <- jsonlite::fromJSON(
  repo_path("analysis", "r", "comparator", "comparator_config.json"),
  simplifyVector = FALSE
)
if (!identical(source_config$release$automatic_release, FALSE) ||
    !identical(source_config$release$independent_methods_review, "pending")) {
  stop("Comparator governance contract changed unexpectedly.", call. = FALSE)
}

data <- load_hc256()
input_path <- attr(data, "hc256_path")
if (is.null(input_path) || !file.exists(input_path)) {
  stop("HC-256 provenance path missing.", call. = FALSE)
}
source_integrity <- read_hc256_source_integrity()
input_sha256 <- assert_sha256_matches(
  input_path, source_integrity$expected_extracted_dta_sha256,
  "MEPS HC-256 comparator analytical input"
)

data <- construct_long_covid_cohort(data)
data <- comparator_prepare(data)
full_design <- build_meps_design(data, "PERWT24F")
diagnostics <- comparator_domain_diagnostics(data, full_design)

unadjusted <- comparator_unadjusted(full_design)
unadjusted_covariate_complete <- comparator_unadjusted(
  full_design, complete_case_only = TRUE
)
unadjusted_no_history <- comparator_unadjusted(
  full_design, group_variable = ".do_cmp_restricted"
)
adjusted <- comparator_adjusted(full_design, replicates = 400L, seed = 20261019L)
adjusted_insurance <- comparator_adjusted(
  full_design, replicates = 400L, seed = 20261019L, insurance = TRUE
)
screen <- comparator_precision_screen(unadjusted, adjusted, diagnostics)

code_commit <- tryCatch(
  trimws(system("git rev-parse HEAD", intern = TRUE, ignore.stderr = TRUE)[[1]]),
  error = function(e) "unknown"
)
github_sha <- Sys.getenv("GITHUB_SHA", unset = "")
assert_code_commit_matches_github_sha(code_commit, github_sha)

stamp <- format(Sys.time(), tz = "UTC", format = "%Y%m%dT%H%M%SZ")
output_dir <- repo_path("artifacts", "generated",
                        paste0("meps24-comparator-candidate-", stamp))
dir.create(output_dir, recursive = TRUE, showWarnings = FALSE)

candidate <- list(
  schema_version = "comparator-candidate-v0.1",
  status = "preliminary",
  automatic_release = FALSE,
  independent_methods_review = "pending",
  source = "MEPS HC-256 (2024), August 2026",
  source_input_sha256 = input_sha256,
  code_commit = code_commit,
  github_sha = if (nzchar(github_sha)) github_sha else NULL,
  generated_at_utc = format(Sys.time(), tz = "UTC",
                            format = "%Y-%m-%dT%H:%M:%SZ"),
  main_baseline_commit = source_config$baseline_parent_commit,
  cohort = cohort_definition_text(),
  estimand = "observational difference in annual all-cause spending, current minus noncurrent",
  group_definition = source_config$primary$comparator,
  weight = "PERWT24F",
  design = list(psu = "VARPSU", strata = "VARSTR",
                ci_df = survey_df(full_design, "full PERSON design"),
                covariance_aware = TRUE),
  results = list(
    unadjusted = unadjusted,
    adjusted = adjusted,
    sensitivity_no_prior_history = unadjusted_no_history,
    sensitivity_unadjusted_covariate_complete = unadjusted_covariate_complete,
    sensitivity_adjusted_interview_insurance = adjusted_insurance
  ),
  diagnostics = diagnostics,
  precision_advisory = screen,
  interpretation = list(
    allowed = "Observational, all-cause 2024 association conditional on operational 2024 R3/1 status",
    prohibited = c("causal", "attributable", "preventable", "diagnostic-delay cost",
                   "return on investment", "state Medicaid claims"),
    temporal_boundary = paste(
      "2024 full-year expenditures may precede or follow",
      "Round-3/1 status classification.")
  ),
  never_promote_into_ordinary_meps_bundle = TRUE
)

path <- file.path(output_dir, "candidate-comparator.json")
jsonlite::write_json(candidate, path, pretty = TRUE, auto_unbox = TRUE,
                     digits = NA, null = "null", na = "null")

review <- list(
  schema_version = "comparator-review-v0.1",
  candidate_path = basename(path),
  candidate_sha256 = sha256_file(path),
  source_sha256 = input_sha256,
  code_commit = code_commit,
  independent_methods_review = "pending",
  automatic_release = FALSE,
  ordinary_bundle_unchanged = TRUE,
  checks = list(
    list(id = "eligibility_and_temporal_anchor", status = "pending"),
    list(id = "source_weight_and_codebook_mapping", status = "pending"),
    list(id = "group_and_positive_spending_support", status = "pending"),
    list(id = "covariance_and_full_design_df", status = "pending"),
    list(id = "adjusted_model_overlap_and_misspecification", status = "pending"),
    list(id = "replicate_failures_and_influence", status = "pending"),
    list(id = "independent_sensitivity_reproduction", status = "pending"),
    list(id = "precision_and_disclosure_suppression", status = "pending"),
    list(id = "noncausal_interpretation_and_UI_contract", status = "pending")
  )
)
jsonlite::write_json(review, file.path(output_dir, "review-manifest.json"),
                     pretty = TRUE, auto_unbox = TRUE, null = "null")
message("PRELIMINARY comparator candidate generated locally only: ", path)
message("No promotion, deployment or edits to reviewed ordinary estimates.")
