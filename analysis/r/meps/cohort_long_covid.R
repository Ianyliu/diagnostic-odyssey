source(file.path("analysis", "r", "lib", "meps_values.R"))

pe_raw <- function(x) as.numeric(x)
pe_is <- function(x, code) {
  raw <- pe_raw(x)
  !is.na(raw) & raw == code
}
pe_in <- function(x, codes) {
  raw <- pe_raw(x)
  !is.na(raw) & raw %in% codes
}
pe_is_response <- function(x) pe_in(x, c(1, 2, -7, -8))

resolve_round31_routing <- function(covidever31, lcever31, covsymnow31) {
  covid <- pe_raw(covidever31)
  lc <- pe_raw(lcever31)
  current <- pe_raw(covsymnow31)
  n <- length(covid)

  history_state <- rep("unresolved_structural", n)
  routing_conflict <- rep(FALSE, n)

  covid_no <- pe_is(covid, 2)
  covid_nonresponse <- pe_in(covid, c(-7, -8))
  covid_yes <- pe_is(covid, 1)
  lc_yes <- pe_is(lc, 1)
  lc_no <- pe_is(lc, 2)
  lc_nonresponse <- pe_in(lc, c(-7, -8))
  current_reached <- pe_in(current, c(1, 2, -7, -8))

  # Questionnaire routing contradictions are review-blocking for individual classification.
  routing_conflict <- routing_conflict |
    (covid_no & (pe_in(lc, c(1, 2, -7, -8)) | pe_in(current, c(1, 2, -7, -8)))) |
    (covid_nonresponse & (pe_in(lc, c(1, 2, -7, -8)) | pe_in(current, c(1, 2, -7, -8)))) |
    (lc_no & current_reached) |
    (lc_nonresponse & current_reached)

  # A reached current-status question implies Long-COVID history was established
  # in the current or a prior round, unless upstream public-use fields contradict routing.
  history_state[current_reached & !routing_conflict] <- "yes"
  history_state[lc_yes & !routing_conflict] <- "yes"
  history_state[lc_no & !routing_conflict] <- "no_long_covid"
  history_state[covid_no & pe_is(lc, -1) & pe_is(current, -1) & !routing_conflict] <- "no_covid"
  history_state[covid_nonresponse & pe_is(lc, -1) & pe_is(current, -1) & !routing_conflict] <-
    "unresolved_covid_nonresponse"
  history_state[lc_nonresponse & !current_reached & !routing_conflict] <-
    "unresolved_long_covid_nonresponse"
  history_state[covid_yes & pe_is(lc, -1) & pe_is(current, -1) & !routing_conflict] <-
    "unresolved_unexpected_downstream_inapplicable"
  history_state[routing_conflict] <- "routing_conflict"

  history_positive <- rep(NA, n)
  history_positive[history_state == "yes"] <- TRUE
  history_positive[history_state %in% c("no_covid", "no_long_covid")] <- FALSE

  current_state <- rep("not_reached_unresolved_history", n)
  current_state[history_state %in% c("no_covid", "no_long_covid") & pe_is(current, -1)] <-
    "structural_not_applicable_no_history"
  current_state[history_state == "yes" & pe_is(current, 1)] <- "yes"
  current_state[history_state == "yes" & pe_is(current, 2)] <- "no"
  current_state[history_state == "yes" & pe_in(current, c(-7, -8))] <-
    "unresolved_current_nonresponse"
  current_state[history_state == "yes" & pe_is(current, -1)] <-
    "unresolved_unexpected_current_inapplicable"
  current_state[routing_conflict] <- "routing_conflict"

  classification <- rep(NA, n)
  classification[history_state %in% c("no_covid", "no_long_covid")] <- FALSE
  classification[history_state == "yes" & current_state == "yes"] <- TRUE
  classification[history_state == "yes" & current_state == "no"] <- FALSE

  list(
    history_state = history_state,
    history_positive = as.logical(history_positive),
    current_state = current_state,
    classification = as.logical(classification),
    routing_conflict = routing_conflict
  )
}

construct_long_covid_cohort <- function(data) {
  required <- c(
    "PANEL", "AGE31X", "AGE24X", "COVIDEVER31", "COVIDEVER53",
    "LCEVER31", "LCEVER53", "COVSYMNOW31", "COVSYMNOW53", "PERWT24F"
  )
  missing <- setdiff(required, names(data))
  if (length(missing)) {
    stop("Cannot construct Long COVID cohort; missing: ", paste(missing, collapse = ", "), call. = FALSE)
  }

  age31 <- pe_raw(data$AGE31X)
  age24 <- pe_raw(data$AGE24X)
  age_18_64 <- !is.na(age31) & age31 >= 18 & age31 <= 64
  year_end_age_18_64 <- !is.na(age24) & age24 >= 18 & age24 <= 64
  positive_person_weight <- !is.na(data$PERWT24F) & as.numeric(data$PERWT24F) > 0

  route <- resolve_round31_routing(
    data$COVIDEVER31,
    data$LCEVER31,
    data$COVSYMNOW31
  )

  target_eligible <- age_18_64 & positive_person_weight
  target_current <- rep(NA, nrow(data))
  known_in_target <- target_eligible & !is.na(route$classification)
  target_current[known_in_target] <- route$classification[known_in_target]
  target_current[!target_eligible] <- NA

  current31 <- meps_binary_12(data$COVSYMNOW31)
  current53 <- meps_binary_12(data$COVSYMNOW53)

  data$do_age_anchor <- age31
  data$do_age_18_64 <- age_18_64
  data$do_age24_18_64_diagnostic <- year_end_age_18_64
  data$do_age_anchor_differs_from_year_end_eligibility <-
    !is.na(age31) & !is.na(age24) & xor(age_18_64, year_end_age_18_64)
  data$do_positive_person_weight <- positive_person_weight

  data$do_covid_history_r31_raw <- pe_raw(data$COVIDEVER31)
  data$do_covid_history_r53_raw <- pe_raw(data$COVIDEVER53)
  data$do_lc_history_r31_raw <- pe_raw(data$LCEVER31)
  data$do_lc_history_r53_raw <- pe_raw(data$LCEVER53)
  data$do_current_symptoms_r31_raw <- pe_raw(data$COVSYMNOW31)
  data$do_current_symptoms_r53_raw <- pe_raw(data$COVSYMNOW53)

  data$do_lc_history_state <- route$history_state
  data$do_lc_history_positive <- route$history_positive
  data$do_current_status_state <- route$current_state
  data$do_routing_conflict <- route$routing_conflict
  data$do_current_symptoms_r31 <- current31
  data$do_current_symptoms_r53 <- current53
  data$do_temporal_31_53_disagreement <-
    !is.na(current31) & !is.na(current53) & current31 != current53

  # Primary classification is anchored exclusively to Round 3/1 (suffix 31).
  data$do_current_long_covid_classification <- route$classification
  data$do_current_long_covid <- as.logical(target_current)
  data$do_current_long_covid_indicator <- ifelse(
    is.na(target_current), NA_real_, ifelse(target_current, 1, 0)
  )
  data$do_current_long_covid_known <- target_eligible & !is.na(target_current)
  data
}

cohort_definition_text <- function() {
  paste(
    "Operational current Long COVID at the common Round 3/1 2024 interview:",
    "adults age 18-64 by AGE31X with positive MEPS person weight, route-aware",
    "established Long-COVID history from COVIDEVER31/LCEVER31 questionnaire routing,",
    "and COVSYMNOW31 equal to Yes. Structural -1 values are interpreted by routing;",
    "RF/DK and unexpected downstream inapplicability remain unresolved.",
    "Round-53 status is diagnostic only and never overwrites the primary 2024 anchor."
  )
}
