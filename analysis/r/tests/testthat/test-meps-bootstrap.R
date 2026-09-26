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

testthat::test_that("bootstrap-loaded MEPS modules do not source their own dependencies", {
  repo_root <- Sys.getenv("DIAGNOSTIC_ODYSSEY_ROOT")
  module_files <- c(
    "estimate_population.R",
    "estimate_spending.R",
    "estimate_utilization.R",
    "estimate_admin_burden.R",
    "estimate_mental_health.R",
    "cohort_long_covid.R",
    "survey_designs.R",
    "cohort_diagnostics.R",
    "build_candidate_artifact.R"
  )

  for (file in module_files) {
    path <- file.path(repo_root, "analysis", "r", "meps", file)
    source_lines <- readLines(path, warn = FALSE)
    top_level_source_calls <- grep("^source\\(", source_lines, value = TRUE)
    testthat::expect_equal(
      length(top_level_source_calls),
      0L,
      label = paste(file, "top-level source() count")
    )
  }
})


testthat::test_that("standalone HC-256 downloader loads MEPS config before loader", {
  repo_root <- Sys.getenv("DIAGNOSTIC_ODYSSEY_ROOT")
  downloader_path <- file.path(
    repo_root,
    "pipelines",
    "data",
    "download_meps_hc256.R"
  )
  source_lines <- trimws(readLines(downloader_path, warn = FALSE))
  source_calls <- source_lines[grepl("^source\\(file\\.path", source_lines)]

  expected_sources <- c(
    'source(file.path("analysis", "r", "lib", "paths.R"))',
    'source(file.path("analysis", "r", "lib", "meps_config.R"))',
    'source(file.path("analysis", "r", "meps", "load_hc256.R"))',
    'source(file.path("analysis", "r", "lib", "file_integrity.R"))'
  )

  testthat::expect_equal(source_calls, expected_sources)
})

testthat::test_that("standalone HC-256 loader dependencies resolve in a clean environment without network", {
  repo_root <- Sys.getenv("DIAGNOSTIC_ODYSSEY_ROOT")
  clean_environment <- new.env(parent = baseenv())
  old_wd <- getwd()
  setwd(repo_root)
  on.exit(setwd(old_wd), add = TRUE)

  for (path in c(
    file.path("analysis", "r", "lib", "paths.R"),
    file.path("analysis", "r", "lib", "meps_config.R"),
    file.path("analysis", "r", "meps", "load_hc256.R")
  )) {
    sys.source(path, envir = clean_environment)
  }

  testthat::expect_true(
    exists("load_variable_map", envir = clean_environment, inherits = FALSE)
  )
  testthat::expect_true(
    exists("required_hc256_variables", envir = clean_environment, inherits = FALSE)
  )

  variable_map <- clean_environment$load_variable_map()
  required <- clean_environment$required_hc256_variables()

  testthat::expect_type(variable_map, "list")
  testthat::expect_true(length(required) > 0L)
  testthat::expect_true(all(c(
    variable_map$design$variance_stratum,
    variable_map$design$variance_psu,
    variable_map$design$person_weight,
    variable_map$design$esaq_weight
  ) %in% required))
})
