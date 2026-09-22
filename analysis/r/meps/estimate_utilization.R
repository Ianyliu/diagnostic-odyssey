source(file.path("analysis", "r", "lib", "meps_values.R"))
source(file.path("analysis", "r", "lib", "survey_helpers.R"))
source(file.path("analysis", "r", "lib", "result_helpers.R"))
source(file.path("analysis", "r", "meps", "cohort_long_covid.R"))
source(file.path("analysis", "r", "meps", "survey_designs.R"))

utilization_any <- function(x) {
  clean <- meps_nonnegative(x)
  ifelse(is.na(clean), NA_real_, as.numeric(clean > 0))
}

estimate_utilization <- function(designs, artifact_version) {
  domain <- current_long_covid_domain(designs$person)
  specs <- list(
    list(
      variable = "OBTOTV24",
      stem = "office-based-provider-visits",
      label = "Office-based provider visits",
      event = "office-based provider visit",
      unit = "visits/person/year"
    ),
    list(
      variable = "OPTOTV24",
      stem = "outpatient-provider-visits",
      label = "Outpatient department provider visits",
      event = "outpatient department provider visit",
      unit = "visits/person/year"
    ),
    list(
      variable = "ERTOT24",
      stem = "emergency-room-visits",
      label = "Emergency-room visits",
      event = "emergency-room visit",
      unit = "visits/person/year"
    ),
    list(
      variable = "IPDIS24",
      stem = "hospital-discharges",
      label = "Hospital discharges",
      event = "hospital discharge",
      unit = "discharges/person/year"
    )
  )

  records <- list()
  for (spec in specs) {
    source_url <- paste0(
      "https://meps.ahrq.gov/mepsweb/data_stats/download_data_files_codebook.jsp?",
      "PUFId=H256&varName=", spec$variable
    )
    mean_result <- survey_mean_result(
      domain, spec$variable, meps_nonnegative,
      designs$person, "full PERSON / PERWT24F survey design"
    )
    any_result <- survey_proportion_result(
      domain, spec$variable, utilization_any,
      designs$person, "full PERSON / PERWT24F survey design"
    )

    records[[length(records) + 1L]] <- make_estimate_record(
      mean_result,
      estimate_id = paste0("meps24-", spec$stem, "-mean"),
      measure_id = paste0(spec$stem, "-mean"),
      label = paste("Mean annual", tolower(spec$label)),
      unit = spec$unit,
      denominator = paste0(
        "Adults age 18-64 who met the operational current-Long-COVID definition at their Round 3/1 2024 interview, with valid ",
        spec$variable
      ),
      universe = "U.S. civilian noninstitutionalized population, adults age 18-64",
      system_boundary = "National annual all-cause health care utilization",
      source_locator = source_url,
      weight_variable = "PERWT24F",
      artifact_version = artifact_version,
      cohort_definition = cohort_definition_text(),
      allowed_interpretation = paste0(
        "Mean calendar-year 2024 all-cause ", tolower(spec$label),
        " among adults classified operational-current at their Round 3/1 interview in 2024."
      ),
      prohibited_interpretation = c(
        "utilization caused by Long COVID",
        "utilization caused by diagnostic delay",
        "avoidable utilization"
      ),
      limitations = c("Current-Long-COVID classification is point-in-time at the Round 3/1 2024 interview; calendar-year utilization may occur before or after that anchor and does not establish symptom persistence or event attribution.")
    )

    records[[length(records) + 1L]] <- make_estimate_record(
      any_result,
      estimate_id = paste0("meps24-", spec$stem, "-any"),
      measure_id = paste0(spec$stem, "-any"),
      label = paste0("Proportion with at least one ", spec$event),
      unit = "proportion",
      denominator = paste0(
        "Adults age 18-64 meeting operational current Long COVID definition with valid ",
        spec$variable
      ),
      universe = "U.S. civilian noninstitutionalized population, adults age 18-64",
      system_boundary = "National annual all-cause health care utilization",
      source_locator = source_url,
      weight_variable = "PERWT24F",
      artifact_version = artifact_version,
      cohort_definition = cohort_definition_text(),
      allowed_interpretation = paste0(
        "Share with at least one ", spec$event,
        " during calendar-year 2024 among adults classified operational-current at their Round 3/1 2024 interview."
      ),
      prohibited_interpretation = c(
        "utilization caused by Long COVID",
        "utilization caused by diagnostic delay",
        "avoidable utilization"
      ),
      limitations = c("Current-Long-COVID classification is point-in-time at the Round 3/1 2024 interview; calendar-year utilization may occur before or after that anchor and does not establish symptom persistence or event attribution.")
    )
  }
  records
}
