testthat::test_that("stage-aware warnings remain observable and are counted", {
  registry <- new_warning_registry()
  observed <- character()

  result <- withCallingHandlers(
    run_stage_with_warning_capture(
      "synthetic_stage",
      {
        warning("synthetic analytical warning")
        warning("synthetic analytical warning")
        42
      },
      registry
    ),
    warning = function(w) {
      observed <<- c(observed, conditionMessage(w))
      invokeRestart("muffleWarning")
    }
  )

  records <- warning_registry_records(registry)

  testthat::expect_equal(result, 42)
  testthat::expect_equal(length(observed), 2L)
  testthat::expect_true(all(observed == "synthetic analytical warning"))
  testthat::expect_length(records, 1L)
  testthat::expect_identical(records[[1]]$stage, "synthetic_stage")
  testthat::expect_match(records[[1]]$condition_class, "warning")
  testthat::expect_identical(records[[1]]$message, "synthetic analytical warning")
  testthat::expect_equal(records[[1]]$count, 2L)
})
