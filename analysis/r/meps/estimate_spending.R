estimate_spending <- function(designs, artifact_version) {
  domain <- current_long_covid_domain(designs$person)
  total_url <- get_meps_measure_source_locator("gross_spending_total")
  oop_url <- get_meps_measure_source_locator("oop_spending_total")

  ci_ref <- designs$person
  ci_source <- "full PERSON / PERWT24F survey design"
  total_spend <- survey_total_result(domain, "TOTEXP24", meps_nonnegative, ci_ref, ci_source)
  mean_spend <- survey_mean_result(domain, "TOTEXP24", meps_nonnegative, ci_ref, ci_source)
  total_oop <- survey_total_result(domain, "TOTSLF24", meps_nonnegative, ci_ref, ci_source)
  mean_oop <- survey_mean_result(domain, "TOTSLF24", meps_nonnegative, ci_ref, ci_source)

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
      denominator = "Adults age 18-64 who met the operational current-Long-COVID definition at their Round 3/1 2024 interview, with valid TOTEXP24",
      universe = "U.S. civilian noninstitutionalized population, adults age 18-64",
      system_boundary = "National all-cause health care expenditures",
      source_locator = total_url,
      weight_variable = "PERWT24F",
      artifact_version = artifact_version,
      cohort_definition = cohort_definition_text(),
      allowed_interpretation = "Calendar-year 2024 gross all-cause health care spending among adults age 18-64 who met the operational current-Long-COVID definition at their Round 3/1 interview in 2024.",
      prohibited_interpretation = common_prohibited,
      limitations = c(
        "Current-Long-COVID classification is point-in-time at the Round 3/1 2024 interview and does not establish that symptoms persisted throughout calendar year 2024.",
        "Calendar-year expenditures may occur before or after the status interview and are not restricted to periods when symptoms were present.",
        "Descriptive gross spending; no counterfactual comparator or attributable-cost design."
      )
    ),
    make_estimate_record(
      mean_spend,
      estimate_id = "meps24-gross-all-cause-spending-mean",
      measure_id = "gross-all-cause-spending-mean",
      label = "Mean annual all-cause medical spending per person",
      unit = "USD/person/year",
      denominator = "Adults age 18-64 who met the operational current-Long-COVID definition at their Round 3/1 2024 interview, with valid TOTEXP24",
      universe = "U.S. civilian noninstitutionalized population, adults age 18-64",
      system_boundary = "National all-cause health care expenditures",
      source_locator = total_url,
      weight_variable = "PERWT24F",
      artifact_version = artifact_version,
      cohort_definition = cohort_definition_text(),
      allowed_interpretation = "Mean calendar-year 2024 all-cause health care spending among adults age 18-64 who met the operational current-Long-COVID definition at their Round 3/1 interview in 2024.",
      prohibited_interpretation = common_prohibited,
      limitations = c(
        "Current-Long-COVID classification is point-in-time at the Round 3/1 2024 interview and does not establish that symptoms persisted throughout calendar year 2024.",
        "Calendar-year expenditures may occur before or after the status interview and are not restricted to periods when symptoms were present.",
        "Descriptive gross spending; no counterfactual comparator or attributable-cost design."
      )
    ),
    make_estimate_record(
      total_oop,
      estimate_id = "meps24-out-of-pocket-spending-total",
      measure_id = "out-of-pocket-spending-total",
      label = "Out-of-pocket annual spending component",
      unit = "USD/year",
      denominator = "Adults age 18-64 who met the operational current-Long-COVID definition at their Round 3/1 2024 interview, with valid TOTSLF24",
      universe = "U.S. civilian noninstitutionalized population, adults age 18-64",
      system_boundary = "National all-cause health care expenditures; source-of-payment component",
      source_locator = oop_url,
      weight_variable = "PERWT24F",
      artifact_version = artifact_version,
      cohort_definition = cohort_definition_text(),
      allowed_interpretation = "Self/family-paid component of calendar-year 2024 all-cause spending among adults classified operational-current at the Round 3/1 2024 interview.",
      prohibited_interpretation = c(common_prohibited, "additional spending to add to TOTEXP24"),
      limitations = c(
        "Current-Long-COVID classification is point-in-time at the Round 3/1 2024 interview; annual spending may precede or follow that anchor.",
        "TOTSLF24 is nested within total expenditures and must never be re-added to TOTEXP24."
      ),
      component_of_measure_id = "gross-all-cause-spending-total"
    ),
    make_estimate_record(
      mean_oop,
      estimate_id = "meps24-out-of-pocket-spending-mean",
      measure_id = "out-of-pocket-spending-mean",
      label = "Mean out-of-pocket annual spending per person",
      unit = "USD/person/year",
      denominator = "Adults age 18-64 who met the operational current-Long-COVID definition at their Round 3/1 2024 interview, with valid TOTSLF24",
      universe = "U.S. civilian noninstitutionalized population, adults age 18-64",
      system_boundary = "National all-cause health care expenditures; source-of-payment component",
      source_locator = oop_url,
      weight_variable = "PERWT24F",
      artifact_version = artifact_version,
      cohort_definition = cohort_definition_text(),
      allowed_interpretation = "Mean self/family-paid component of calendar-year 2024 spending among adults classified operational-current at the Round 3/1 2024 interview.",
      prohibited_interpretation = c(common_prohibited, "additional spending to add to mean TOTEXP24"),
      limitations = c(
        "Current-Long-COVID classification is point-in-time at the Round 3/1 2024 interview; annual spending may precede or follow that anchor.",
        "TOTSLF24 is a component of total expenditures, not an additive burden category."
      ),
      component_of_measure_id = "gross-all-cause-spending-mean"
    )
  )
}
