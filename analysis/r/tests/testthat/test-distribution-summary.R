testthat::test_that("survey distribution summary is design-aware and uses the requested domain", {
  data <- synthetic_design_data()
  data$do_current_long_covid <- TRUE
  data$x <- c(1, 2, 3, 100, 4, 5, 6, 7)
  data$PERWT24F <- c(1, 1, 1, 50, 1, 1, 1, 1)

  full <- build_meps_design(data, "PERWT24F")
  domain <- current_long_covid_domain(full)
  summary <- survey_distribution_summary(domain, "x", meps_nonnegative)

  cleaned <- design_with_clean_value(domain, "x", meps_nonnegative)
  expected <- as.numeric(stats::coef(survey::svyquantile(
    ~.do_value,
    cleaned,
    quantiles = c(0.25, 0.50, 0.75),
    na.rm = TRUE,
    ci = FALSE,
    qrule = "math"
  )))

  testthat::expect_equal(
    c(summary$p25, summary$p50, summary$p75),
    expected
  )
  testthat::expect_false(isTRUE(all.equal(
    summary$p50,
    unname(stats::quantile(data$x, 0.50))
  )))
  testthat::expect_equal(summary$weight_variable, "PERWT24F")
  testthat::expect_equal(summary$variance_stratum_variable, "VARSTR")
  testthat::expect_equal(summary$variance_psu_variable, "VARPSU")
  testthat::expect_lte(summary$p25, summary$p50)
  testthat::expect_lte(summary$p50, summary$p75)
})

testthat::test_that("survey distribution summary derives provenance from MEPS design attributes", {
  data <- synthetic_design_data()
  data$do_current_long_covid <- TRUE
  designs <- build_meps_designs(data)

  person <- current_long_covid_domain(designs$person)
  esaq <- current_long_covid_domain(designs$esaq)

  person_summary <- survey_distribution_summary(person, "x", meps_nonnegative)
  esaq_summary <- survey_distribution_summary(esaq, "x", meps_nonnegative)

  testthat::expect_equal(person_summary$weight_variable, "PERWT24F")
  testthat::expect_equal(esaq_summary$weight_variable, "ESAQWT24F")
  testthat::expect_equal(person_summary$variance_stratum_variable, "VARSTR")
  testthat::expect_equal(person_summary$variance_psu_variable, "VARPSU")
  testthat::expect_equal(esaq_summary$variance_stratum_variable, "VARSTR")
  testthat::expect_equal(esaq_summary$variance_psu_variable, "VARPSU")

  person$variables$ALTSTR <- person$variables$VARSTR
  person$variables$ALTPSU <- person$variables$VARPSU
  attr(person, "do_variance_stratum") <- "ALTSTR"
  attr(person, "do_variance_psu") <- "ALTPSU"
  alternate <- survey_distribution_summary(person, "x", meps_nonnegative)

  testthat::expect_equal(alternate$variance_stratum_variable, "ALTSTR")
  testthat::expect_equal(alternate$variance_psu_variable, "ALTPSU")
})

testthat::test_that("survey distribution summary fails closed when design provenance attrs are missing", {
  data <- synthetic_design_data()
  data$do_current_long_covid <- TRUE
  design <- current_long_covid_domain(build_meps_design(data, "PERWT24F"))

  for (attribute in c(
    "do_weight_variable",
    "do_variance_stratum",
    "do_variance_psu"
  )) {
    broken <- design
    attr(broken, attribute) <- NULL
    testthat::expect_error(
      survey_distribution_summary(broken, "x", meps_nonnegative),
      paste0("missing or malformed ", attribute, " provenance"),
      fixed = TRUE
    )
  }

  empty <- design
  attr(empty, "do_variance_stratum") <- ""
  testthat::expect_error(
    survey_distribution_summary(empty, "x", meps_nonnegative),
    "missing or malformed do_variance_stratum provenance",
    fixed = TRUE
  )

  malformed <- design
  attr(malformed, "do_variance_psu") <- 42
  testthat::expect_error(
    survey_distribution_summary(malformed, "x", meps_nonnegative),
    "missing or malformed do_variance_psu provenance",
    fixed = TRUE
  )
})

testthat::test_that("survey distribution summary uses the parent cleaner and valid denominator", {
  data <- synthetic_design_data()
  data$do_current_long_covid <- TRUE
  data$x <- c(-1, 0, 1, 2, 3, 4, NA, 5)
  design <- current_long_covid_domain(build_meps_design(data, "PERWT24F"))

  summary <- survey_distribution_summary(design, "x", meps_nonnegative)
  cleaned <- design_with_clean_value(design, "x", meps_nonnegative)

  testthat::expect_equal(summary$unweighted_n, survey_unweighted_valid_n(cleaned))
  testthat::expect_equal(
    summary$weighted_denominator,
    survey_weighted_valid_n(cleaned),
    tolerance = 1e-10
  )
  testthat::expect_equal(summary$unweighted_n, 6L)
  testthat::expect_gte(summary$p25, 0)
})

testthat::test_that("Typical Range attaches only to the two selected parent means without changing means", {
  data <- synthetic_design_data()
  data$TOTEXP24 <- c(100, 200, 300, 400, 500, 600, 700, 800)
  data$TOTSLF24 <- c(10, 20, 30, 40, 50, 60, 70, 80)
  data$EQMVAM53 <- seq(1, 8)
  data$EQMBAM53 <- seq(2, 16, by = 2)
  data$EQPPAM53 <- c(0, 2, 4, 6, 8, 10, 12, 520)
  data$EQDENY53 <- rep(c(1, 2), 4)

  designs <- build_meps_designs(data)
  spending <- estimate_spending(designs, "distribution-test")
  admin <- estimate_admin_burden(designs, "distribution-test")

  spending_with_summary <- spending[vapply(
    spending, function(x) !is.null(x$distribution_summary), logical(1)
  )]
  admin_with_summary <- admin[vapply(
    admin, function(x) !is.null(x$distribution_summary), logical(1)
  )]

  testthat::expect_equal(
    vapply(spending_with_summary, function(x) x$estimate_id, character(1)),
    "meps24-gross-all-cause-spending-mean"
  )
  testthat::expect_equal(
    vapply(admin_with_summary, function(x) x$estimate_id, character(1)),
    "meps24-healthcare-paperwork-time-mean"
  )
  testthat::expect_equal(spending_with_summary[[1]]$distribution_summary$source_variable, "TOTEXP24")
  testthat::expect_equal(admin_with_summary[[1]]$distribution_summary$source_variable, "EQPPAM53")

  person_domain <- current_long_covid_domain(designs$person)
  expected_spending_mean <- survey_mean_result(
    person_domain,
    "TOTEXP24",
    meps_nonnegative,
    designs$person,
    "full PERSON / PERWT24F survey design"
  )$value
  testthat::expect_equal(spending_with_summary[[1]]$value, expected_spending_mean)

  esaq_domain <- current_long_covid_domain(designs$esaq)
  expected_paperwork_mean <- survey_mean_result(
    esaq_domain,
    "EQPPAM53",
    function(x) meps_bounded_score(x, 0, 520),
    designs$esaq,
    "full ESAQ / ESAQWT24F survey design"
  )$value
  testthat::expect_equal(admin_with_summary[[1]]$value, expected_paperwork_mean)
})
