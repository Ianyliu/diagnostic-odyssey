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
