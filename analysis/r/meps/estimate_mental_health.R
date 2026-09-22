source(file.path("analysis", "r", "lib", "meps_values.R"))
source(file.path("analysis", "r", "lib", "survey_helpers.R"))
source(file.path("analysis", "r", "lib", "result_helpers.R"))
source(file.path("analysis", "r", "meps", "cohort_long_covid.R"))
source(file.path("analysis", "r", "meps", "survey_designs.R"))

k6_valid <- function(x) meps_bounded_score(x, 0, 24)
phq2_valid <- function(x) meps_bounded_score(x, 0, 6)

k6_serious_indicator <- function(x) {
  score <- k6_valid(x)
  ifelse(is.na(score), NA_real_, as.numeric(score >= 13))
}

phq2_positive_indicator <- function(x) {
  score <- phq2_valid(x)
  ifelse(is.na(score), NA_real_, as.numeric(score >= 3))
}

estimate_mental_health <- function(designs, artifact_version) {
  domain <- current_long_covid_domain(designs$psaq)

  ci_ref <- designs$psaq
  ci_source <- "full PSAQ / SAQWT24F survey design"
  k6_mean <- survey_mean_result(domain, "K6SUM42", k6_valid, ci_ref, ci_source)
  k6_serious <- survey_proportion_result(domain, "K6SUM42", k6_serious_indicator, ci_ref, ci_source)
  phq_mean <- survey_mean_result(domain, "PHQ242", phq2_valid, ci_ref, ci_source)
  phq_positive <- survey_proportion_result(domain, "PHQ242", phq2_positive_indicator, ci_ref, ci_source)

  common_universe <- "U.S. civilian noninstitutionalized adult PSAQ respondent population"
  k6_url <- "https://meps.ahrq.gov/mepsweb/data_stats/download_data_files_codebook.jsp?PUFId=H256&varName=K6SUM42"
  phq_url <- "https://meps.ahrq.gov/mepsweb/data_stats/download_data_files_codebook.jsp?PUFId=H256&varName=PHQ242"

  list(
    make_estimate_record(
      k6_mean,
      estimate_id = "meps24-k6-score-mean",
      measure_id = "k6-score-mean",
      label = "Mean K6 nonspecific psychological distress score",
      unit = "score (0-24)",
      denominator = "Adults age 18-64 classified operational-current at the earlier Round 3/1 2024 anchor, with SAQELIG=1, positive SAQWT24F, and valid K6SUM42",
      universe = common_universe,
      system_boundary = "National PSAQ nonspecific psychological distress",
      source_locator = k6_url,
      weight_variable = "SAQWT24F",
      artifact_version = artifact_version,
      cohort_definition = cohort_definition_text(),
      allowed_interpretation = "Mean official K6 nonspecific psychological distress score among later PSAQ respondents previously classified operational-current at the Round 3/1 2024 anchor.",
      prohibited_interpretation = c(
        "psychiatric diagnosis",
        "distress caused by Long COVID",
        "distress caused by diagnostic delay",
        "monetized human burden"
      ),
      limitations = c("K6 is a nonspecific psychological distress measure, not a disorder diagnosis.",
        "Operational-current status was measured at the earlier Round 3/1 2024 interview; the later PSAQ score does not establish continued current Long COVID at supplement administration.")
    ),
    make_estimate_record(
      k6_serious,
      estimate_id = "meps24-k6-serious-distress",
      measure_id = "k6-serious-distress",
      label = "Serious nonspecific psychological distress (K6 >=13)",
      unit = "proportion",
      denominator = "Adults age 18-64 classified operational-current at the earlier Round 3/1 2024 anchor, with SAQELIG=1, positive SAQWT24F, and valid K6SUM42",
      universe = common_universe,
      system_boundary = "National PSAQ nonspecific psychological distress",
      source_locator = paste(
        k6_url,
        "AHRQ example classification: https://meps.ahrq.gov/data_files/publications/st570/stat570.shtml",
        sep = "; "
      ),
      weight_variable = "SAQWT24F",
      artifact_version = artifact_version,
      cohort_definition = cohort_definition_text(),
      allowed_interpretation = "Proportion meeting AHRQ's published K6 >=13 serious-distress category among later PSAQ respondents previously classified operational-current at the Round 3/1 2024 anchor.",
      prohibited_interpretation = c(
        "psychiatric diagnosis",
        "mental illness prevalence",
        "causal effect of Long COVID or diagnostic delay",
        "monetized human burden"
      ),
      limitations = c("Threshold is a distress classification, not a psychiatric diagnosis.",
        "Operational-current status was measured at the earlier Round 3/1 2024 interview; the later PSAQ outcome does not establish continued current Long COVID at supplement administration.")
    ),
    make_estimate_record(
      phq_mean,
      estimate_id = "meps24-phq2-score-mean",
      measure_id = "phq2-score-mean",
      label = "Mean PHQ-2 depressive-symptom screen score",
      unit = "score (0-6)",
      denominator = "Adults age 18-64 classified operational-current at the earlier Round 3/1 2024 anchor, with SAQELIG=1, positive SAQWT24F, and valid PHQ242",
      universe = common_universe,
      system_boundary = "National PSAQ depressive-symptom screening",
      source_locator = phq_url,
      weight_variable = "SAQWT24F",
      artifact_version = artifact_version,
      cohort_definition = cohort_definition_text(),
      allowed_interpretation = "Mean official PHQ-2 depressive-symptom screening score among later PSAQ respondents previously classified operational-current at the Round 3/1 2024 anchor.",
      prohibited_interpretation = c(
        "depression diagnosis",
        "causal effect of Long COVID or diagnostic delay",
        "monetized human burden"
      ),
      limitations = c("PHQ-2 is a screening measure, not a DSM-V diagnosis.",
        "Operational-current status was measured at the earlier Round 3/1 2024 interview; the later PSAQ score does not establish continued current Long COVID at supplement administration.")
    ),
    make_estimate_record(
      phq_positive,
      estimate_id = "meps24-phq2-screen-positive",
      measure_id = "phq2-screen-positive",
      label = "PHQ-2 screen-positive (score >=3)",
      unit = "proportion",
      denominator = "Adults age 18-64 classified operational-current at the earlier Round 3/1 2024 anchor, with SAQELIG=1, positive SAQWT24F, and valid PHQ242",
      universe = common_universe,
      system_boundary = "National PSAQ depressive-symptom screening",
      source_locator = paste(
        phq_url,
        "HC-256 documentation §2.5.7 cites score 3 as the screening cut point",
        sep = "; "
      ),
      weight_variable = "SAQWT24F",
      artifact_version = artifact_version,
      cohort_definition = cohort_definition_text(),
      allowed_interpretation = "Proportion with PHQ-2 score >=3 among later PSAQ respondents previously classified operational-current at the Round 3/1 2024 anchor.",
      prohibited_interpretation = c(
        "depression diagnosis",
        "DSM-V depression prevalence",
        "causal effect of Long COVID or diagnostic delay",
        "monetized human burden"
      ),
      limitations = c("PHQ-2 >=3 is a screening threshold, not a clinical diagnosis.",
        "Operational-current status was measured at the earlier Round 3/1 2024 interview; the later PSAQ outcome does not establish continued current Long COVID at supplement administration.")
    )
  )
}
