testthat::test_that("latest valid current-symptom assessment supersedes earlier round", {
  d <- data.frame(
    AGE24X = rep(40, 7),
    PERWT24F = rep(1, 7),
    LCEVER31 = c(1, 1, -8, -8, 1, 2, 1),
    LCEVER53 = c(1, 1, 2, -1, 2, 1, 1),
    COVSYMNOW31 = c(1, 1, 1, 1, 1, -1, 1),
    COVSYMNOW53 = c(2, -8, 1, 1, 1, 1, -1)
  )
  out <- construct_long_covid_cohort(d)

  testthat::expect_false(out$do_current_long_covid[[1]]) # later valid No wins current status
  testthat::expect_true(out$do_current_long_covid[[2]])  # later DK falls back to round 31 Yes
  testthat::expect_false(out$do_current_long_covid[[3]]) # valid Long COVID history is No
  testthat::expect_true(is.na(out$do_current_long_covid[[4]])) # unresolved history, never No
  testthat::expect_true(out$do_current_long_covid[[5]])   # earlier Yes preserves history despite conflict
  testthat::expect_true(out$do_lc_history_conflict[[5]])
  testthat::expect_true(out$do_current_long_covid[[6]])   # later new Long COVID history Yes
  testthat::expect_equal(out$do_current_symptoms_round[[7]], "31")
})

testthat::test_that("current symptoms alone cannot establish Long COVID history", {
  d <- data.frame(
    AGE24X = 40,
    PERWT24F = 1,
    LCEVER31 = -8,
    LCEVER53 = -1,
    COVSYMNOW31 = -1,
    COVSYMNOW53 = 1
  )
  out <- construct_long_covid_cohort(d)
  testthat::expect_true(is.na(out$do_current_long_covid))
  testthat::expect_true(out$do_current_symptoms_without_history)
})

testthat::test_that("reserved negative codes remain missing rather than zero or No", {
  testthat::expect_equal(meps_nonnegative(c(-15, -8, -7, -1, 0, 2)), c(NA, NA, NA, NA, 0, 2))
  testthat::expect_true(all(is.na(meps_binary_12(c(-15, -8, -7, -1)))))
})
