estimate_admin_burden <- function(designs, artifact_version) {
  domain <- current_long_covid_domain(designs$esaq)

  time_specs <- list(
    list(
      config_id = "own_medical_time",
      variable = "EQMVAM53",
      measure_id = "own-medical-visit-time",
      label = "Annualized time on own medical visits / filling prescriptions",
      maximum = 2080,
      detail = "own medical visits and filling prescriptions"
    ),
    list(
      config_id = "medical_bills_time",
      variable = "EQMBAM53",
      measure_id = "medical-bills-insurance-time",
      label = "Annualized time managing medical bills / insurance",
      maximum = 720,
      detail = "paying or managing medical bills and insurance"
    ),
    list(
      config_id = "paperwork_time",
      variable = "EQPPAM53",
      measure_id = "healthcare-paperwork-time",
      label = "Annualized health care paperwork / navigation time",
      maximum = 520,
      detail = "paperwork, finding doctors, plan information, and approvals"
    )
  )

  records <- list()
  for (spec in time_specs) {
    result <- survey_mean_result(
      domain,
      spec$variable,
      cleaner = function(x) meps_bounded_score(x, 0, spec$maximum),
      ci_reference_design = designs$esaq,
      ci_df_source = "full ESAQ / ESAQWT24F survey design"
    )
    records[[length(records) + 1L]] <- make_estimate_record(
      result,
      estimate_id = paste0("meps24-", spec$measure_id, "-mean"),
      measure_id = spec$measure_id,
      label = spec$label,
      unit = "hours/person/year",
      denominator = paste0(
        "Adults age 18-64 classified operational-current at the earlier Round 3/1 2024 interview, with later ESAQ administration in Panel 28 Round 5 / Panel 29 Round 3, ESAQELIG=1, positive ESAQWT24F, ",
        "and valid ", spec$variable
      ),
      universe = "U.S. civilian noninstitutionalized adult ESAQ respondent population",
      system_boundary = "National healthcare-work / administrative burden; ESAQ native time domain",
      source_locator = meps_esaq_time_source_locator(spec$config_id),
      weight_variable = "ESAQWT24F",
      artifact_version = artifact_version,
      cohort_definition = cohort_definition_text(),
      allowed_interpretation = paste0(
        "Survey-weighted mean of the AHRQ annualized hours-per-year measure for ", spec$detail,
        " among later ESAQ respondents in Panel 28 Round 5 / Panel 29 Round 3 who had been classified operational-current at the earlier Round 3/1 2024 interview."
      ),
      prohibited_interpretation = c(
        "diagnostic-delay time",
        "time caused by Long COVID",
        "monetized burden without a separate approved method",
        "summed diagnostic burden score"
      ),
      limitations = c(
        paste0("AHRQ top-codes ", spec$variable, " at ", spec$maximum, " annualized hours."),
        "AHRQ reports substantial item nonresponse for the ESAQ time-cost questions, especially on paper forms.",
        "EQMVAM53, EQMBAM53, and EQPPAM53 are AHRQ annualized hours-per-year measures derived from the original reported period; they are not necessarily hours observed during calendar year 2024.",
        "This time domain is reported separately and is not added to the other ESAQ time measures.",
        "Operational-current status was measured at the earlier Round 3/1 2024 interview; ESAQ was administered later in Panel 28 Round 5 / Panel 29 Round 3, and that later response does not establish continued current Long COVID at supplement administration."
      )
    )
  }

  deny <- survey_proportion_result(
    domain,
    "EQDENY53",
    cleaner = meps_yes_no_response,
    ci_reference_design = designs$esaq,
    ci_df_source = "full ESAQ / ESAQWT24F survey design"
  )
  records[[length(records) + 1L]] <- make_estimate_record(
    deny,
    estimate_id = "meps24-prior-approval-denied-delayed",
    measure_id = "prior-approval-denied-delayed",
    label = "Prior approval denied or delayed — yes/no response universe",
    unit = "proportion",
    denominator = paste(
      "Adults age 18-64 classified operational-current at the earlier Round 3/1 2024 interview, with later ESAQ administration in Panel 28 Round 5 / Panel 29 Round 3, ESAQELIG=1, positive ESAQWT24F,",
      "and EQDENY53 equal to Yes (1) or No (2)"
    ),
    universe = "U.S. civilian noninstitutionalized adult ESAQ respondent population",
    system_boundary = "National ESAQ prior-approval experience",
    source_locator = meps_prior_approval_source_locator(),
    weight_variable = "ESAQWT24F",
    artifact_version = artifact_version,
      cohort_definition = cohort_definition_text(),
    allowed_interpretation = paste(
      "Proportion reporting that health insurance denied or delayed prior approval",
      "among later ESAQ respondents in Panel 28 Round 5 / Panel 29 Round 3 previously classified operational-current at the earlier Round 3/1 2024 interview who supplied a substantive Yes/No response."
    ),
    prohibited_interpretation = c(
      "percent of all Long COVID patients",
      "diagnostic-delay prior authorization rate",
      "causal effect of Long COVID"
    ),
    limitations = c(
      "EQDENY53 codes 3 (never insured in past year) and 4 (not applicable/have not used services) are excluded from the proportion denominator.",
      "Reserved negative codes are missing and are not converted to No.",
      "Operational-current status was measured at the earlier Round 3/1 2024 interview; ESAQ was administered later in Panel 28 Round 5 / Panel 29 Round 3, and EQDENY53 does not establish continued current Long COVID at supplement administration."
    )
  )

  records
}
