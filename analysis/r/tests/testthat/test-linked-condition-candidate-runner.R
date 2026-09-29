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
