`%||%` <- function(x, y) if (is.null(x)) y else x

source(file.path("analysis", "r", "lib", "paths.R"))

candidate_domain <- function(domain_id, label, measures, limitations = character()) {
  list(
    domain_id = domain_id,
    label = label,
    measures = unname(measures),
    availability_state = if (length(measures)) "loaded" else "empty",
    limitations = as.list(limitations)
  )
}

validate_candidate_records <- function(measures) {
  required <- c(
    "estimate_id", "measure_id", "label", "value", "unit", "interval_low",
    "interval_high", "interval_type", "denominator", "universe", "system_boundary",
    "evidence_type", "release_status", "display_status", "source_ref",
    "artifact_version", "allowed_interpretation", "prohibited_interpretation",
    "limitations", "standard_error", "weighted_denominator", "unweighted_n",
    "weight_variable", "variance_stratum_variable", "variance_psu_variable",
    "source_locator", "cohort_definition", "statistics_method"
  )
  for (record in measures) {
    missing <- setdiff(required, names(record))
    if (length(missing)) {
      stop("Candidate estimate ", record$estimate_id %||% "<unknown>",
           " lacks required fields: ", paste(missing, collapse = ", "), call. = FALSE)
    }
    if (!identical(record$display_status, "analytical_artifact")) {
      stop("Candidate numeric estimate must have display_status='analytical_artifact'.", call. = FALSE)
    }
    if (!identical(record$release_status, "preliminary")) {
      stop("Pipeline-generated estimates must remain release_status='preliminary'.", call. = FALSE)
    }
    provenance <- c(
      record$weight_variable, record$variance_stratum_variable, record$variance_psu_variable,
      record$source_locator, record$cohort_definition, record$statistics_method
    )
    if (any(!nzchar(provenance))) {
      stop("Candidate estimate has incomplete analytical provenance: ", record$estimate_id, call. = FALSE)
    }
  }

  oop <- Filter(function(x) grepl("^out-of-pocket-spending", x$measure_id), measures)
  if (length(oop) && any(vapply(oop, function(x) is.null(x$component_of_measure_id), logical(1)))) {
    stop("Out-of-pocket estimates must declare their parent total-spending measure.", call. = FALSE)
  }

  forbidden_admin_aggregate <- vapply(
    measures,
    function(x) grepl("admin.*total|diagnostic.*burden.*score|combined.*admin", x$measure_id, ignore.case = TRUE),
    logical(1)
  )
  if (any(forbidden_admin_aggregate)) {
    stop("Administrative time measures must remain separate; aggregate admin score detected.", call. = FALSE)
  }
  invisible(TRUE)
}

build_candidate_bundle <- function(
  economic_measures,
  admin_measures,
  mental_measures,
  artifact_version,
  generated_at,
  code_commit,
  run_id
) {
  all_measures <- c(economic_measures, admin_measures, mental_measures)
  validate_candidate_records(all_measures)

  list(
    manifest = list(
      artifact_version = artifact_version,
      generated_at = generated_at,
      code_commit = code_commit,
      run_id = run_id,
      dataset_releases = list("AHRQ MEPS HC-256: 2024 Full Year Consolidated Data File (released August 2026)"),
      display_status = "analytical_artifact"
    ),
    context = list(
      condition_id = "long-covid-current",
      cohort_id = "current-long-covid-adults-18-64-meps-2024",
      age_range = "18-64",
      evidence_year = 2024,
      geography_scope = "United States national evidence",
      local_context_id = NULL,
      severity_filter = NULL,
      artifact_version = artifact_version
    ),
    burden_domains = list(
      candidate_domain(
        "economic-healthcare",
        "Economic / healthcare burden",
        economic_measures,
        c(
          "All spending and utilization estimates are gross/all-cause descriptive burden.",
          "Out-of-pocket spending is nested within total spending and is not additive."
        )
      ),
      candidate_domain(
        "healthcare-work-admin",
        "Healthcare-work / administrative burden",
        admin_measures,
        c(
          "ESAQ native time domains are reported separately and are not summed.",
          "ESAQ time measures are top-coded by AHRQ and have item-response limitations."
        )
      ),
      candidate_domain(
        "mental-human",
        "Mental-health / human burden",
        mental_measures,
        c(
          "K6 measures nonspecific psychological distress; PHQ-2 is a depressive-symptom screen.",
          "Neither is a psychiatric diagnosis, monetized burden, or causal Long COVID effect."
        )
      )
    ),
    evidence = list(),
    local_context = list(),
    qualitative_evidence = list(),
    scenario_examples = list(),
    data_requests = list(),
    sources = list(
      list(
        source_ref = "meps-hc256-2024",
        source_name = "MEPS HC-256: 2024 Full Year Consolidated Data File",
        official_url = "https://meps.ahrq.gov/data_stats/download_data_files_detail.jsp?cboPufNumber=HC-256",
        release_year = 2026,
        locator = "HC-256 documentation/codebook and analysis/r/config/meps_2024_variable_map.json",
        limitations = list(
          "Candidate estimates require methods review before release.",
          "MEPS represents the U.S. civilian noninstitutionalized population; this is not state-specific evidence."
        )
      )
    )
  )
}

write_candidate_bundle <- function(bundle, output_dir) {
  if (!requireNamespace("jsonlite", quietly = TRUE)) {
    stop("Package 'jsonlite' is required.", call. = FALSE)
  }
  dir.create(output_dir, recursive = TRUE, showWarnings = FALSE)
  path <- file.path(output_dir, "bundle.json")
  jsonlite::write_json(
    bundle, path,
    pretty = TRUE,
    auto_unbox = TRUE,
    null = "null",
    na = "null",
    digits = 15
  )
  path
}
