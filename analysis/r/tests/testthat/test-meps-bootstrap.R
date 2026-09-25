testthat::test_that("canonical MEPS bootstrap loads into a clean environment", {
  repo_root <- Sys.getenv("DIAGNOSTIC_ODYSSEY_ROOT")
  clean_environment <- new.env(parent = baseenv())
  old_wd <- getwd()
  setwd(repo_root)
  on.exit(setwd(old_wd), add = TRUE)
  source(
    file.path("analysis", "r", "meps", "bootstrap.R"),
    local = clean_environment
  )

  required_functions <- c(
    "load_hc256",
    "construct_long_covid_cohort",
    "build_meps_designs",
    "estimate_represented_population",
    "estimate_spending",
    "estimate_utilization",
    "estimate_admin_burden",
    "estimate_mental_health",
    "validate_candidate_records"
  )
  for (name in required_functions) {
    testthat::expect_true(
      exists(name, envir = clean_environment, inherits = FALSE),
      info = name
    )
  }
})

testthat::test_that("canonical MEPS callers use bootstrap without parallel module lists", {
  repo_root <- Sys.getenv("DIAGNOSTIC_ODYSSEY_ROOT")
  caller_files <- c(
    file.path(repo_root, "analysis", "r", "meps", "run_meps_2024.R"),
    file.path(repo_root, "analysis", "r", "tests", "testthat", "helper-load.R"),
    file.path(repo_root, "analysis", "r", "review", "meps_variance_policy_review.R")
  )

  for (path in caller_files) {
    source_lines <- readLines(path, warn = FALSE)
    source_calls <- grep("^source\\(", source_lines, value = TRUE)
    testthat::expect_equal(length(source_calls), 1L)
    testthat::expect_match(source_calls[[1]], "meps.*bootstrap\\.R")
  }
})
