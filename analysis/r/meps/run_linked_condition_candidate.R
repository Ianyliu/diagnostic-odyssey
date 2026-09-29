#!/usr/bin/env Rscript

source(file.path("analysis", "r", "meps", "bootstrap.R"))
source(file.path("analysis", "r", "meps", "linked_condition_candidate_serialization.R"))

required_packages <- c("haven", "jsonlite", "survey")
missing_packages <- required_packages[!vapply(required_packages, requireNamespace, logical(1), quietly = TRUE)]
if (length(missing_packages)) {
  stop("Missing R packages: ", paste(missing_packages, collapse = ", "), call. = FALSE)
}

args <- commandArgs(trailingOnly = TRUE)
output_arg <- grep("^--output=", args, value = TRUE)
output_dir <- if (length(output_arg)) {
  sub("^--output=", "", output_arg[[1]])
} else {
  repo_path("artifacts", "generated", "meps-2024-linked-condition-candidate")
}
dir.create(output_dir, recursive = TRUE, showWarnings = FALSE)

raw_dir <- repo_path("data", "raw", "meps", "2024", "linked-condition")
cfg <- read_linked_condition_source_config()
source_by_puf <- function(puf_id) {
  hit <- Filter(function(x) identical(x$puf_id, puf_id), cfg$sources)
  if (length(hit) != 1L) stop("Source registry does not uniquely define ", puf_id, ".", call. = FALSE)
  hit[[1]]
}
read_puf <- function(puf_id) {
  source <- source_by_puf(puf_id)
  path <- file.path(raw_dir, source$expected_data_filename)
  if (!file.exists(path)) stop("Missing governed analytical source file: ", path, call. = FALSE)
  x <- normalize_meps_names(haven::read_dta(path))
  validate_required_variables(x, source)
  x
}

hc256 <- load_hc256()
hc256_path <- attr(hc256, "hc256_path")
if (is.null(hc256_path) || !nzchar(hc256_path) || !file.exists(hc256_path)) {
  stop("HC-256 loader did not preserve a valid input path.", call. = FALSE)
}
hc256 <- construct_long_covid_cohort(hc256)

conditions <- read_puf("HC-255")
links <- read_puf("HC-254I")
event_files <- list(
  office = read_puf("HC-254G"),
  outpatient = read_puf("HC-254F"),
  emergency = read_puf("HC-254E"),
  inpatient = read_puf("HC-254D")
)

quality <- validate_linkage_invariants(conditions, links, event_files)
footprint <- derive_u09_event_footprint(conditions, links, event_files)
combined <- collapse_u09_to_hc256(hc256, footprint)
combined <- derive_u09_person_service_use(combined, footprint)

person_design <- build_meps_design(combined, "PERWT24F")
design_integrity <- assert_linked_condition_candidate_design_integrity(combined, person_design)
candidates <- estimate_linked_condition_service_use(person_design)

target <- design_integrity$governed_target
target_data <- combined[target, , drop = FALSE]
target_ids <- as.character(target_data$DUPERSID)
target_events <- footprint$unique_u09_events[
  as.character(footprint$unique_u09_events$DUPERSID) %in% target_ids,
  ,
  drop = FALSE
]
family_counts <- as.list(table(factor(
  target_events$event_family,
  levels = linked_condition_service_use_families()
)))
family_counts <- lapply(family_counts, as.integer)

all_link_key <- paste(as.character(links$DUPERSID), as.character(links$EVNTIDX), sep = "::")
u09_event_keys <- paste(
  footprint$unique_u09_events$DUPERSID,
  footprint$unique_u09_events$EVNTIDX,
  sep = "::"
)
all_u09_links <- links[all_link_key %in% u09_event_keys, , drop = FALSE]
u09_link_condition_codes <- setNames(
  toupper(trimws(as.character(conditions$ICD10CDX))),
  as.character(conditions$CONDIDX)
)
multiplicity_n <- count_qualifying_u09_events_with_additional_non_u09_links(
  all_u09_links,
  u09_link_condition_codes
)

target_support <- survey_representation_support(combined, target, "governed target domain")
weighted_target_denominator <- sum(as.numeric(target_data$PERWT24F), na.rm = TRUE)

expected <- list(
  target_n = 380L,
  target_nonzero_person_n = 22L,
  target_zero_person_n = 358L,
  target_unique_events_n = 109L,
  family_counts = as_linked_condition_family_count_object(c(
    office = 86L,
    outpatient = 21L,
    emergency = 2L,
    inpatient = 0L
  )),
  overall_unique_events_n = 259L,
  multiplicity_n = 116L,
  represented_strata_n = 99L,
  represented_stratum_psu_pairs_n = 185L,
  weighted_target_denominator = 6831165.1075,
  weighted_target_denominator_tolerance = 0.001
)

actual <- list(
  target_n = nrow(target_data),
  target_nonzero_person_n = sum(target_data$do_has_u09_linked_event),
  target_zero_person_n = sum(!target_data$do_has_u09_linked_event),
  target_unique_events_n = nrow(target_events),
  family_counts = as_linked_condition_family_count_object(family_counts),
  overall_unique_events_n = nrow(footprint$unique_u09_events),
  multiplicity_n = multiplicity_n,
  represented_strata_n = target_support$represented_strata_n,
  represented_stratum_psu_pairs_n = target_support$represented_stratum_psu_pairs_n,
  weighted_target_denominator = weighted_target_denominator
)

for (field in c(
  "target_n", "target_nonzero_person_n", "target_zero_person_n",
  "target_unique_events_n", "overall_unique_events_n", "multiplicity_n",
  "represented_strata_n", "represented_stratum_psu_pairs_n"
)) {
  if (!identical(as.integer(actual[[field]]), as.integer(expected[[field]]))) {
    stop("Reviewed Issue #20 reconciliation failed for ", field, call. = FALSE)
  }
}
if (!identical(
  unlist(actual$family_counts, use.names = TRUE),
  unlist(expected$family_counts, use.names = TRUE)
)) {
  stop("Reviewed Issue #20 family-count reconciliation failed.", call. = FALSE)
}
if (
  !is.finite(weighted_target_denominator) ||
    abs(weighted_target_denominator - expected$weighted_target_denominator) >
      expected$weighted_target_denominator_tolerance
) {
  stop("Reviewed Issue #20 weighted target denominator reconciliation failed.", call. = FALSE)
}

generated_at <- format(Sys.time(), tz = "UTC", format = "%Y-%m-%dT%H:%M:%SZ")
code_commit <- tryCatch(
  trimws(system("git rev-parse HEAD", intern = TRUE, ignore.stderr = TRUE)[[1]]),
  error = function(e) "unknown"
)
github_sha <- Sys.getenv("GITHUB_SHA", unset = "")
assert_code_commit_matches_github_sha(code_commit, github_sha)

candidate_file <- list(
  schema_version = "1.0",
  artifact_family = "linked_condition_service_use_candidate",
  status = "preliminary-candidate-only",
  generated_at = generated_at,
  code_commit = code_commit,
  candidates = unname(candidates)
)
candidate_path <- file.path(output_dir, "linked-condition-candidate-estimates.json")
jsonlite::write_json(
  candidate_file,
  candidate_path,
  pretty = TRUE,
  auto_unbox = TRUE,
  null = "null",
  na = "null",
  digits = 15
)

diagnostics <- list(
  status = "preliminary-candidate-only",
  code_commit = code_commit,
  github_sha = if (nzchar(github_sha)) github_sha else NULL,
  code_commit_matches_github_sha = if (nzchar(github_sha)) TRUE else NULL,
  design_integrity = design_integrity[names(design_integrity) != "governed_target"],
  full_person_design = survey_design_psu_diagnostics(
    person_design,
    "full PERSON / PERWT24F survey design"
  ),
  target_support = target_support,
  reconciliation = list(
    expected = expected,
    actual = actual,
    passed = TRUE
  ),
  linkage_quality = quality,
  reliability = list(
    status = "not_adjudicated",
    rule_version = NULL,
    rule_reviewed = FALSE,
    release_eligible = FALSE
  ),
  scientific_guardrails = as.list(linked_condition_guardrails())
)
diagnostics_path <- file.path(output_dir, "diagnostics.json")
jsonlite::write_json(
  diagnostics,
  diagnostics_path,
  pretty = TRUE,
  auto_unbox = TRUE,
  null = "null",
  na = "null",
  digits = 15
)

manifest <- list(
  schema_version = "1.0",
  artifact_family = "linked_condition_service_use_candidate",
  status = "preliminary-candidate-only",
  candidate_estimates_generated = TRUE,
  automatic_release = FALSE,
  runtime_eligible = FALSE,
  runtime_selection_changed = FALSE,
  reviewed_artifact_modified = FALSE,
  reliability_rule_reviewed = FALSE,
  code_commit = code_commit,
  github_sha = if (nzchar(github_sha)) github_sha else NULL,
  code_commit_matches_github_sha = if (nzchar(github_sha)) TRUE else NULL,
  estimates_file = "linked-condition-candidate-estimates.json",
  diagnostics_file = "diagnostics.json",
  hc256_source_metadata_file = "hc256-source-metadata.json",
  linked_condition_source_metadata_file = "linked-condition-source-metadata.json"
)
manifest_path <- file.path(output_dir, "candidate-manifest.json")
jsonlite::write_json(
  manifest,
  manifest_path,
  pretty = TRUE,
  auto_unbox = TRUE,
  null = "null"
)

hc256_metadata <- repo_path("data", "raw", "meps", "2024", "hc256_source_metadata.json")
linked_metadata <- file.path(raw_dir, "linked-condition-source-metadata.json")
for (path in c(hc256_metadata, linked_metadata)) {
  if (!file.exists(path) || file.info(path)$size <= 0) {
    stop("Required source metadata missing: ", path, call. = FALSE)
  }
}
if (!file.copy(hc256_metadata, file.path(output_dir, "hc256-source-metadata.json"), overwrite = TRUE)) {
  stop("Failed to copy HC-256 source metadata.", call. = FALSE)
}
if (!file.copy(linked_metadata, file.path(output_dir, "linked-condition-source-metadata.json"), overwrite = TRUE)) {
  stop("Failed to copy linked-condition source metadata.", call. = FALSE)
}

node <- Sys.which("node")
if (!nzchar(node)) stop("Node 22+ is required to validate candidate outputs.", call. = FALSE)
validation_status <- system2(
  node,
  c(
    "--experimental-strip-types",
    repo_path("packages", "contracts", "src", "validate-linked-condition-candidate-cli.ts"),
    candidate_path,
    manifest_path,
    diagnostics_path
  )
)
if (!identical(validation_status, 0L)) {
  stop("Generated linked-condition candidate failed TypeScript validation.", call. = FALSE)
}

message("Linked-condition candidate estimates generated for methods review only.")
message("No ArtifactBundle output was generated.")
message("No release/runtime eligibility was granted.")
