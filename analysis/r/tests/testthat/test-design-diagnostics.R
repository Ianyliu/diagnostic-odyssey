testthat::test_that("full-design singleton detection is separate from domain-singleton representation", {
  configure_meps_survey_options()
  data <- data.frame(
    VARSTR = rep(c(1, 2), each = 4),
    VARPSU = rep(c(1, 1, 2, 2), 2),
    PERWT24F = rep(1, 8),
    ESAQWT24F = rep(1, 8),
    SAQWT24F = rep(1, 8),
    PESAQWT24F = rep(1, 8),
    ESAQELIG = 1,
    SAQELIG = 1,
    do_age_18_64 = TRUE,
    do_current_long_covid = c(TRUE, TRUE, FALSE, FALSE, TRUE, TRUE, TRUE, FALSE)
  )

  designs <- build_meps_designs(data)
  full <- survey_design_psu_diagnostics(
    designs$person, "synthetic full PERSON design"
  )
  domain <- survey_design_psu_diagnostics(
    current_long_covid_domain(designs$person),
    "synthetic current-case PERSON domain"
  )

  testthat::expect_equal(full$variance_strata_n, 2L)
  testthat::expect_equal(full$unique_varstr_varpsu_n, 4L)
  testthat::expect_equal(full$minimum_psus_per_stratum, 2L)
  testthat::expect_equal(full$true_or_represented_singleton_strata_n, 0L)

  testthat::expect_equal(domain$variance_strata_n, 2L)
  testthat::expect_equal(domain$true_or_represented_singleton_strata_n, 1L)
})

testthat::test_that("true full-design singleton detector identifies actual one-PSU strata", {
  configure_meps_survey_options()
  data <- data.frame(
    VARSTR = c(1, 1, 2, 2, 2, 2),
    VARPSU = c(1, 1, 1, 1, 2, 2),
    w = rep(1, 6)
  )
  design <- survey::svydesign(
    ids = ~VARPSU,
    strata = ~VARSTR,
    weights = ~w,
    data = data,
    nest = TRUE
  )
  attr(design, "do_weight_variable") <- "w"

  diagnostics <- survey_design_psu_diagnostics(
    design, "synthetic design with a true singleton"
  )

  testthat::expect_equal(diagnostics$true_or_represented_singleton_strata_n, 1L)
  testthat::expect_equal(unlist(diagnostics$singleton_strata), 1)
})

testthat::test_that("variance diagnostics carry full-design and domain roles separately", {
  configure_meps_survey_options()
  designs <- build_meps_designs(synthetic_design_data())
  diagnostics <- build_variance_design_diagnostics(designs)

  testthat::expect_false(diagnostics$any_true_full_design_singleton)
  testthat::expect_identical(
    diagnostics$variance_policy$survey_adjust_domain_lonely,
    FALSE
  )
  testthat::expect_true(all(vapply(
    diagnostics$full_designs,
    function(x) x$true_full_design_singleton_strata_n == 0,
    logical(1)
  )))
})
