source(file.path("analysis", "r", "lib", "meps_values.R"))

resolve_history_status <- function(lcever31, lcever53) {
  r31 <- meps_binary_12(lcever31)
  r53 <- meps_binary_12(lcever53)
  out <- rep(NA, length(r31))

  any_yes <- (!is.na(r31) & r31) | (!is.na(r53) & r53)
  any_valid <- !is.na(r31) | !is.na(r53)
  out[any_yes] <- TRUE
  out[!any_yes & any_valid] <- FALSE
  as.logical(out)
}

resolve_latest_current_symptoms <- function(covsymnow31, covsymnow53) {
  r31 <- meps_binary_12(covsymnow31)
  r53 <- meps_binary_12(covsymnow53)
  latest <- ifelse(!is.na(r53), r53, r31)
  round_used <- ifelse(!is.na(r53), "53", ifelse(!is.na(r31), "31", NA_character_))
  list(status = as.logical(latest), round_used = round_used, r31 = r31, r53 = r53)
}

construct_long_covid_cohort <- function(data) {
  required <- c(
    "AGE24X", "LCEVER31", "LCEVER53", "COVSYMNOW31", "COVSYMNOW53", "PERWT24F"
  )
  missing <- setdiff(required, names(data))
  if (length(missing)) {
    stop("Cannot construct Long COVID cohort; missing: ", paste(missing, collapse = ", "), call. = FALSE)
  }

  age <- as.numeric(data$AGE24X)
  age_18_64 <- !is.na(age) & age >= 18 & age <= 64
  positive_person_weight <- !is.na(data$PERWT24F) & as.numeric(data$PERWT24F) > 0

  history31 <- meps_binary_12(data$LCEVER31)
  history53 <- meps_binary_12(data$LCEVER53)
  history <- resolve_history_status(data$LCEVER31, data$LCEVER53)
  current <- resolve_latest_current_symptoms(data$COVSYMNOW31, data$COVSYMNOW53)

  classification <- rep(NA, nrow(data))
  classification[!is.na(history) & !history] <- FALSE
  classification[!is.na(history) & history & !is.na(current$status)] <- current$status[
    !is.na(history) & history & !is.na(current$status)
  ]

  target_eligible <- age_18_64 & positive_person_weight
  target_current <- rep(NA, nrow(data))
  known_in_target <- target_eligible & !is.na(classification)
  target_current[known_in_target] <- classification[known_in_target]
  target_current[!target_eligible] <- NA

  data$do_age_18_64 <- age_18_64
  data$do_positive_person_weight <- positive_person_weight
  data$do_lc_history_r31 <- history31
  data$do_lc_history_r53 <- history53
  data$do_lc_history_positive <- history
  data$do_current_symptoms_r31 <- current$r31
  data$do_current_symptoms_r53 <- current$r53
  data$do_current_symptoms_latest <- current$status
  data$do_current_symptoms_round <- current$round_used
  data$do_lc_history_conflict <- !is.na(history31) & !is.na(history53) & history31 & !history53
  data$do_current_symptoms_without_history <- !is.na(current$status) & current$status &
    (is.na(history) | !history)
  data$do_current_long_covid_classification <- classification
  data$do_current_long_covid <- as.logical(target_current)
  data$do_current_long_covid_indicator <- ifelse(
    is.na(target_current), NA_real_, ifelse(target_current, 1, 0)
  )
  data$do_current_long_covid_known <- target_eligible & !is.na(target_current)
  data
}

cohort_definition_text <- function() {
  paste(
    "Adults age 18-64 with positive MEPS person weight, documented Long COVID history",
    "(any valid LCEVER31/LCEVER53 Yes), and latest valid current-symptom assessment",
    "(COVSYMNOW53 preferred; otherwise COVSYMNOW31) equal to Yes.",
    "Reserved negative codes are unknown, never No; COVSYMNOW alone cannot establish history."
  )
}
