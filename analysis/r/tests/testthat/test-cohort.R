make_cohort_fixture <- function() {
  data.frame(
    id = c(
      "covid_no_structural",
      "covid_dk_unresolved",
      "covid_rf_unresolved",
      "covid_yes_lc_no",
      "lc_yes_current_yes",
      "lc_yes_current_no",
      "lc_yes_current_dk",
      "lc_yes_current_inapplicable",
      "panel29_53_cannot_overwrite",
      "r31_no_r53_yes",
      "age17_at_anchor",
      "age64_anchor_turns65",
      "routing_conflict"
    ),
    PANEL = c(28,28,28,28,28,28,28,28,29,28,29,28,28),
    AGE31X = c(40,40,40,40,40,40,40,40,40,40,17,64,40),
    AGE24X = c(40,40,40,40,40,40,40,40,40,40,18,65,40),
    PERWT24F = rep(1, 13),
    COVIDEVER31 = c(2,-8,-7,1,1,1,1,1,1,1,1,1,2),
    COVIDEVER53 = c(2,-8,-7,1,1,1,1,1,1,1,1,1,2),
    LCEVER31 = c(-1,-1,-1,2,1,1,1,1,1,1,1,1,1),
    LCEVER53 = c(-1,-1,-1,2,1,1,1,1,1,1,1,1,1),
    COVSYMNOW31 = c(-1,-1,-1,-1,1,2,-8,-1,1,2,1,1,-1),
    COVSYMNOW53 = c(-1,-1,-1,-1,1,2,1,1,2,1,1,1,-1)
  )
}

row_by_id <- function(data, id) data[data$id == id, , drop = FALSE]

testthat::test_that("PE structural skips distinguish known noncases from unresolved antecedents", {
  out <- construct_long_covid_cohort(make_cohort_fixture())

  covid_no <- row_by_id(out, "covid_no_structural")
  testthat::expect_identical(covid_no$do_lc_history_state, "no_covid")
  testthat::expect_false(covid_no$do_current_long_covid)
  testthat::expect_identical(
    covid_no$do_current_status_state,
    "structural_not_applicable_no_history"
  )

  covid_dk <- row_by_id(out, "covid_dk_unresolved")
  testthat::expect_identical(
    covid_dk$do_lc_history_state,
    "unresolved_covid_nonresponse"
  )
  testthat::expect_true(is.na(covid_dk$do_current_long_covid))

  covid_rf <- row_by_id(out, "covid_rf_unresolved")
  testthat::expect_identical(
    covid_rf$do_lc_history_state,
    "unresolved_covid_nonresponse"
  )
  testthat::expect_true(is.na(covid_rf$do_current_long_covid))

  lc_no <- row_by_id(out, "covid_yes_lc_no")
  testthat::expect_identical(lc_no$do_lc_history_state, "no_long_covid")
  testthat::expect_false(lc_no$do_current_long_covid)
})

testthat::test_that("established Long COVID history uses only Round 3/1 current status", {
  out <- construct_long_covid_cohort(make_cohort_fixture())

  current_yes <- row_by_id(out, "lc_yes_current_yes")
  testthat::expect_true(current_yes$do_current_long_covid)
  testthat::expect_identical(current_yes$do_current_status_state, "yes")

  current_no <- row_by_id(out, "lc_yes_current_no")
  testthat::expect_false(current_no$do_current_long_covid)
  testthat::expect_identical(current_no$do_current_status_state, "no")

  current_dk <- row_by_id(out, "lc_yes_current_dk")
  testthat::expect_true(is.na(current_dk$do_current_long_covid))
  testthat::expect_identical(
    current_dk$do_current_status_state,
    "unresolved_current_nonresponse"
  )

  current_inapplicable <- row_by_id(out, "lc_yes_current_inapplicable")
  testthat::expect_true(is.na(current_inapplicable$do_current_long_covid))
  testthat::expect_identical(
    current_inapplicable$do_current_status_state,
    "unresolved_unexpected_current_inapplicable"
  )
})

testthat::test_that("structural current-status inapplicability is not genuine missingness", {
  out <- construct_long_covid_cohort(make_cohort_fixture())
  no_history <- row_by_id(out, "covid_no_structural")

  testthat::expect_false(no_history$do_lc_history_positive)
  testthat::expect_identical(
    no_history$do_current_status_state,
    "structural_not_applicable_no_history"
  )
  testthat::expect_false(
    no_history$do_current_status_state %in% c(
      "unresolved_current_nonresponse",
      "unresolved_unexpected_current_inapplicable"
    )
  )
})

testthat::test_that("Panel 29 Round 3/2025 status cannot overwrite the common 2024 anchor", {
  out <- construct_long_covid_cohort(make_cohort_fixture())
  panel29 <- row_by_id(out, "panel29_53_cannot_overwrite")

  testthat::expect_equal(panel29$PANEL, 29)
  testthat::expect_equal(panel29$COVSYMNOW31, 1)
  testthat::expect_equal(panel29$COVSYMNOW53, 2)
  testthat::expect_true(panel29$do_temporal_31_53_disagreement)
  testthat::expect_true(panel29$do_current_long_covid)
})

testthat::test_that("31 versus 53 disagreement follows the documented 31 anchor for both panels", {
  out <- construct_long_covid_cohort(make_cohort_fixture())
  disagreement <- row_by_id(out, "r31_no_r53_yes")

  testthat::expect_equal(disagreement$COVSYMNOW31, 2)
  testthat::expect_equal(disagreement$COVSYMNOW53, 1)
  testthat::expect_true(disagreement$do_temporal_31_53_disagreement)
  testthat::expect_false(disagreement$do_current_long_covid)
})

testthat::test_that("AGE31X defines 18-64 eligibility at the status assessment", {
  out <- construct_long_covid_cohort(make_cohort_fixture())

  new_adult <- row_by_id(out, "age17_at_anchor")
  testthat::expect_false(new_adult$do_age_18_64)
  testthat::expect_true(new_adult$do_age24_18_64_diagnostic)
  testthat::expect_true(new_adult$do_age_anchor_differs_from_year_end_eligibility)
  testthat::expect_true(is.na(new_adult$do_current_long_covid))

  turns65 <- row_by_id(out, "age64_anchor_turns65")
  testthat::expect_true(turns65$do_age_18_64)
  testthat::expect_false(turns65$do_age24_18_64_diagnostic)
  testthat::expect_true(turns65$do_age_anchor_differs_from_year_end_eligibility)
  testthat::expect_true(turns65$do_current_long_covid)
})

testthat::test_that("routing contradictions remain unresolved and are flagged", {
  out <- construct_long_covid_cohort(make_cohort_fixture())
  conflict <- row_by_id(out, "routing_conflict")

  testthat::expect_true(conflict$do_routing_conflict)
  testthat::expect_identical(conflict$do_lc_history_state, "routing_conflict")
  testthat::expect_true(is.na(conflict$do_current_long_covid))
})

testthat::test_that("classification and unresolved states reconcile within target eligibility", {
  out <- construct_long_covid_cohort(make_cohort_fixture())
  eligible <- out$do_age_18_64 & out$do_positive_person_weight

  cases <- sum(out$do_current_long_covid %in% TRUE, na.rm = TRUE)
  noncases <- sum(out$do_current_long_covid %in% FALSE, na.rm = TRUE)
  unresolved <- sum(eligible & is.na(out$do_current_long_covid), na.rm = TRUE)

  testthat::expect_equal(cases + noncases + unresolved, sum(eligible))
})

testthat::test_that("generic negative-code helpers still preserve reserved values as missing for outcomes", {
  testthat::expect_equal(
    meps_nonnegative(c(-15, -8, -7, -1, 0, 2)),
    c(NA, NA, NA, NA, 0, 2)
  )
  testthat::expect_true(all(is.na(meps_binary_12(c(-15, -8, -7, -1)))))
})
