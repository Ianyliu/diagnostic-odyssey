testthat::test_that("person, ESAQ, and PSAQ designs use different reviewed weights", {
  designs <- build_meps_designs(synthetic_design_data())
  testthat::expect_equal(attr(designs$person, "do_weight_variable"), "PERWT24F")
  testthat::expect_equal(attr(designs$esaq, "do_weight_variable"), "ESAQWT24F")
  testthat::expect_equal(attr(designs$psaq, "do_weight_variable"), "SAQWT24F")
  testthat::expect_equal(designs$metadata$joint_weight_status, "not_used_in_current_pipeline")

  testthat::expect_equal(sum(stats::weights(designs$person)), 12)
  testthat::expect_equal(sum(stats::weights(designs$esaq)), 24)
  testthat::expect_equal(sum(stats::weights(designs$psaq)), 36)
})

testthat::test_that("survey helpers preserve weighted totals, means, proportions, and intervals", {
  designs <- build_meps_designs(synthetic_design_data())
  d <- designs$person

  total <- survey_total_result(d, "x", meps_nonnegative, d, "synthetic full person design")
  mean <- survey_mean_result(d, "x", meps_nonnegative, d, "synthetic full person design")
  prop <- survey_proportion_result(
    d, "x",
    function(x) {
      y <- meps_nonnegative(x)
      ifelse(is.na(y), NA_real_, as.numeric(y >= 3))
    },
    d,
    "synthetic full person design"
  )

  expected_weighted_total <- sum(c(1,2,1,2,1,2,2) * c(0,1,2,3,4,5,7))
  expected_weighted_n <- sum(c(1,2,1,2,1,2,2))
  testthat::expect_equal(total$value, expected_weighted_total, tolerance = 1e-10)
  testthat::expect_equal(mean$value, expected_weighted_total / expected_weighted_n, tolerance = 1e-10)
  testthat::expect_equal(total$weighted_denominator, expected_weighted_n, tolerance = 1e-10)
  testthat::expect_equal(total$unweighted_n, 7L) # row 8 has x=7; only row 7 is missing
  testthat::expect_true(is.finite(total$interval_low))
  testthat::expect_true(is.finite(total$interval_high))
  testthat::expect_match(total$interval_type, "Taylor linearization")
  testthat::expect_equal(total$relative_standard_error, abs(total$standard_error / total$value))
  testthat::expect_equal(total$interval_width, total$interval_high - total$interval_low)
  testthat::expect_equal(total$unweighted_excluded_or_missing_n, 1L)
  testthat::expect_true(prop$value >= 0 && prop$value <= 1)
  testthat::expect_true(prop$interval_low >= 0 && prop$interval_high <= 1)
})


testthat::test_that("nonpositive survey degrees of freedom fail explicitly", {
  one_row <- data.frame(VARSTR = 1, VARPSU = 1, w = 1, x = 1)
  design <- survey::svydesign(
    ids = ~VARPSU,
    strata = ~VARSTR,
    weights = ~w,
    data = one_row,
    nest = TRUE
  )

  testthat::expect_lte(survey::degf(design), 0)
  testthat::expect_error(
    survey_df(design, "synthetic singleton design"),
    "Invalid survey design degrees of freedom"
  )
})

testthat::test_that("finite positive survey degrees of freedom are preserved exactly", {
  designs <- build_meps_designs(synthetic_design_data())
  expected <- survey::degf(designs$person)

  testthat::expect_true(is.finite(expected) && expected > 0)
  testthat::expect_equal(survey_df(designs$person, "synthetic person design"), expected)
})


testthat::test_that("full-design CI df changes only critical value, not domain point or SE", {
  designs <- build_meps_designs(synthetic_design_data())
  domain <- current_long_covid_domain(designs$person)

  full_df <- survey_mean_result(
    domain, "x", meps_nonnegative,
    designs$person, "full PERSON / PERWT24F survey design"
  )
  domain_df <- survey_mean_result(
    domain, "x", meps_nonnegative,
    domain, "current-case PERSON domain"
  )

  testthat::expect_equal(full_df$value, domain_df$value)
  testthat::expect_equal(full_df$standard_error, domain_df$standard_error)
  testthat::expect_equal(full_df$ci_degrees_of_freedom, survey::degf(designs$person))
  testthat::expect_equal(domain_df$ci_degrees_of_freedom, survey::degf(domain))
  testthat::expect_false(isTRUE(all.equal(full_df$interval_width, domain_df$interval_width)))
})

ci_family_fixture <- function() {
  n <- 16L
  data.frame(
    DUPERSID = sprintf("CF%02d", seq_len(n)),
    VARSTR = rep(1:4, each = 4),
    VARPSU = rep(c(1, 1, 2, 2), 4),
    PERWT24F = rep(1, n),
    ESAQWT24F = c(rep(1, 12), rep(0, 4)),
    SAQWT24F = c(rep(1, 8), rep(0, 8)),
    PESAQWT24F = rep(0, n),
    ESAQELIG = c(rep(1, 12), rep(0, 4)),
    SAQELIG = c(rep(1, 8), rep(0, 8)),
    do_age_18_64 = TRUE,
    do_current_long_covid = rep(c(TRUE, FALSE, TRUE, FALSE), 4),
    do_current_long_covid_known = TRUE,
    do_current_long_covid_indicator = rep(c(1, 0, 1, 0), 4),
    EQMVAM53 = seq_len(n),
    EQMBAM53 = seq_len(n),
    EQPPAM53 = seq_len(n),
    EQDENY53 = rep(c(1, 2), 8),
    K6SUM42 = rep(c(4, 14, 6, 16), 4),
    PHQ242 = rep(c(1, 4, 2, 5), 4)
  )
}

testthat::test_that("PERSON, ESAQ, and PSAQ estimates use their respective full-design CI df", {
  designs <- build_meps_designs(ci_family_fixture())
  person <- estimate_represented_population(designs, "ci-family-test")
  admin <- estimate_admin_burden(designs, "ci-family-test")
  mental <- estimate_mental_health(designs, "ci-family-test")

  testthat::expect_equal(person$ci_degrees_of_freedom, survey::degf(designs$person))
  testthat::expect_true(all(vapply(
    admin,
    function(x) isTRUE(all.equal(x$ci_degrees_of_freedom, unname(survey::degf(designs$esaq)))),
    logical(1)
  )))
  testthat::expect_true(all(vapply(
    mental,
    function(x) isTRUE(all.equal(x$ci_degrees_of_freedom, unname(survey::degf(designs$psaq)))),
    logical(1)
  )))
  testthat::expect_equal(person$ci_df_source, "full PERSON / PERWT24F survey design")
})


testthat::test_that("design-row diagnostics reconcile overlapping exclusion causes", {
  data <- data.frame(
    VARSTR = c(1, 1, 1, 1, 1, NA, NA),
    VARPSU = c(1, 1, 1, 1, NA, 1, NA),
    w = c(1, NA, 0, -1, 1, 1, 0)
  )
  eligibility <- c(TRUE, TRUE, TRUE, TRUE, FALSE, NA, FALSE)

  d <- design_row_filter_diagnostics(
    data,
    "w",
    eligibility = eligibility,
    eligibility_applies = TRUE
  )

  testthat::expect_equal(d$total_input_n, 7L)
  testthat::expect_equal(d$retained_n, 1L)
  testthat::expect_equal(d$excluded_any_n, 6L)
  testthat::expect_equal(d$eligibility_excluded_n, 3L)
  testthat::expect_equal(d$eligibility_missing_n, 1L)
  testthat::expect_equal(d$eligibility_false_n, 2L)
  testthat::expect_equal(d$weight_missing_n, 1L)
  testthat::expect_equal(d$weight_zero_n, 2L)
  testthat::expect_equal(d$weight_negative_n, 1L)
  testthat::expect_equal(d$varstr_missing_n, 2L)
  testthat::expect_equal(d$varpsu_missing_n, 2L)
  testthat::expect_true(d$criterion_counts_are_non_mutually_exclusive)
  testthat::expect_true(d$reconciliation$equals_total_input_n)
  testthat::expect_equal(
    d$retained_n + d$excluded_any_n,
    d$total_input_n
  )
  testthat::expect_equal(
    d$exclusion_reason_combinations$eligibility_false.weight_zero.varstr_missing.varpsu_missing,
    1L
  )
  testthat::expect_equal(
    sum(unlist(d$exclusion_reason_combinations, use.names = FALSE)),
    d$excluded_any_n
  )
})

testthat::test_that("weight-specific row-filter diagnostics are exposed in design metadata", {
  designs <- build_meps_designs(synthetic_design_data())
  row_filtering <- designs$metadata$row_filtering

  testthat::expect_named(row_filtering, c("person", "esaq", "psaq"))
  testthat::expect_equal(row_filtering$person$total_input_n, 8L)
  testthat::expect_equal(row_filtering$person$retained_n, 8L)
  testthat::expect_equal(row_filtering$esaq$retained_n, 8L)
  testthat::expect_equal(row_filtering$psaq$retained_n, 8L)
  testthat::expect_true(row_filtering$person$reconciliation$equals_total_input_n)
  testthat::expect_true(row_filtering$esaq$reconciliation$equals_total_input_n)
  testthat::expect_true(row_filtering$psaq$reconciliation$equals_total_input_n)
})
