testthat::test_that("linked-condition candidate runner remains candidate-only and excludes specialty/spending", {
  path <- file.path(repo_root, "analysis", "r", "meps", "run_linked_condition_candidate.R")
  runner <- paste(readLines(path, warn = FALSE), collapse = "\n")

  testthat::expect_false(grepl("bundle.json", runner, fixed = TRUE))
  testthat::expect_false(grepl("MEDPTYPE_M18", runner, fixed = TRUE))
  testthat::expect_false(grepl("DRSPLTY_M18", runner, fixed = TRUE))
  testthat::expect_false(grepl("TOTEXP", runner, fixed = TRUE))
  testthat::expect_false(grepl("OBXP", runner, fixed = TRUE))
  testthat::expect_false(grepl("OPXP", runner, fixed = TRUE))
  testthat::expect_false(grepl("ERXP", runner, fixed = TRUE))
  testthat::expect_false(grepl("IPXP", runner, fixed = TRUE))
  testthat::expect_true(grepl('status = "preliminary-candidate-only"', runner, fixed = TRUE))
  testthat::expect_true(grepl("automatic_release = FALSE", runner, fixed = TRUE))
  testthat::expect_true(grepl("runtime_eligible = FALSE", runner, fixed = TRUE))
  testthat::expect_true(grepl("reliability_rule_reviewed = FALSE", runner, fixed = TRUE))
  testthat::expect_true(grepl(
    "candidate_path,\n    manifest_path,\n    diagnostics_path",
    runner,
    fixed = TRUE
  ))
})

testthat::test_that("linked-condition candidate runner freezes reviewed real-data reconciliation gates", {
  path <- file.path(repo_root, "analysis", "r", "meps", "run_linked_condition_candidate.R")
  runner <- paste(readLines(path, warn = FALSE), collapse = "\n")
  for (needle in c(
    "target_n = 380L",
    "target_nonzero_person_n = 22L",
    "target_zero_person_n = 358L",
    "target_unique_events_n = 109L",
    "office = 86L",
    "outpatient = 21L",
    "emergency = 2L",
    "inpatient = 0L",
    "overall_unique_events_n = 259L",
    "multiplicity_n = 116L",
    "represented_strata_n = 99L",
    "represented_stratum_psu_pairs_n = 185L",
    "weighted_target_denominator_tolerance = 0.001"
  )) {
    testthat::expect_true(grepl(needle, runner, fixed = TRUE), info = needle)
  }
})


testthat::test_that("linked-condition reconciliation family counts serialize as keyed JSON objects", {
  testthat::skip_if_not_installed("jsonlite")

  helper_path <- file.path(
    repo_root,
    "analysis",
    "r",
    "meps",
    "linked_condition_candidate_serialization.R"
  )
  source(helper_path, local = TRUE)

  expected_family_counts <- as_linked_condition_family_count_object(c(
    office = 86L,
    outpatient = 21L,
    emergency = 2L,
    inpatient = 0L
  ))
  actual_family_counts <- as_linked_condition_family_count_object(list(
    office = 86L,
    outpatient = 21L,
    emergency = 2L,
    inpatient = 0L
  ))

  payload <- list(
    reconciliation = list(
      expected = list(family_counts = expected_family_counts),
      actual = list(family_counts = actual_family_counts)
    )
  )

  serialized <- jsonlite::toJSON(
    payload,
    pretty = TRUE,
    auto_unbox = TRUE,
    null = "null",
    na = "null",
    digits = 15
  )
  parsed <- jsonlite::fromJSON(serialized, simplifyVector = FALSE)

  families <- c("office", "outpatient", "emergency", "inpatient")
  expected_json <- parsed$reconciliation$expected$family_counts
  actual_json <- parsed$reconciliation$actual$family_counts

  testthat::expect_type(expected_json, "list")
  testthat::expect_type(actual_json, "list")
  testthat::expect_identical(names(expected_json), families)
  testthat::expect_identical(names(actual_json), families)
  testthat::expect_identical(
    as.integer(unlist(expected_json, use.names = FALSE)),
    c(86L, 21L, 2L, 0L)
  )
  testthat::expect_identical(
    as.integer(unlist(actual_json, use.names = FALSE)),
    c(86L, 21L, 2L, 0L)
  )
  testthat::expect_match(
    serialized,
    '"family_counts"\\s*:\\s*\\{',
    perl = TRUE
  )
  testthat::expect_false(grepl(
    '"family_counts"\\s*:\\s*\\[',
    serialized,
    perl = TRUE
  ))
})
