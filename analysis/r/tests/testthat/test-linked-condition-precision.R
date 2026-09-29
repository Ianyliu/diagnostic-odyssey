precision_path <- file.path(
  repo_root,
  "analysis",
  "r",
  "meps",
  "linked_condition_precision.R"
)
source(precision_path, local = TRUE)

precision_candidate <- function(
  unit = "encounters/person/year",
  n = 380L,
  value = 0.20,
  standard_error = 0.05,
  interval_high = 0.30,
  rse = 0.25,
  nonzero_n = 20L,
  event_n = 40L
) {
  list(
    unit = unit,
    unweighted_target_n = n,
    value = value,
    standard_error = standard_error,
    interval_high = interval_high,
    relative_standard_error = rse,
    unweighted_nonzero_person_n = nonzero_n,
    observed_qualifying_event_n = event_n
  )
}

expect_precision <- function(result, status, reporting, reasons = character(), valid = TRUE) {
  testthat::expect_identical(result$computationally_valid, valid)
  testthat::expect_identical(result$precision_status, status)
  testthat::expect_identical(result$precision_reporting_status, reporting)
  actual_reasons <- as.character(unlist(result$precision_reason_codes, use.names = FALSE))
  testthat::expect_identical(actual_reasons, reasons)
  testthat::expect_identical(result$precision_rule_version, "meps_hc_precision_v1")
  testthat::expect_identical(result$product_release_eligible, FALSE)
}

testthat::test_that("MEPS sample-size boundary is exact", {
  insufficient <- adjudicate_linked_condition_precision(precision_candidate(n = 59L))
  expect_precision(
    insufficient,
    "insufficient_sample",
    "suppress_insufficient_sample",
    "sample_n_below_60"
  )

  sufficient <- adjudicate_linked_condition_precision(precision_candidate(n = 60L))
  expect_precision(sufficient, "meps_precise", "reportable")
})

testthat::test_that("continuous RSE boundaries follow meps_hc_precision_v1 exactly", {
  expect_precision(
    adjudicate_linked_condition_precision(precision_candidate(rse = 0.299999999)),
    "meps_precise",
    "reportable"
  )
  expect_precision(
    adjudicate_linked_condition_precision(precision_candidate(rse = 0.30)),
    "meps_questionable_precision",
    "reportable_with_caution",
    "rse_30_to_50"
  )
  expect_precision(
    adjudicate_linked_condition_precision(precision_candidate(rse = 0.50)),
    "meps_questionable_precision",
    "reportable_with_caution",
    "rse_30_to_50"
  )
  expect_precision(
    adjudicate_linked_condition_precision(precision_candidate(rse = 0.500000001)),
    "meps_unstable_precision",
    "suppress_precision",
    "rse_above_50"
  )
})

testthat::test_that("proportion RSE and low-percentage exception boundaries are exact", {
  base <- function(rse, interval_high) {
    precision_candidate(
      unit = "proportion",
      value = 0.05,
      standard_error = 0.01,
      interval_high = interval_high,
      rse = rse,
      nonzero_n = 22L,
      event_n = 109L
    )
  }

  expect_precision(
    adjudicate_linked_condition_precision(base(0.299999999, 0.08)),
    "meps_precise",
    "reportable"
  )
  expect_precision(
    adjudicate_linked_condition_precision(base(0.30, 0.08)),
    "meps_questionable_precision",
    "reportable_with_caution",
    "rse_30_to_50"
  )
  expect_precision(
    adjudicate_linked_condition_precision(base(0.50, 0.08)),
    "meps_questionable_precision",
    "reportable_with_caution",
    "rse_30_to_50"
  )
  expect_precision(
    adjudicate_linked_condition_precision(base(0.500000001, 0.10)),
    "meps_low_percentage_exception",
    "reportable_with_caution",
    c("rse_above_50", "low_percentage_exception")
  )
  expect_precision(
    adjudicate_linked_condition_precision(base(0.500000001, 0.100000001)),
    "meps_unstable_precision",
    "suppress_precision",
    "rse_above_50"
  )
})

testthat::test_that("project-specific zero support is exact and preserves multiple reasons", {
  zero <- precision_candidate(
    n = 380L,
    value = 0,
    standard_error = 0,
    interval_high = 0,
    rse = NULL,
    nonzero_n = 0L,
    event_n = 0L
  )
  expect_precision(
    adjudicate_linked_condition_precision(zero),
    "unsupported_zero",
    "suppress_unsupported_zero",
    "zero_positive_support"
  )

  zero_small_n <- zero
  zero_small_n$unweighted_target_n <- 59L
  expect_precision(
    adjudicate_linked_condition_precision(zero_small_n),
    "unsupported_zero",
    "suppress_unsupported_zero",
    c("sample_n_below_60", "zero_positive_support")
  )

  positive_support_zero_estimate <- precision_candidate(
    value = 0,
    standard_error = 0.01,
    interval_high = 0.02,
    rse = 0.5,
    nonzero_n = 1L,
    event_n = 1L
  )
  result <- adjudicate_linked_condition_precision(positive_support_zero_estimate)
  testthat::expect_identical(result$precision_status, "review_required")
  testthat::expect_false("zero_positive_support" %in% unlist(result$precision_reason_codes))

  inconsistent_zero <- zero
  inconsistent_zero$standard_error <- 0.01
  expect_precision(
    adjudicate_linked_condition_precision(inconsistent_zero),
    "review_required",
    "suppress_pending_review",
    "precision_input_invalid",
    valid = FALSE
  )
})

testthat::test_that("invalid precision inputs fail closed without new thresholds", {
  cases <- list(
    negative_n = precision_candidate(n = -1L),
    noninteger_n = precision_candidate(n = 60.5),
    negative_se = precision_candidate(standard_error = -0.01),
    negative_rse = precision_candidate(rse = -0.01),
    nonfinite_rse = precision_candidate(rse = Inf),
    nonzero_null_rse = precision_candidate(value = 0.2, rse = NULL),
    malformed_unit = precision_candidate(unit = "events"),
    nonfinite_interval_high = precision_candidate(interval_high = Inf),
    nonzero_exceeds_target = precision_candidate(n = 10L, nonzero_n = 11L),
    negative_event_count = precision_candidate(event_n = -1L),
    support_mismatch = precision_candidate(nonzero_n = 0L, event_n = 1L)
  )

  for (case in cases) {
    result <- adjudicate_linked_condition_precision(case)
    testthat::expect_identical(result$computationally_valid, FALSE)
    testthat::expect_identical(result$precision_status, "review_required")
    testthat::expect_identical(result$precision_reporting_status, "suppress_pending_review")
    testthat::expect_true("precision_input_invalid" %in% unlist(result$precision_reason_codes))
    testthat::expect_identical(result$product_release_eligible, FALSE)
  }
})

testthat::test_that("reviewed six real-data-shaped outcomes are frozen", {
  reviewed <- list(
    A = precision_candidate(
      unit = "proportion",
      n = 380L,
      value = 0.04796093404373186,
      standard_error = 0.01140890642074523,
      interval_high = 0.07049348101652217,
      rse = 0.2378791541120182,
      nonzero_n = 22L,
      event_n = 109L
    ),
    B = precision_candidate(
      n = 380L,
      value = 0.1973708941306436,
      standard_error = 0.06722129795093537,
      interval_high = 0.3301327030010547,
      rse = 0.3405836420158299,
      nonzero_n = 22L,
      event_n = 109L
    ),
    office = precision_candidate(
      n = 380L,
      value = 0.1562085830927701,
      standard_error = 0.05513049229600549,
      interval_high = 0.2650910965853873,
      rse = 0.3529287008721169,
      nonzero_n = 17L,
      event_n = 86L
    ),
    outpatient = precision_candidate(
      n = 380L,
      value = 0.03350284715268952,
      standard_error = 0.01902069550751614,
      interval_high = 0.07106864874423717,
      rse = 0.5677337039693717,
      nonzero_n = 7L,
      event_n = 21L
    ),
    emergency = precision_candidate(
      n = 380L,
      value = 0.007659463885183907,
      standard_error = 0.006239326370914688,
      interval_high = 0.01998210983796063,
      rse = 0.8145904810627459,
      nonzero_n = 2L,
      event_n = 2L
    ),
    inpatient = precision_candidate(
      n = 380L,
      value = 0,
      standard_error = 0,
      interval_high = 0,
      rse = NULL,
      nonzero_n = 0L,
      event_n = 0L
    )
  )

  expected <- list(
    A = c("meps_precise", "reportable"),
    B = c("meps_questionable_precision", "reportable_with_caution"),
    office = c("meps_questionable_precision", "reportable_with_caution"),
    outpatient = c("meps_unstable_precision", "suppress_precision"),
    emergency = c("meps_unstable_precision", "suppress_precision"),
    inpatient = c("unsupported_zero", "suppress_unsupported_zero")
  )
  expected_reasons <- list(
    A = character(),
    B = "rse_30_to_50",
    office = "rse_30_to_50",
    outpatient = "rse_above_50",
    emergency = "rse_above_50",
    inpatient = "zero_positive_support"
  )

  for (name in names(reviewed)) {
    result <- adjudicate_linked_condition_precision(reviewed[[name]])
    expect_precision(
      result,
      expected[[name]][[1]],
      expected[[name]][[2]],
      expected_reasons[[name]]
    )
  }
})


testthat::test_that("precision reason codes serialize as JSON arrays at the runner boundary", {
  testthat::skip_if_not_installed("jsonlite")

  cases <- list(
    empty = adjudicate_linked_condition_precision(precision_candidate(rse = 0.25)),
    singleton = adjudicate_linked_condition_precision(precision_candidate(rse = 0.30)),
    multiple = adjudicate_linked_condition_precision(precision_candidate(
      unit = "proportion",
      value = 0.05,
      standard_error = 0.01,
      interval_high = 0.10,
      rse = 0.51,
      nonzero_n = 22L,
      event_n = 109L
    ))
  )

  serialized <- jsonlite::toJSON(
    cases,
    pretty = FALSE,
    auto_unbox = TRUE,
    null = "null",
    na = "null",
    digits = 15
  )

  testthat::expect_match(
    serialized,
    '"empty":\\{[^}]*"precision_reason_codes":\\[\\]',
    perl = TRUE
  )
  testthat::expect_match(
    serialized,
    '"singleton":\\{[^}]*"precision_reason_codes":\\["rse_30_to_50"\\]',
    perl = TRUE
  )
  testthat::expect_match(
    serialized,
    '"multiple":\\{[^}]*"precision_reason_codes":\\["rse_above_50","low_percentage_exception"\\]',
    perl = TRUE
  )

  testthat::expect_false(grepl(
    '"precision_reason_codes":\\{',
    serialized,
    perl = TRUE
  ))
})
