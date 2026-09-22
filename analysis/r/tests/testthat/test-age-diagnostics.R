testthat::test_that("age transition diagnostics partition eligibility differences after reserved-code cleaning", {
  data <- data.frame(
    AGE31X = c(17, 64, -1, 40, 65, 18, -8),
    AGE24X = c(18, 65, 18, -1, 64, 17, 18),
    PERWT24F = rep(1, 7)
  )

  d <- age_transition_diagnostics(data)

  testthat::expect_true(d$reconciles)
  testthat::expect_equal(
    d$reconciliation_total,
    d$total_eligibility_differences
  )
  testthat::expect_equal(
    d$categories$valid_AGE31X_under18_to_AGE24X_18_64,
    1L
  )
  testthat::expect_equal(
    d$categories$AGE31X_reserved_or_missing_to_valid_AGE24X_18_64,
    2L
  )
  testthat::expect_equal(
    d$categories$valid_AGE31X_18_64_to_AGE24X_reserved_or_missing,
    1L
  )
})

testthat::test_that("negative AGE31X reserved values are never labeled genuine under-18 ages", {
  data <- data.frame(
    AGE31X = c(-1, -8, 17),
    AGE24X = c(18, 20, 18),
    PERWT24F = c(1, 1, 1)
  )

  d <- age_transition_diagnostics(data)

  testthat::expect_equal(
    d$categories$valid_AGE31X_under18_to_AGE24X_18_64,
    1L
  )
  testthat::expect_equal(
    d$categories$AGE31X_reserved_or_missing_to_valid_AGE24X_18_64,
    2L
  )
})
