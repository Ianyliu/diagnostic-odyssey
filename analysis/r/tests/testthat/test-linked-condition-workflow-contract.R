read_linked_condition_repo_text <- function(path) {
  paste(readLines(file.path(repo_root, path), warn = FALSE), collapse = "\n")
}

testthat::test_that("manual feasibility workflow is dispatch-only and aggregate-only", {
  workflow <- read_linked_condition_repo_text(
    file.path(".github", "workflows", "meps-linked-condition-feasibility.yml")
  )
  testthat::expect_true(grepl("workflow_dispatch:", workflow, fixed = TRUE))
  testthat::expect_false(grepl("pull_request:", workflow, fixed = TRUE))
  testthat::expect_false(grepl("push:", workflow, fixed = TRUE))
  testthat::expect_true(grepl("test ! -e \"$OUTPUT_DIR/bundle.json\"", workflow, fixed = TRUE))
  testthat::expect_true(grepl(".product_estimates_generated == false", workflow, fixed = TRUE))
  testthat::expect_true(grepl(".spending_estimator_present == false", workflow, fixed = TRUE))
  testthat::expect_true(grepl(".runtime_selection_changed == false", workflow, fixed = TRUE))
  testthat::expect_true(grepl(".reviewed_artifact_modified == false", workflow, fixed = TRUE))
  testthat::expect_true(grepl("-name '*.dta'", workflow, fixed = TRUE))
  testthat::expect_true(grepl("-name '*.zip'", workflow, fixed = TRUE))
  testthat::expect_true(grepl("retention-days: 14", workflow, fixed = TRUE))
})

testthat::test_that("Phase A runner does not implement expenditure estimation or ArtifactBundle output", {
  runner <- read_linked_condition_repo_text(
    file.path("analysis", "r", "meps", "run_linked_condition_feasibility.R")
  )
  testthat::expect_false(grepl("TOTEXP", runner, fixed = TRUE))
  testthat::expect_false(grepl("OBXP", runner, fixed = TRUE))
  testthat::expect_false(grepl("OPXP", runner, fixed = TRUE))
  testthat::expect_false(grepl("ERXP", runner, fixed = TRUE))
  testthat::expect_false(grepl("IPXP", runner, fixed = TRUE))
  testthat::expect_false(grepl("bundle.json", runner, fixed = TRUE))
  testthat::expect_true(grepl("product_estimates_generated = FALSE", runner, fixed = TRUE))
  testthat::expect_true(grepl("spending_estimator_present = FALSE", runner, fixed = TRUE))
  testthat::expect_true(grepl("bundle_generated = FALSE", runner, fixed = TRUE))
})

testthat::test_that("source scope excludes home health and prescriptions from event files", {
  cfg <- read_linked_condition_source_config()
  pufs <- vapply(cfg$sources, function(x) x$puf_id, character(1))
  testthat::expect_setequal(
    pufs,
    c("HC-255", "HC-254I", "HC-254G", "HC-254F", "HC-254E", "HC-254D", "HC-256")
  )
  testthat::expect_false("HC-254H" %in% pufs)
  testthat::expect_false("HC-254A" %in% pufs)
  testthat::expect_identical(cfg$condition_selection$included_code, "U09")
  testthat::expect_identical(cfg$condition_selection$excluded_substitute, "U07")
})

testthat::test_that("required variable contracts preserve identifiers and design fields", {
  cfg <- read_linked_condition_source_config()
  by_id <- setNames(cfg$sources, vapply(cfg$sources, function(x) x$puf_id, character(1)))

  testthat::expect_true(all(
    c("DUPERSID", "CONDN", "CONDIDX", "ICD10CDX", "PERWT24F", "VARSTR", "VARPSU")
      %in% unlist(by_id[["HC-255"]]$required_variables, use.names = FALSE)
  ))
  testthat::expect_true(all(
    c("DUPERSID", "CONDIDX", "EVNTIDX", "CLNKIDX", "EVENTYPE")
      %in% unlist(by_id[["HC-254I"]]$required_variables, use.names = FALSE)
  ))
  for (puf in c("HC-254D", "HC-254E", "HC-254F", "HC-254G")) {
    testthat::expect_true(all(
      c("DUPERSID", "EVNTIDX", "PERWT24F", "VARSTR", "VARPSU")
        %in% unlist(by_id[[puf]]$required_variables, use.names = FALSE)
    ))
  }
})

testthat::test_that("new source hashes are deliberately unpinned rather than guessed", {
  cfg <- read_linked_condition_source_config()
  new_sources <- Filter(function(x) !identical(x$puf_id, "HC-256"), cfg$sources)
  testthat::expect_true(all(vapply(
    new_sources,
    function(x) is.null(x$expected_zip_sha256) && is.null(x$expected_extracted_dta_sha256),
    logical(1)
  )))
})
