source(file.path("analysis", "r", "lib", "meps_values.R"))
source(file.path("analysis", "r", "lib", "survey_helpers.R"))
source(file.path("analysis", "r", "lib", "result_helpers.R"))
source(file.path("analysis", "r", "meps", "cohort_long_covid.R"))
source(file.path("analysis", "r", "meps", "survey_designs.R"))

estimate_spending <- function(designs, artifact_version) {
  domain <- current_long_covid_domain(designs$person)
  total_url <- "https://meps.ahrq.gov/mepsweb/data_stats/download_data_files_codebook.jsp?PUFId=H256&varName=TOTEXP24"
  oop_url <- "https://meps.ahrq.gov/mepsweb/data_stats/download_data_files_codebook.jsp?PUFId=H256&varName=TOTSLF24"

  total_spend <- survey_total_result(domain, "TOTEXP24", meps_nonnegative)
  mean_spend <- survey_mean_result(domain, "TOTEXP24", meps_nonnegative)
  total_oop <- survey_total_result(domain, "TOTSLF24", meps_nonnegative)
  mean_oop <- survey_mean_result(domain, "TOTSLF24", meps_nonnegative)

  common_prohibited <- c(
    "cost caused by Long COVID",
    "cost of diagnostic delay",
    "preventable spending",
    "savings opportunity",
    "state-specific spending"
  )

  list(
    make_estimate_record(
      total_spend,
      estimate_id = "meps24-gross-all-cause-spending-total",
      measure_id = "gross-all-cause-spending-total",
      label = "Gross annual all-cause medical spending",
      unit = "USD/year",
      denominator = "Adults age 18-64 meeting operational current Long COVID definition with valid TOTEXP24",
      universe = "U.S. civilian noninstitutionalized population, adults age 18-64",
      system_boundary = "National all-cause health care expenditures",
      source_locator = total_url,
      weight_variable = "PERWT24F",
      artifact_version = artifact_version,
      cohort_definition = cohort_definition_text(),
      allowed_interpretation = "Gross annual all-cause health care spending among adults meeting the operational current Long COVID definition.",
      prohibited_interpretation = common_prohibited,
      limitations = c("Descriptive gross spending; no counterfactual comparator or attributable-cost design.")
    ),
    make_estimate_record(
      mean_spend,
      estimate_id = "meps24-gross-all-cause-spending-mean",
      measure_id = "gross-all-cause-spending-mean",
      label = "Mean annual all-cause medical spending per person",
      unit = "USD/person/year",
      denominator = "Adults age 18-64 meeting operational current Long COVID definition with valid TOTEXP24",
      universe = "U.S. civilian noninstitutionalized population, adults age 18-64",
      system_boundary = "National all-cause health care expenditures",
      source_locator = total_url,
      weight_variable = "PERWT24F",
      artifact_version = artifact_version,
      cohort_definition = cohort_definition_text(),
      allowed_interpretation = "Mean annual all-cause health care spending per cohort member.",
      prohibited_interpretation = common_prohibited,
      limitations = c("Descriptive gross spending; no counterfactual comparator or attributable-cost design.")
    ),
    make_estimate_record(
      total_oop,
      estimate_id = "meps24-out-of-pocket-spending-total",
      measure_id = "out-of-pocket-spending-total",
      label = "Out-of-pocket annual spending component",
      unit = "USD/year",
      denominator = "Adults age 18-64 meeting operational current Long COVID definition with valid TOTSLF24",
      universe = "U.S. civilian noninstitutionalized population, adults age 18-64",
      system_boundary = "National all-cause health care expenditures; source-of-payment component",
      source_locator = oop_url,
      weight_variable = "PERWT24F",
      artifact_version = artifact_version,
      cohort_definition = cohort_definition_text(),
      allowed_interpretation = "Self/family-paid component of gross annual all-cause spending in the cohort.",
      prohibited_interpretation = c(common_prohibited, "additional spending to add to TOTEXP24"),
      limitations = c("TOTSLF24 is nested within total expenditures and must never be re-added to TOTEXP24."),
      component_of_measure_id = "gross-all-cause-spending-total"
    ),
    make_estimate_record(
      mean_oop,
      estimate_id = "meps24-out-of-pocket-spending-mean",
      measure_id = "out-of-pocket-spending-mean",
      label = "Mean out-of-pocket annual spending per person",
      unit = "USD/person/year",
      denominator = "Adults age 18-64 meeting operational current Long COVID definition with valid TOTSLF24",
      universe = "U.S. civilian noninstitutionalized population, adults age 18-64",
      system_boundary = "National all-cause health care expenditures; source-of-payment component",
      source_locator = oop_url,
      weight_variable = "PERWT24F",
      artifact_version = artifact_version,
      cohort_definition = cohort_definition_text(),
      allowed_interpretation = "Mean self/family-paid component per cohort member.",
      prohibited_interpretation = c(common_prohibited, "additional spending to add to mean TOTEXP24"),
      limitations = c("TOTSLF24 is a component of total expenditures, not an additive burden category."),
      component_of_measure_id = "gross-all-cause-spending-mean"
    )
  )
}
