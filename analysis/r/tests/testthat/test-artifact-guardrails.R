testthat::test_that("result metadata propagates the analytical denominator", {
  record <- make_estimate_record(
    result = list(
      value = 2,
      standard_error = 0.2,
      interval_low = 1.5,
      interval_high = 2.5,
      interval_type = "95% t CI (Taylor linearization)",
      unweighted_n = 12L,
      weighted_denominator = 1234
    ),
    estimate_id = "x",
    measure_id = "x",
    label = "X",
    unit = "unit",
    denominator = "Exact denominator",
    universe = "Universe",
    system_boundary = "Boundary",
    source_locator = "Locator",
    weight_variable = "PERWT24F",
    artifact_version = "v",
    cohort_definition = "Explicit reviewed cohort",
    allowed_interpretation = "Descriptive",
    prohibited_interpretation = "Causal"
  )
  testthat::expect_equal(record$weighted_denominator, 1234)
  testthat::expect_equal(record$unweighted_n, 12L)
  testthat::expect_equal(record$denominator, "Exact denominator")
  testthat::expect_equal(record$cohort_definition, "Explicit reviewed cohort")
})

testthat::test_that("out-of-pocket components cannot masquerade as additive totals", {
  oop <- valid_candidate_record("out-of-pocket-spending-total", component_of_measure_id = NULL)
  testthat::expect_error(
    validate_candidate_records(list(oop)),
    "Out-of-pocket estimates must declare"
  )
  oop$component_of_measure_id <- "gross-all-cause-spending-total"
  testthat::expect_true(validate_candidate_records(list(oop)))
})

testthat::test_that("administrative time cannot be collapsed into an opaque aggregate", {
  combined <- valid_candidate_record("combined-admin-burden-score")
  testthat::expect_error(
    validate_candidate_records(list(combined)),
    "Administrative time measures must remain separate"
  )
})

testthat::test_that("candidate validation requires analytical provenance", {
  record <- valid_candidate_record()
  record$source_locator <- NULL
  testthat::expect_error(
    validate_candidate_records(list(record)),
    "lacks required fields"
  )
})
