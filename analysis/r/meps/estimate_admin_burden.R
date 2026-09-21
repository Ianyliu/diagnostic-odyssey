source(file.path("analysis", "r", "lib", "meps_values.R"))
source(file.path("analysis", "r", "lib", "survey_helpers.R"))
source(file.path("analysis", "r", "lib", "result_helpers.R"))
source(file.path("analysis", "r", "meps", "survey_designs.R"))

estimate_admin_burden <- function(designs, artifact_version) {
  domain <- current_long_covid_domain(designs$esaq)

  time_specs <- list(
    list(
      variable = "EQMVAM53",
      measure_id = "own-medical-visit-time",
      label = "Annualized time on own medical visits / filling prescriptions",
      maximum = 2080,
      detail = "own medical visits and filling prescriptions"
    ),
    list(
      variable = "EQMBAM53",
      measure_id = "medical-bills-insurance-time",
      label = "Annualized time managing medical bills / insurance",
      maximum = 720,
      detail = "paying or managing medical bills and insurance"
    ),
    list(
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
      cleaner = function(x) meps_bounded_score(x, 0, spec$maximum)
    )
    records[[length(records) + 1L]] <- make_estimate_record(
      result,
      estimate_id = paste0("meps24-", spec$measure_id, "-mean"),
      measure_id = spec$measure_id,
      label = spec$label,
      unit = "hours/person/year",
      denominator = paste0(
        "Current-Long-COVID adults age 18-64 with ESAQELIG=1, positive ESAQWT24F, ",
        "and valid ", spec$variable
      ),
      universe = "U.S. civilian noninstitutionalized adult ESAQ respondent population",
      system_boundary = "National healthcare-work / administrative burden; ESAQ native time domain",
      source_locator = paste0(
        "HC-256 ", spec$variable, "; ESAQ time-cost documentation: ",
        "https://meps.ahrq.gov/data_stats/download_data/pufs/h256/h256doc.shtml#2.5.9"
      ),
      weight_variable = "ESAQWT24F",
      artifact_version = artifact_version,
      allowed_interpretation = paste0(
        "Survey-weighted mean annualized hours spent on ", spec$detail,
        " among the stated ESAQ response universe."
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
        "This time domain is reported separately and is not added to the other ESAQ time measures."
      )
    )
  }

  deny <- survey_proportion_result(
    domain,
    "EQDENY53",
    cleaner = meps_yes_no_response
  )
  records[[length(records) + 1L]] <- make_estimate_record(
    deny,
    estimate_id = "meps24-prior-approval-denied-delayed",
    measure_id = "prior-approval-denied-delayed",
    label = "Prior approval denied or delayed — yes/no response universe",
    unit = "proportion",
    denominator = paste(
      "Current-Long-COVID adults age 18-64 with ESAQELIG=1, positive ESAQWT24F,",
      "and EQDENY53 equal to Yes (1) or No (2)"
    ),
    universe = "U.S. civilian noninstitutionalized adult ESAQ respondent population",
    system_boundary = "National ESAQ prior-approval experience",
    source_locator = paste0(
      "HC-256 EQDENY53 codebook and ESAQ documentation: ",
      "https://meps.ahrq.gov/mepsweb/data_stats/download_data_files_codebook.jsp?",
      "PUFId=H256&varName=EQDENY53"
    ),
    weight_variable = "ESAQWT24F",
    artifact_version = artifact_version,
    allowed_interpretation = paste(
      "Proportion reporting that health insurance denied or delayed prior approval",
      "among ESAQ respondents in the cohort who supplied a substantive Yes/No response."
    ),
    prohibited_interpretation = c(
      "percent of all Long COVID patients",
      "diagnostic-delay prior authorization rate",
      "causal effect of Long COVID"
    ),
    limitations = c(
      "EQDENY53 codes 3 (never insured in past year) and 4 (not applicable/have not used services) are excluded from the proportion denominator.",
      "Reserved negative codes are missing and are not converted to No."
    )
  )

  records
}
