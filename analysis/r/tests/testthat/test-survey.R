testthat::test_that("person, ESAQ, and PSAQ designs use different reviewed weights", {
  designs <- build_meps_designs(synthetic_design_data())
  testthat::expect_equal(attr(designs$person, "do_weight_variable"), "PERWT24F")
  testthat::expect_equal(attr(designs$esaq, "do_weight_variable"), "ESAQWT24F")
  testthat::expect_equal(attr(designs$psaq, "do_weight_variable"), "SAQWT24F")
  testthat::expect_equal(designs$metadata$joint_weight_status, "not_used_in_current_pipeline")

  testthat::expect_equal(sum(survey::weights(designs$person)), 12)
  testthat::expect_equal(sum(survey::weights(designs$esaq)), 24)
  testthat::expect_equal(sum(survey::weights(designs$psaq)), 36)
})

testthat::test_that("survey helpers preserve weighted totals, means, proportions, and intervals", {
  designs <- build_meps_designs(synthetic_design_data())
  d <- designs$person

  total <- survey_total_result(d, "x", meps_nonnegative)
  mean <- survey_mean_result(d, "x", meps_nonnegative)
  prop <- survey_proportion_result(
    d, "x",
    function(x) {
      y <- meps_nonnegative(x)
      ifelse(is.na(y), NA_real_, as.numeric(y >= 3))
    }
  )

  expected_weighted_total <- sum(c(1,2,1,2,1,2,1,2)[1:6] * c(0,1,2,3,4,5))
  expected_weighted_n <- sum(c(1,2,1,2,1,2,1,2)[1:6])
  testthat::expect_equal(total$value, expected_weighted_total, tolerance = 1e-10)
  testthat::expect_equal(mean$value, expected_weighted_total / expected_weighted_n, tolerance = 1e-10)
  testthat::expect_equal(total$weighted_denominator, expected_weighted_n, tolerance = 1e-10)
  testthat::expect_equal(total$unweighted_n, 7L) # row 8 has x=7; only row 7 is missing
  testthat::expect_true(is.finite(total$interval_low))
  testthat::expect_true(is.finite(total$interval_high))
  testthat::expect_match(total$interval_type, "Taylor linearization")
  testthat::expect_true(prop$value >= 0 && prop$value <= 1)
  testthat::expect_true(prop$interval_low >= 0 && prop$interval_high <= 1)
})
