source(file.path("analysis", "r", "lib", "meps_values.R"))
source(file.path("analysis", "r", "lib", "survey_helpers.R"))
source(file.path("analysis", "r", "lib", "result_helpers.R"))
source(file.path("analysis", "r", "meps", "cohort_long_covid.R"))

estimate_represented_population <- function(designs, artifact_version) {
  # Domain estimation keeps the full MEPS survey design and then restricts to
  # age-eligible adults whose Long COVID/current-symptom status is classifiable.
  known_age_domain <- base::subset(
    designs$person,
    do_age_18_64 & do_current_long_covid_known
  )
  result <- survey_total_result(
    known_age_domain,
    "do_current_long_covid_indicator",
    cleaner = function(x) as.numeric(x),
    ci_reference_design = designs$person,
    ci_df_source = "full PERSON / PERWT24F survey design"
  )
  result$unweighted_numerator_n <- sum(
    known_age_domain$variables$do_current_long_covid_indicator == 1,
    na.rm = TRUE
  )

  make_estimate_record(
    result = result,
    estimate_id = "meps24-current-long-covid-population",
    measure_id = "represented-population",
    label = "Represented population with operational current Long COVID",
    unit = "people",
    denominator = "MEPS 2024 adults age 18-64 at AGE31X with classifiable route-aware Round 3/1 Long-COVID/current status",
    universe = "U.S. civilian noninstitutionalized population, adults age 18-64",
    system_boundary = "National descriptive population estimate",
    source_locator = paste0(
      "HC-256 PANEL + AGE31X + COVIDEVER31 + LCEVER31 + COVSYMNOW31; ",
      "https://meps.ahrq.gov/data_stats/download_data/pufs/h256/h256doc.shtml#2.5.5"
    ),
    weight_variable = "PERWT24F",
    artifact_version = artifact_version,
      cohort_definition = cohort_definition_text(),
    allowed_interpretation = paste(
      "Survey-weighted number of U.S. civilian noninstitutionalized adults age 18-64",
      "meeting the documented operational Round 3/1 2024 current-Long-COVID rule."
    ),
    prohibited_interpretation = c(
      "state-specific Long COVID prevalence",
      "diagnostic-delay population",
      "causal burden"
    ),
    limitations = c(
      "COVSYMNOW31 wording refers to COVID-19 or Long COVID-19 symptoms now; use is conditional on route-aware established Long-COVID history.",
      "AGE31X anchors age to the same Round 3/1 interview; AGE24X is diagnostic only.",
      "Structural PE skips are interpreted by questionnaire routing; RF/DK and unexpected downstream inapplicability remain unresolved."
    )
  )
}
