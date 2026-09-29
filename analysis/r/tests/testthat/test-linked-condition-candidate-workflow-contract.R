read_linked_condition_candidate_repo_text <- function(path) {
  paste(readLines(file.path(repo_root, path), warn = FALSE), collapse = "\n")
}

testthat::test_that("linked-condition candidate workflow is manual-only and aggregate-only", {
  workflow <- read_linked_condition_candidate_repo_text(
    file.path(".github", "workflows", "meps-linked-condition-candidate.yml")
  )
  testthat::expect_true(grepl("workflow_dispatch:", workflow, fixed = TRUE))
  testthat::expect_false(grepl("pull_request:", workflow, fixed = TRUE))
  testthat::expect_false(grepl("push:", workflow, fixed = TRUE))
  testthat::expect_true(grepl("run_linked_condition_candidate.R", workflow, fixed = TRUE))
  testthat::expect_true(grepl("validate-linked-condition-candidate-cli.ts", workflow, fixed = TRUE))
  cli_invocation <- paste(
    "packages/contracts/src/validate-linked-condition-candidate-cli.ts \\",
    '            "$OUTPUT_DIR/linked-condition-candidate-estimates.json" \\',
    '            "$OUTPUT_DIR/candidate-manifest.json" \\',
    '            "$OUTPUT_DIR/diagnostics.json"',
    sep = "\n"
  )
  testthat::expect_true(grepl(cli_invocation, workflow, fixed = TRUE))
  testthat::expect_true(grepl('test ! -e "$OUTPUT_DIR/bundle.json"', workflow, fixed = TRUE))
  testthat::expect_true(grepl("hc256-source-metadata.json", workflow, fixed = TRUE))
  testthat::expect_true(grepl("linked-condition-source-metadata.json", workflow, fixed = TRUE))
  testthat::expect_true(grepl("retention-days: 14", workflow, fixed = TRUE))
})

testthat::test_that("linked-condition candidate workflow enforces privacy and no release/runtime admission", {
  workflow <- read_linked_condition_candidate_repo_text(
    file.path(".github", "workflows", "meps-linked-condition-candidate.yml")
  )
  for (needle in c(
    "-name '*.dta'",
    "-name '*.zip'",
    "-name '*.csv'",
    "-name '*.rds'",
    "-name '*.RData'",
    "-name '*.parquet'",
    "-name '*.feather'",
    "DUPERSID|CONDIDX|EVNTIDX|CLNKIDX",
    ".automatic_release == false",
    ".runtime_eligible == false",
    ".runtime_selection_changed == false",
    ".reviewed_artifact_modified == false",
    '.schema_version == "2.0"',
    '.precision_rule_version == "meps_hc_precision_v1"',
    ".precision_rule_reviewed == true"
  )) {
    testthat::expect_true(grepl(needle, workflow, fixed = TRUE), info = needle)
  }
})

testthat::test_that("linked-condition candidate workflow does not reuse ordinary candidate or feasibility runners", {
  workflow <- read_linked_condition_candidate_repo_text(
    file.path(".github", "workflows", "meps-linked-condition-candidate.yml")
  )
  testthat::expect_false(grepl("run_meps_2024.R", workflow, fixed = TRUE))
  testthat::expect_false(grepl("run_linked_condition_feasibility.R", workflow, fixed = TRUE))
  testthat::expect_false(grepl("validate-artifact-cli.ts", workflow, fixed = TRUE))
})


testthat::test_that("linked-condition candidate workflow freezes schema-v2 precision governance without product release", {
  workflow <- read_linked_condition_candidate_repo_text(
    file.path(".github", "workflows", "meps-linked-condition-candidate.yml")
  )
  for (needle in c(
    '.schema_version == "2.0"',
    '.precision_rule_version == "meps_hc_precision_v1"',
    ".precision_rule_reviewed == true",
    '.precision_governance.rule_version == "meps_hc_precision_v1"',
    ".precision_governance.rule_reviewed == true",
    ".precision_governance.product_release_eligible == false",
    "[.candidates[].product_release_eligible] | all(. == false)"
  )) {
    testthat::expect_true(grepl(needle, workflow, fixed = TRUE), info = needle)
  }
  testthat::expect_false(grepl("reliability_rule_reviewed", workflow, fixed = TRUE))
})
