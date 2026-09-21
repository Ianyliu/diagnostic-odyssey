#!/usr/bin/env Rscript

if (!requireNamespace("testthat", quietly = TRUE)) {
  stop("Package 'testthat' is required. Run Rscript analysis/r/install_dependencies.R", call. = FALSE)
}

testthat::test_dir(
  file.path("analysis", "r", "tests", "testthat"),
  reporter = "summary",
  stop_on_failure = TRUE
)
