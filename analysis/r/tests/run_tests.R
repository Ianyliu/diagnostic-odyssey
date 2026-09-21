#!/usr/bin/env Rscript

if (!requireNamespace("testthat", quietly = TRUE)) {
  stop("Package 'testthat' is required. Run Rscript analysis/r/install_dependencies.R", call. = FALSE)
}

repo_root <- normalizePath(getwd(), winslash = "/", mustWork = TRUE)
Sys.setenv(DIAGNOSTIC_ODYSSEY_ROOT = repo_root)

testthat::test_dir(
  file.path(repo_root, "analysis", "r", "tests", "testthat"),
  reporter = "summary",
  stop_on_failure = TRUE
)
