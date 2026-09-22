source(file.path("analysis", "r", "lib", "survey_helpers.R"))
source(file.path("analysis", "r", "lib", "meps_values.R"))
source(file.path("analysis", "r", "meps", "survey_designs.R"))

age_transition_diagnostics <- function(data) {
  age31 <- meps_bounded_score(data$AGE31X, 0, 85)
  age24 <- meps_bounded_score(data$AGE24X, 0, 85)
  raw31 <- as.numeric(data$AGE31X)
  raw24 <- as.numeric(data$AGE24X)
  positive <- !is.na(data$PERWT24F) & as.numeric(data$PERWT24F) > 0

  eligible31 <- !is.na(age31) & age31 >= 18 & age31 <= 64
  eligible24 <- !is.na(age24) & age24 >= 18 & age24 <= 64
  differs <- positive & xor(eligible31, eligible24)

  category <- rep(NA_character_, nrow(data))
  category[differs & !is.na(age31) & age31 < 18 & eligible24] <-
    "valid_AGE31X_under18_to_AGE24X_18_64"
  category[differs & eligible31 & !is.na(age24) & age24 >= 65] <-
    "valid_AGE31X_18_64_to_AGE24X_65plus"
  category[differs & eligible31 & !is.na(age24) & age24 < 18] <-
    "valid_AGE31X_18_64_to_AGE24X_under18"
  category[differs & !is.na(age31) & age31 >= 65 & eligible24] <-
    "valid_AGE31X_65plus_to_AGE24X_18_64"
  category[differs & is.na(age31) & eligible24] <-
    "AGE31X_reserved_or_missing_to_valid_AGE24X_18_64"
  category[differs & eligible31 & is.na(age24)] <-
    "valid_AGE31X_18_64_to_AGE24X_reserved_or_missing"
  category[differs & is.na(category)] <- "other_eligibility_difference"

  levels <- c(
    "valid_AGE31X_under18_to_AGE24X_18_64",
    "valid_AGE31X_18_64_to_AGE24X_65plus",
    "valid_AGE31X_18_64_to_AGE24X_under18",
    "valid_AGE31X_65plus_to_AGE24X_18_64",
    "AGE31X_reserved_or_missing_to_valid_AGE24X_18_64",
    "valid_AGE31X_18_64_to_AGE24X_reserved_or_missing",
    "other_eligibility_difference"
  )
  counts <- stats::setNames(
    vapply(levels, function(level) sum(category == level, na.rm = TRUE), integer(1)),
    levels
  )

  total <- sum(differs, na.rm = TRUE)
  reconciliation <- sum(counts)
  if (!identical(as.integer(reconciliation), as.integer(total))) {
    stop(
      "AGE31X/AGE24X transition categories do not reconcile: ",
      reconciliation, " categorized versus ", total, " total differences.",
      call. = FALSE
    )
  }

  list(
    cleaning_rule = paste(
      "Diagnostic ages are valid only from 0 through 85;",
      "negative reserved codes and missing values are not genuine ages."
    ),
    total_eligibility_differences = total,
    categories = as.list(counts),
    reconciliation_total = reconciliation,
    reconciles = TRUE,
    raw_reserved_or_missing = list(
      AGE31X_negative_reserved_n = sum(positive & !is.na(raw31) & raw31 < 0),
      AGE31X_missing_n = sum(positive & is.na(raw31)),
      AGE24X_negative_reserved_n = sum(positive & !is.na(raw24) & raw24 < 0),
      AGE24X_missing_n = sum(positive & is.na(raw24))
    )
  )
}

count_code <- function(x, code, scope) {
  raw <- as.numeric(x)
  sum(scope & !is.na(raw) & raw == code, na.rm = TRUE)
}

weighted_scope_total <- function(data, scope, weight_variable = "PERWT24F") {
  sum(as.numeric(data[[weight_variable]])[scope], na.rm = TRUE)
}

build_corrected_cohort_diagnostics <- function(data, designs, population_record) {
  scope <- data$do_age_18_64 & data$do_positive_person_weight
  cases <- scope & data$do_current_long_covid %in% TRUE

  classifiable_domain <- base::subset(
    designs$person,
    do_age_18_64 & do_current_long_covid_known
  )
  person_case_domain <- current_long_covid_domain(designs$person)
  esaq_case_domain <- current_long_covid_domain(designs$esaq)
  psaq_case_domain <- current_long_covid_domain(designs$psaq)

  history_unresolved <- grepl("^unresolved_", data$do_lc_history_state)
  current_unresolved <- data$do_current_status_state %in% c(
    "unresolved_current_nonresponse",
    "unresolved_unexpected_current_inapplicable"
  )

  list(
    scope = list(
      definition = "AGE31X 18-64 and positive PERWT24F",
      total_hc256_rows = nrow(data),
      target_age_eligible_unweighted_n = sum(scope, na.rm = TRUE),
      target_age_eligible_weighted_population = weighted_scope_total(data, scope),
      age_anchor_vs_year_end_eligibility_difference_n =
        age_transition_diagnostics(data)$total_eligibility_differences
    ),
    age_transition_review = age_transition_diagnostics(data),
    covid_ever_31 = list(
      yes_n = count_code(data$COVIDEVER31, 1, scope),
      no_n = count_code(data$COVIDEVER31, 2, scope),
      refused_n = count_code(data$COVIDEVER31, -7, scope),
      dont_know_n = count_code(data$COVIDEVER31, -8, scope),
      structural_inapplicable_n = count_code(data$COVIDEVER31, -1, scope)
    ),
    long_covid_history_31 = list(
      lcever_yes_n = count_code(data$LCEVER31, 1, scope),
      lcever_no_n = count_code(data$LCEVER31, 2, scope),
      lcever_refused_n = count_code(data$LCEVER31, -7, scope),
      lcever_dont_know_n = count_code(data$LCEVER31, -8, scope),
      lcever_structural_inapplicable_n = count_code(data$LCEVER31, -1, scope),
      known_no_covid_n = sum(scope & data$do_lc_history_state == "no_covid", na.rm = TRUE),
      known_no_long_covid_n = sum(scope & data$do_lc_history_state == "no_long_covid", na.rm = TRUE),
      true_unresolved_history_n = sum(scope & history_unresolved, na.rm = TRUE),
      routing_conflict_n = sum(scope & data$do_routing_conflict, na.rm = TRUE)
    ),
    current_status_31 = list(
      covsymnow_yes_n = count_code(data$COVSYMNOW31, 1, scope),
      covsymnow_no_n = count_code(data$COVSYMNOW31, 2, scope),
      covsymnow_refused_n = count_code(data$COVSYMNOW31, -7, scope),
      covsymnow_dont_know_n = count_code(data$COVSYMNOW31, -8, scope),
      covsymnow_inapplicable_n = count_code(data$COVSYMNOW31, -1, scope),
      structural_not_applicable_no_history_n = sum(
        scope & data$do_current_status_state == "structural_not_applicable_no_history",
        na.rm = TRUE
      ),
      true_unresolved_current_status_with_history_n = sum(
        scope & data$do_lc_history_positive %in% TRUE & current_unresolved,
        na.rm = TRUE
      )
    ),
    temporal_diagnostics = list(
      round31_round53_valid_disagreement_n = sum(
        scope & data$do_temporal_31_53_disagreement,
        na.rm = TRUE
      ),
      panel29_valid_covsymnow53_n = sum(
        scope & as.numeric(data$PANEL) == 29 & !is.na(data$do_current_symptoms_r53),
        na.rm = TRUE
      ),
      note = "Round-53 fields are diagnostic only and never determine primary membership."
    ),
    final_cohort = list(
      classifiable_unweighted_n = sum(scope & data$do_current_long_covid_known, na.rm = TRUE),
      unresolved_unweighted_n = sum(scope & !data$do_current_long_covid_known, na.rm = TRUE),
      current_case_unweighted_n = sum(cases, na.rm = TRUE),
      represented_population = unname(population_record$value),
      panel28_case_unweighted_n = sum(cases & as.numeric(data$PANEL) == 28, na.rm = TRUE),
      panel28_case_weighted_total = weighted_scope_total(
        data, cases & as.numeric(data$PANEL) == 28
      ),
      panel29_case_unweighted_n = sum(cases & as.numeric(data$PANEL) == 29, na.rm = TRUE),
      panel29_case_weighted_total = weighted_scope_total(
        data, cases & as.numeric(data$PANEL) == 29
      )
    ),
    questionnaire_domains = list(
      esaq_current_case_unweighted_n = nrow(esaq_case_domain$variables),
      esaq_current_case_weighted_total = sum(stats::weights(esaq_case_domain)),
      psaq_current_case_unweighted_n = nrow(psaq_case_domain$variables),
      psaq_current_case_weighted_total = sum(stats::weights(psaq_case_domain))
    ),
    survey_design_degrees_of_freedom = list(
      person_design = survey_df(designs$person, "person design"),
      represented_population_classifiable_domain = survey_df(
        classifiable_domain,
        "represented-population classifiable domain"
      ),
      current_case_person_domain = survey_df(
        person_case_domain,
        "current-case person domain"
      ),
      esaq_current_case_domain = survey_df(
        esaq_case_domain,
        "ESAQ current-case domain"
      ),
      psaq_current_case_domain = survey_df(
        psaq_case_domain,
        "PSAQ current-case domain"
      )
    )
  )
}
