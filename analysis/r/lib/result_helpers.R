analysis_provenance <- function(weight_variable, source_locator, statistics_method, cohort_definition) {
  list(
    weight_variable = weight_variable,
    variance_stratum_variable = "VARSTR",
    variance_psu_variable = "VARPSU",
    source_locator = source_locator,
    statistics_method = statistics_method,
    cohort_definition = cohort_definition
  )
}

make_estimate_record <- function(
  result,
  estimate_id,
  measure_id,
  label,
  unit,
  denominator,
  universe,
  system_boundary,
  source_locator,
  weight_variable,
  artifact_version,
  cohort_definition,
  allowed_interpretation,
  prohibited_interpretation,
  limitations = character(),
  component_of_measure_id = NULL
) {
  record <- c(
    list(
      estimate_id = estimate_id,
      measure_id = measure_id,
      label = label,
      value = unname(result$value),
      unit = unit,
      interval_low = unname(result$interval_low),
      interval_high = unname(result$interval_high),
      interval_type = result$interval_type,
      denominator = denominator,
      universe = universe,
      system_boundary = system_boundary,
      evidence_type = "survey_estimate",
      release_status = "preliminary",
      display_status = "analytical_artifact",
      source_ref = "meps-hc256-2024",
      artifact_version = artifact_version,
      allowed_interpretation = allowed_interpretation,
      prohibited_interpretation = as.list(prohibited_interpretation),
      limitations = as.list(limitations),
      unweighted_n = as.integer(result$unweighted_n),
      weighted_denominator = unname(result$weighted_denominator),
      standard_error = unname(result$standard_error),
      component_of_measure_id = component_of_measure_id
    ),
    analysis_provenance(
      weight_variable = weight_variable,
      source_locator = source_locator,
      statistics_method = result$interval_type,
      cohort_definition = cohort_definition
    )
  )
  if (!is.null(result$unweighted_numerator_n)) {
    record$unweighted_numerator_n <- as.integer(result$unweighted_numerator_n)
  }
  record
}
