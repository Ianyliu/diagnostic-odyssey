#!/usr/bin/env Rscript

source(file.path("analysis", "r", "meps", "bootstrap.R"))

if (!requireNamespace("haven", quietly = TRUE) || !requireNamespace("jsonlite", quietly = TRUE)) {
  stop("Run Rscript analysis/r/install_dependencies.R first.", call. = FALSE)
}

args <- commandArgs(trailingOnly = TRUE)
output_arg <- grep("^--output=", args, value = TRUE)
output_dir <- if (length(output_arg)) {
  sub("^--output=", "", output_arg[[1]])
} else {
  repo_path("artifacts", "generated", "meps-2024-linked-condition-feasibility")
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
  attr(x, "do_source_path") <- path
  x
}

hc256 <- load_hc256()
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

target <- !is.na(combined$do_current_long_covid) &
  combined$do_current_long_covid &
  combined$do_age_18_64 &
  !is.na(combined$PERWT24F) &
  as.numeric(combined$PERWT24F) > 0

target_data <- combined[target, , drop = FALSE]
target_ids <- as.character(target_data$DUPERSID)
target_u09_conditions <- footprint$u09_conditions[
  as.character(footprint$u09_conditions$DUPERSID) %in% target_ids,
  ,
  drop = FALSE
]
target_u09_events <- footprint$unique_u09_events[
  footprint$unique_u09_events$DUPERSID %in% target_ids,
  ,
  drop = FALSE
]

all_link_key <- paste(as.character(links$DUPERSID), as.character(links$EVNTIDX), sep = "::")
conditions_per_event <- table(all_link_key)
events_per_condition <- table(as.character(links$CONDIDX))

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
qualifying_event_has_non_u09 <- tapply(
  as.character(all_u09_links$CONDIDX),
  paste(as.character(all_u09_links$DUPERSID), as.character(all_u09_links$EVNTIDX), sep = "::"),
  function(ids) any(unname(u09_link_condition_codes[ids]) != "U09", na.rm = TRUE)
)

distribution_summary <- function(x) {
  x <- as.numeric(x)
  if (!length(x)) {
    return(list(n = 0L, min = NULL, p25 = NULL, median = NULL, p75 = NULL, max = NULL))
  }
  q <- stats::quantile(x, c(0, .25, .5, .75, 1), names = FALSE, type = 1)
  list(
    n = length(x),
    min = unname(q[[1]]),
    p25 = unname(q[[2]]),
    median = unname(q[[3]]),
    p75 = unname(q[[4]]),
    max = unname(q[[5]])
  )
}

event_family_counts <- as.list(table(factor(
  target_u09_events$event_family,
  levels = c("office", "outpatient", "emergency", "inpatient")
)))
event_family_counts <- lapply(event_family_counts, as.integer)

source_rows <- c(
  "HC-255" = nrow(conditions),
  "HC-254I" = nrow(links),
  "HC-254G" = nrow(event_files$office),
  "HC-254F" = nrow(event_files$outpatient),
  "HC-254E" = nrow(event_files$emergency),
  "HC-254D" = nrow(event_files$inpatient),
  "HC-256" = nrow(hc256)
)

source_metadata_path <- file.path(raw_dir, "linked-condition-source-metadata.json")
if (!file.exists(source_metadata_path)) {
  stop("Linked-condition source metadata is missing.", call. = FALSE)
}
source_metadata <- jsonlite::fromJSON(source_metadata_path, simplifyVector = FALSE)

specialty_counts <- function(x, family) {
  x <- normalize_meps_names(x)
  ids <- target_u09_events$EVNTIDX[target_u09_events$event_family == family]
  y <- x[as.character(x$EVNTIDX) %in% ids, , drop = FALSE]
  out <- list(event_n = nrow(y))
  for (field in c("MEDPTYPE_M18", "DRSPLTY_M18")) {
    if (field %in% names(y)) {
      tab <- sort(table(as.character(y[[field]]), useNA = "ifany"), decreasing = TRUE)
      out[[tolower(field)]] <- as.list(as.integer(tab))
      names(out[[tolower(field)]]) <- names(tab)
    }
  }
  out
}

psu_keys <- unique(paste(target_data$VARSTR, target_data$VARPSU, sep = "::"))

diagnostics <- list(
  status = "preliminary-feasibility-only",
  product_estimates_generated = FALSE,
  spending_estimator_present = FALSE,
  bundle_generated = FALSE,
  runtime_selection_changed = FALSE,
  reviewed_artifact_modified = FALSE,
  generated_at = format(Sys.time(), tz = "UTC", format = "%Y-%m-%dT%H:%M:%SZ"),
  code_commit = tryCatch(
    trimws(system("git rev-parse HEAD", intern = TRUE, ignore.stderr = TRUE)[[1]]),
    error = function(e) "unknown"
  ),
  scientific_target = paste(
    "Observed 2024 U09-linked healthcare-event footprint within the existing",
    "HC-256 operational-current Long-COVID cohort; descriptive feasibility only."
  ),
  guardrails = as.list(linked_condition_guardrails()),
  source_integrity = list(
    metadata_status = source_metadata$status,
    sources = source_metadata$sources,
    rows_per_source = as.list(as.integer(source_rows))
  ),
  hc255 = list(
    total_condition_records = nrow(conditions),
    u09_condition_record_count = nrow(footprint$u09_conditions),
    unique_u09_person_count = length(unique(as.character(footprint$u09_conditions$DUPERSID))),
    duplicate_u09_code_person_patterns = sum(duplicated(paste(
      footprint$u09_conditions$DUPERSID,
      footprint$u09_conditions$ICD10CDX,
      sep = "::"
    )))
  ),
  hc256_overlap = list(
    target_operational_current_long_covid_adult_18_64_n = nrow(target_data),
    target_persons_with_u09_condition_n = sum(target_data$do_has_u09_condition),
    target_persons_without_u09_condition_n = sum(!target_data$do_has_u09_condition),
    unique_u09_persons_overlapping_target_n = length(unique(as.character(target_u09_conditions$DUPERSID)))
  ),
  linkage = list(
    total_u09_condition_event_links = nrow(footprint$u09_links),
    unique_u09_linked_events = nrow(footprint$unique_u09_events),
    target_unique_u09_linked_events = nrow(target_u09_events),
    target_u09_linked_events_by_family = event_family_counts,
    target_persons_with_qualifying_linked_event_n = sum(target_data$do_has_u09_linked_event),
    target_persons_without_qualifying_linked_event_n = sum(!target_data$do_has_u09_linked_event)
  ),
  multiplicity = list(
    conditions_per_event = distribution_summary(conditions_per_event),
    events_per_condition = distribution_summary(events_per_condition),
    events_with_multiple_condition_links_n = sum(conditions_per_event > 1),
    qualifying_u09_events_with_additional_non_u09_condition_links_n =
      sum(qualifying_event_has_non_u09, na.rm = TRUE)
  ),
  link_quality = quality,
  survey_feasibility = list(
    target_positive_perwt24f_n = sum(!is.na(target_data$PERWT24F) & as.numeric(target_data$PERWT24F) > 0),
    target_missing_varstr_n = sum(is.na(target_data$VARSTR)),
    target_missing_varpsu_n = sum(is.na(target_data$VARPSU)),
    unweighted_target_person_n = nrow(target_data),
    weighted_target_denominator = sum(as.numeric(target_data$PERWT24F), na.rm = TRUE),
    represented_strata_n = length(unique(target_data$VARSTR[!is.na(target_data$VARSTR)])),
    represented_stratum_psu_pairs_n = length(psu_keys[!grepl("NA", psu_keys, fixed = TRUE)])
  ),
  specialty_feasibility = list(
    office = specialty_counts(event_files$office, "office"),
    outpatient = specialty_counts(event_files$outpatient, "outpatient")
  ),
  phase_a_decision_gate = list(
    release_decision_made = FALSE,
    release_threshold_invented = FALSE,
    next_step = "independent methods review of real-data diagnostics before any estimator implementation"
  )
)

jsonlite::write_json(
  diagnostics,
  file.path(output_dir, "diagnostics.json"),
  pretty = TRUE,
  auto_unbox = TRUE,
  null = "null"
)

feasibility_manifest <- list(
  status = "preliminary-feasibility-only",
  automatic_release = FALSE,
  product_estimates_generated = FALSE,
  runtime_selection_changed = FALSE,
  reviewed_artifact_modified = FALSE,
  bundle_generated = FALSE,
  spending_estimator_present = FALSE,
  hc256_cohort_definition_reused = TRUE,
  hc256_cohort_definition_text = cohort_definition_text(),
  source_registry = "analysis/r/config/meps_linked_condition_sources.json",
  diagnostics = "diagnostics.json",
  review_required = TRUE
)

jsonlite::write_json(
  feasibility_manifest,
  file.path(output_dir, "feasibility-manifest.json"),
  pretty = TRUE,
  auto_unbox = TRUE,
  null = "null"
)

message("Linked-condition feasibility diagnostics written to: ", output_dir)
