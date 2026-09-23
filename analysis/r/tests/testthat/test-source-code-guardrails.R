make_source_code_fixture <- function() {
  data.frame(
    COVIDEVER31 = c(-8, -7, -1, 1, 2),
    LCEVER31 = c(-8, -7, -1, 1, 2),
    COVSYMNOW31 = c(-8, -1, 1, 2, 2)
  )
}

testthat::test_that("reviewed Round-31 HC-256 code sets are accepted and counted", {
  diagnostics <- validate_reviewed_round31_code_sets(make_source_code_fixture())

  testthat::expect_equal(
    unlist(diagnostics$COVIDEVER31$allowable_codes, use.names = FALSE),
    c(-8, -7, -1, 1, 2)
  )
  testthat::expect_equal(
    unlist(diagnostics$LCEVER31$allowable_codes, use.names = FALSE),
    c(-8, -7, -1, 1, 2)
  )
  testthat::expect_equal(
    unlist(diagnostics$COVSYMNOW31$allowable_codes, use.names = FALSE),
    c(-8, -1, 1, 2)
  )
  testthat::expect_equal(diagnostics$COVIDEVER31$observed_counts$code_1, 1L)
  testthat::expect_equal(diagnostics$COVSYMNOW31$observed_counts$code_2, 2L)
})

testthat::test_that("unreviewed source codes fail before cohort routing", {
  data <- make_source_code_fixture()
  data$COVIDEVER31[1] <- -15

  testthat::expect_error(
    validate_reviewed_round31_code_sets(data),
    "COVIDEVER31 contains unreviewed code"
  )
})

testthat::test_that("NA source codes fail reviewed code-set validation", {
  data <- make_source_code_fixture()
  data$LCEVER31[2] <- NA_real_

  testthat::expect_error(
    validate_reviewed_round31_code_sets(data),
    "LCEVER31 contains 1 NA value"
  )
})

testthat::test_that("cohort construction itself invokes fail-fast code validation", {
  data <- make_cohort_fixture()
  data$COVSYMNOW31[1] <- -7

  testthat::expect_error(
    construct_long_covid_cohort(data),
    "COVSYMNOW31 contains unreviewed code"
  )
})
