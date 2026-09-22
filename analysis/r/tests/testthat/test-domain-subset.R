testthat::test_that("survey domain restriction works with namespace loaded but package unattached", {
  if ("package:survey" %in% search()) {
    detach("package:survey", unload = FALSE, character.only = TRUE)
  }

  testthat::expect_true(requireNamespace("survey", quietly = TRUE))
  testthat::expect_false("package:survey" %in% search())

  data <- synthetic_design_data()
  data$do_current_long_covid_known <- TRUE
  data$do_current_long_covid_indicator <- as.numeric(data$do_current_long_covid)

  designs <- build_meps_designs(data)
  domain <- current_long_covid_domain(designs$person)

  testthat::expect_true(inherits(domain, "survey.design"))
  testthat::expect_equal(nrow(domain$variables), 4L)
  testthat::expect_false("package:survey" %in% search())

  population <- estimate_represented_population(
    designs,
    artifact_version = "synthetic-domain-regression"
  )

  testthat::expect_equal(population$value, 5, tolerance = 1e-10)
  testthat::expect_equal(population$unweighted_n, 8L)
  testthat::expect_equal(population$unweighted_numerator_n, 4L)
  testthat::expect_equal(population$weight_variable, "PERWT24F")
  testthat::expect_false("package:survey" %in% search())
})

testthat::test_that("remaining survey namespace-qualified calls are exported", {
  exports <- getNamespaceExports("survey")
  used_namespace_exports <- c("degf", "svydesign", "svymean", "svytotal")

  testthat::expect_true(all(used_namespace_exports %in% exports))
  testthat::expect_false("subset" %in% exports)
})


domain_singleton_fixture <- function() {
  n <- 8L
  data.frame(
    DUPERSID = sprintf("DS%02d", seq_len(n)),
    VARSTR = rep(c(1, 2), each = 4),
    VARPSU = rep(c(1, 1, 2, 2), 2),
    PERWT24F = rep(1, n),
    ESAQWT24F = rep(1, n),
    SAQWT24F = rep(1, n),
    PESAQWT24F = rep(1, n),
    ESAQELIG = 1,
    SAQELIG = 1,
    do_age_18_64 = TRUE,
    do_current_long_covid = c(TRUE, TRUE, FALSE, FALSE, TRUE, TRUE, TRUE, FALSE),
    x = c(10, 12, 0, 0, 20, 22, 30, 0)
  )
}

testthat::test_that("domain-singleton strata remain proper survey domains with extra heuristic disabled", {
  configure_meps_survey_options()
  testthat::expect_identical(getOption("survey.adjust.domain.lonely"), FALSE)
  testthat::expect_identical(getOption("survey.lonely.psu"), "adjust")

  data <- domain_singleton_fixture()
  design <- build_meps_design(data, "PERWT24F")
  domain <- current_long_covid_domain(design)

  full_combos <- unique(data[c("VARSTR", "VARPSU")])
  full_psus <- table(full_combos$VARSTR)
  testthat::expect_true(all(full_psus == 2))

  domain_combos <- unique(domain$variables[c("VARSTR", "VARPSU")])
  represented_psus <- table(domain_combos$VARSTR)
  testthat::expect_true(any(represented_psus == 1))

  warnings <- character()
  stat <- withCallingHandlers(
    survey::svymean(~x, domain),
    warning = function(w) {
      warnings <<- c(warnings, conditionMessage(w))
      invokeRestart("muffleWarning")
    }
  )

  testthat::expect_true(is.finite(unname(stats::coef(stat)[[1]])))
  testthat::expect_true(is.finite(sqrt(unname(stats::vcov(stat)[1, 1]))))
  testthat::expect_length(warnings, 0L)
})

testthat::test_that("production domain path is not a raw-data-prefiltered survey design", {
  configure_meps_survey_options()
  data <- domain_singleton_fixture()

  full_design <- build_meps_design(data, "PERWT24F")
  proper_domain <- current_long_covid_domain(full_design)

  raw_domain_rows <- data[
    data$do_age_18_64 & data$do_current_long_covid,
    ,
    drop = FALSE
  ]
  raw_prefiltered_design <- build_meps_design(raw_domain_rows, "PERWT24F")

  proper_point <- unname(stats::coef(survey::svymean(~x, proper_domain))[[1]])
  raw_point <- unname(stats::coef(survey::svymean(~x, raw_prefiltered_design))[[1]])
  proper_se <- sqrt(unname(stats::vcov(survey::svymean(~x, proper_domain))[1, 1]))
  raw_se <- sqrt(unname(stats::vcov(survey::svymean(~x, raw_prefiltered_design))[1, 1]))

  testthat::expect_equal(proper_point, raw_point)
  testthat::expect_false(isTRUE(all.equal(proper_se, raw_se)))
  testthat::expect_equal(attr(proper_domain, "do_weight_variable"), "PERWT24F")
})
