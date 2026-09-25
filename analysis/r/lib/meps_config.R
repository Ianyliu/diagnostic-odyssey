meps_variable_map_path <- function() {
  repo_path("analysis", "r", "config", "meps_2024_variable_map.json")
}

assert_meps_nonempty_string <- function(value, label) {
  if (
    !is.character(value) ||
      length(value) != 1L ||
      is.na(value) ||
      !nzchar(trimws(value))
  ) {
    stop(label, " must be a non-blank string.", call. = FALSE)
  }
  value
}

load_meps_variable_map <- function(path = meps_variable_map_path()) {
  if (!requireNamespace("jsonlite", quietly = TRUE)) {
    stop(
      "Package 'jsonlite' is required. Run Rscript analysis/r/install_dependencies.R",
      call. = FALSE
    )
  }

  variable_map <- jsonlite::fromJSON(path, simplifyVector = FALSE)
  if (!is.list(variable_map) || !is.list(variable_map$measures)) {
    stop("Reviewed MEPS variable map is missing its measures list.", call. = FALSE)
  }
  variable_map
}

# Backward-compatible alias retained for callers/tests that used the original loader.
load_variable_map <- function() load_meps_variable_map()

get_meps_measure_spec <- function(id, variable_map = load_meps_variable_map()) {
  assert_meps_nonempty_string(id, "MEPS config measure id")

  matches <- which(vapply(
    variable_map$measures,
    function(spec) is.list(spec) && identical(spec$id, id),
    logical(1)
  ))
  if (length(matches) != 1L) {
    stop(
      "Reviewed MEPS config id '", id,
      "' must resolve exactly once; found ", length(matches), ".",
      call. = FALSE
    )
  }

  spec <- variable_map$measures[[matches[[1]]]]
  assert_meps_nonempty_string(
    spec$source_locator,
    paste0("Reviewed MEPS config id '", id, "' source_locator")
  )
  spec
}

get_meps_measure_source_locator <- function(id, variable_map = load_meps_variable_map()) {
  get_meps_measure_spec(id, variable_map)$source_locator
}

get_meps_provenance_reference <- function(
  key,
  variable_map = load_meps_variable_map()
) {
  assert_meps_nonempty_string(key, "MEPS provenance reference key")

  references <- variable_map$provenance_references
  if (
    is.null(references) ||
      !is.list(references) ||
      is.null(references[[key]])
  ) {
    stop(
      "Reviewed MEPS provenance reference '", key, "' is missing.",
      call. = FALSE
    )
  }

  assert_meps_nonempty_string(
    references[[key]],
    paste0("Reviewed MEPS provenance reference '", key, "'")
  )
}

meps_population_source_locator <- function(variable_map = load_meps_variable_map()) {
  paste0(
    "HC-256 PANEL + AGE31X + COVIDEVER31 + LCEVER31 + COVSYMNOW31; ",
    get_meps_provenance_reference(
      "cohort_routing_documentation",
      variable_map
    )
  )
}

meps_esaq_time_source_locator <- function(
  measure_id,
  variable_map = load_meps_variable_map()
) {
  spec <- get_meps_measure_spec(measure_id, variable_map)
  paste0(
    "HC-256 ", spec$variable, "; ESAQ time-cost documentation: ",
    get_meps_provenance_reference(
      "esaq_time_cost_documentation",
      variable_map
    )
  )
}

meps_prior_approval_source_locator <- function(
  variable_map = load_meps_variable_map()
) {
  spec <- get_meps_measure_spec(
    "prior_approval_denied_delayed",
    variable_map
  )
  paste0(
    "HC-256 ", spec$variable, " codebook and ESAQ documentation: ",
    spec$source_locator
  )
}

meps_k6_serious_source_locator <- function(
  variable_map = load_meps_variable_map()
) {
  paste(
    get_meps_measure_source_locator("k6_score", variable_map),
    paste0(
      "AHRQ example classification: ",
      get_meps_provenance_reference(
        "k6_serious_distress_classification",
        variable_map
      )
    ),
    sep = "; "
  )
}

meps_phq2_positive_source_locator <- function(
  variable_map = load_meps_variable_map()
) {
  cut_point_reference <- get_meps_provenance_reference(
    "phq2_screening_cut_point",
    variable_map
  )
  section <- sub("^.*#", "", cut_point_reference)
  if (identical(section, cut_point_reference) || !nzchar(section)) {
    stop(
      "Reviewed MEPS provenance reference 'phq2_screening_cut_point' ",
      "must include a documentation anchor.",
      call. = FALSE
    )
  }

  paste(
    get_meps_measure_source_locator("phq2_score", variable_map),
    paste0(
      "HC-256 documentation §", section,
      " cites score 3 as the screening cut point"
    ),
    sep = "; "
  )
}
