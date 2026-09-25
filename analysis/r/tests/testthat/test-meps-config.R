testthat::test_that("reviewed MEPS provenance configuration resolves current pipeline dependencies", {
  variable_map <- load_meps_variable_map()

  expected_measure_ids <- c(
    "gross_spending_total",
    "oop_spending_total",
    "office_visits",
    "outpatient_visits",
    "emergency_visits",
    "inpatient_discharges",
    "own_medical_time",
    "medical_bills_time",
    "paperwork_time",
    "prior_approval_denied_delayed",
    "k6_score",
    "phq2_score"
  )
  for (id in expected_measure_ids) {
    testthat::expect_true(
      nzchar(get_meps_measure_source_locator(id, variable_map)),
      info = id
    )
  }

  expected_reference_keys <- c(
    "cohort_routing_documentation",
    "esaq_time_cost_documentation",
    "k6_serious_distress_classification",
    "phq2_screening_cut_point"
  )
  for (key in expected_reference_keys) {
    testthat::expect_true(
      nzchar(get_meps_provenance_reference(key, variable_map)),
      info = key
    )
  }
})

testthat::test_that("MEPS source-locator composition preserves reviewed output strings", {
  base_codebook <- paste0(
    "https://meps.ahrq.gov/mepsweb/data_stats/",
    "download_data_files_codebook.jsp?PUFId=H256&varName="
  )
  docs <- "https://meps.ahrq.gov/data_stats/download_data/pufs/h256/h256doc.shtml"

  testthat::expect_identical(
    meps_population_source_locator(),
    paste0(
      "HC-256 PANEL + AGE31X + COVIDEVER31 + LCEVER31 + COVSYMNOW31; ",
      docs, "#2.5.5"
    )
  )
  testthat::expect_identical(
    get_meps_measure_source_locator("gross_spending_total"),
    paste0(base_codebook, "TOTEXP24")
  )
  testthat::expect_identical(
    get_meps_measure_source_locator("oop_spending_total"),
    paste0(base_codebook, "TOTSLF24")
  )
  testthat::expect_identical(
    get_meps_measure_source_locator("office_visits"),
    paste0(base_codebook, "OBTOTV24")
  )
  testthat::expect_identical(
    get_meps_measure_source_locator("outpatient_visits"),
    paste0(base_codebook, "OPTOTV24")
  )
  testthat::expect_identical(
    get_meps_measure_source_locator("emergency_visits"),
    paste0(base_codebook, "ERTOT24")
  )
  testthat::expect_identical(
    get_meps_measure_source_locator("inpatient_discharges"),
    paste0(base_codebook, "IPDIS24")
  )
  testthat::expect_identical(
    meps_esaq_time_source_locator("own_medical_time"),
    paste0(
      "HC-256 EQMVAM53; ESAQ time-cost documentation: ",
      docs, "#2.5.9"
    )
  )
  testthat::expect_identical(
    meps_esaq_time_source_locator("medical_bills_time"),
    paste0(
      "HC-256 EQMBAM53; ESAQ time-cost documentation: ",
      docs, "#2.5.9"
    )
  )
  testthat::expect_identical(
    meps_esaq_time_source_locator("paperwork_time"),
    paste0(
      "HC-256 EQPPAM53; ESAQ time-cost documentation: ",
      docs, "#2.5.9"
    )
  )
  testthat::expect_identical(
    meps_prior_approval_source_locator(),
    paste0(
      "HC-256 EQDENY53 codebook and ESAQ documentation: ",
      base_codebook, "EQDENY53"
    )
  )
  testthat::expect_identical(
    get_meps_measure_source_locator("k6_score"),
    paste0(base_codebook, "K6SUM42")
  )
  testthat::expect_identical(
    meps_k6_serious_source_locator(),
    paste0(
      base_codebook, "K6SUM42; AHRQ example classification: ",
      "https://meps.ahrq.gov/data_files/publications/st570/stat570.shtml"
    )
  )
  testthat::expect_identical(
    get_meps_measure_source_locator("phq2_score"),
    paste0(base_codebook, "PHQ242")
  )
  testthat::expect_identical(
    meps_phq2_positive_source_locator(),
    paste0(
      base_codebook, "PHQ242; ",
      "HC-256 documentation §2.5.7 cites score 3 as the screening cut point"
    )
  )
})

testthat::test_that("MEPS measure lookup fails closed on malformed reviewed config", {
  variable_map <- load_meps_variable_map()

  testthat::expect_error(
    get_meps_measure_spec("missing-id", variable_map),
    "missing-id"
  )

  duplicated <- variable_map
  duplicated$measures <- c(
    duplicated$measures,
    list(get_meps_measure_spec("gross_spending_total", variable_map))
  )
  testthat::expect_error(
    get_meps_measure_spec("gross_spending_total", duplicated),
    "gross_spending_total"
  )

  malformed_cases <- list(NULL, "", "   ", 123)
  for (bad_value in malformed_cases) {
    malformed <- variable_map
    index <- which(vapply(
      malformed$measures,
      function(spec) identical(spec$id, "gross_spending_total"),
      logical(1)
    ))
    malformed$measures[[index]]$source_locator <- bad_value
    testthat::expect_error(
      get_meps_measure_source_locator("gross_spending_total", malformed),
      "gross_spending_total"
    )
  }
})

testthat::test_that("MEPS shared provenance lookup fails closed on malformed config", {
  variable_map <- load_meps_variable_map()

  testthat::expect_error(
    get_meps_provenance_reference("missing-reference", variable_map),
    "missing-reference"
  )

  malformed_cases <- list(NULL, "", "   ", 123)
  for (bad_value in malformed_cases) {
    malformed <- variable_map
    malformed$provenance_references$cohort_routing_documentation <- bad_value
    testthat::expect_error(
      get_meps_provenance_reference(
        "cohort_routing_documentation",
        malformed
      ),
      "cohort_routing_documentation"
    )
  }
})

testthat::test_that("required HC-256 variable set is unchanged by config refactor", {
  expected <- sort(c(
    "DUPERSID", "PANEL", "AGE31X", "AGE24X",
    "COVIDEVER31", "COVIDEVER53", "LCEVER31", "LCEVER53",
    "COVSYMNOW31", "COVSYMNOW53", "COVREDABIL31", "COVREDABIL53",
    "TOTEXP24", "TOTSLF24", "OBTOTV24", "OPTOTV24", "ERTOT24", "IPDIS24",
    "EQMVAM53", "EQMBAM53", "EQPPAM53", "EQDENY53",
    "K6SUM42", "PHQ242", "VARSTR", "VARPSU", "PERWT24F",
    "ESAQWT24F", "SAQWT24F", "PESAQWT24F", "ESAQELIG", "SAQELIG"
  ))
  testthat::expect_identical(sort(required_hc256_variables()), expected)
})

testthat::test_that("estimator modules contain no brittle AHRQ locator literals", {
  repo_root <- Sys.getenv("DIAGNOSTIC_ODYSSEY_ROOT")
  estimator_files <- c(
    "estimate_population.R",
    "estimate_spending.R",
    "estimate_utilization.R",
    "estimate_admin_burden.R",
    "estimate_mental_health.R"
  )
  for (file in estimator_files) {
    path <- file.path(repo_root, "analysis", "r", "meps", file)
    source_text <- paste(readLines(path, warn = FALSE), collapse = "\n")
    testthat::expect_false(
      grepl("https://meps.ahrq.gov/", source_text, fixed = TRUE),
      info = file
    )
    testthat::expect_false(
      grepl("#2\\.5\\.(5|7|9)", source_text),
      info = file
    )
  }
})
