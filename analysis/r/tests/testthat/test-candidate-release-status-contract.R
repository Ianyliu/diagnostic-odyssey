read_repo_text <- function(path) {
  paste(
    readLines(file.path(repo_root, path), warn = FALSE),
    collapse = "\n"
  )
}

testthat::test_that("MEPS candidate review manifest uses governed preliminary status", {
  run_source <- read_repo_text(file.path("analysis", "r", "meps", "run_meps_2024.R"))
  manifest_start <- regexpr("review_manifest <- list(", run_source, fixed = TRUE)[[1]]
  manifest_end <- regexpr(
    "\njsonlite::write_json(\n  review_manifest,",
    run_source,
    fixed = TRUE
  )[[1]]

  testthat::expect_gt(manifest_start, 0)
  testthat::expect_gt(manifest_end, manifest_start)

  manifest_source <- substr(run_source, manifest_start, manifest_end - 1L)

  testthat::expect_true(grepl(
    'release_status = "preliminary"',
    manifest_source,
    fixed = TRUE
  ))
  testthat::expect_true(grepl(
    "automatic_release = FALSE",
    manifest_source,
    fixed = TRUE
  ))

  check_entries <- regmatches(
    manifest_source,
    gregexpr(
      'list\\(id = "[^"]+", status = "[^"]+"\\)',
      manifest_source
    )
  )[[1]]
  testthat::expect_length(check_entries, 8L)
  testthat::expect_true(all(grepl(
    'status = "pending"',
    check_entries,
    fixed = TRUE
  )))

  testthat::expect_false(grepl(
    "candidate_pending_review",
    run_source,
    fixed = TRUE
  ))
})

testthat::test_that("MEPS candidate workflow enforces preliminary pending-review state", {
  workflow_source <- read_repo_text(
    file.path(".github", "workflows", "meps-candidate.yml")
  )

  testthat::expect_true(grepl(
    '.release_status == "preliminary"',
    workflow_source,
    fixed = TRUE
  ))
  testthat::expect_true(grepl(
    ".automatic_release == false",
    workflow_source,
    fixed = TRUE
  ))
  testthat::expect_true(grepl(
    '([.checks[].status] | all(. == "pending"))',
    workflow_source,
    fixed = TRUE
  ))
  testthat::expect_true(grepl(
    '.release_status != "preliminary"',
    workflow_source,
    fixed = TRUE
  ))
  testthat::expect_false(grepl(
    "candidate_pending_review",
    workflow_source,
    fixed = TRUE
  ))
})

testthat::test_that("pipeline-generated estimate records remain preliminary-only", {
  testthat::expect_true(validate_candidate_records(list(valid_candidate_record())))

  non_preliminary <- valid_candidate_record(release_status = "reviewed_released")
  testthat::expect_error(
    validate_candidate_records(list(non_preliminary)),
    "Pipeline-generated estimates must remain release_status='preliminary'\\."
  )
})
