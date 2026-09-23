testthat::test_that("all eight utilization records name the Round 3/1 2024 status anchor", {
  data <- synthetic_design_data()
  data$OBTOTV24 <- c(0, 1, 2, 0, 3, 1, 0, 4)
  data$OPTOTV24 <- c(0, 0, 1, 1, 2, 0, 3, 1)
  data$ERTOT24 <- c(0, 0, 1, 0, 0, 2, 0, 1)
  data$IPDIS24 <- c(0, 0, 0, 1, 0, 0, 1, 0)

  records <- estimate_utilization(
    build_meps_designs(data),
    artifact_version = "metadata-regression"
  )

  testthat::expect_length(records, 8L)

  variable_by_stem <- c(
    "office-based-provider-visits" = "OBTOTV24",
    "outpatient-provider-visits" = "OPTOTV24",
    "emergency-room-visits" = "ERTOT24",
    "hospital-discharges" = "IPDIS24"
  )

  for (record in records) {
    stem <- sub("-(mean|any)$", "", record$measure_id)
    variable <- unname(variable_by_stem[[stem]])
    expected <- paste0(
      "Adults age 18-64 who met the operational current-Long-COVID definition ",
      "at their Round 3/1 2024 interview, with valid ",
      variable
    )
    testthat::expect_equal(record$denominator, expected)
  }
})

testthat::test_that("represented-population metadata names classifiable status and no imputation", {
  data <- synthetic_design_data()
  data$do_current_long_covid_known <- !is.na(data$do_current_long_covid)
  data$do_current_long_covid_indicator <- ifelse(
    data$do_current_long_covid_known,
    as.numeric(data$do_current_long_covid),
    NA_real_
  )

  record <- estimate_represented_population(
    build_meps_designs(data),
    artifact_version = "population-metadata-regression"
  )

  testthat::expect_match(record$allowed_interpretation, "status-classifiable")
  testthat::expect_true(any(grepl(
    "unresolved current-Long-COVID status.*not imputed",
    unlist(record$limitations),
    ignore.case = TRUE
  )))
})

testthat::test_that("ESAQ metadata preserves earlier cohort anchor and later supplement timing", {
  data <- synthetic_design_data()
  data$EQMVAM53 <- seq(1, 8)
  data$EQMBAM53 <- seq(1, 8)
  data$EQPPAM53 <- seq(1, 8)
  data$EQDENY53 <- rep(c(1, 2), 4)

  records <- estimate_admin_burden(
    build_meps_designs(data),
    artifact_version = "esaq-metadata-regression"
  )

  testthat::expect_length(records, 4L)
  testthat::expect_true(all(vapply(
    records,
    function(record) grepl(
      "earlier Round 3/1 2024 interview",
      record$denominator,
      fixed = TRUE
    ),
    logical(1)
  )))
  testthat::expect_true(all(vapply(
    records,
    function(record) grepl(
      "Panel 28 Round 5 / Panel 29 Round 3",
      record$denominator,
      fixed = TRUE
    ),
    logical(1)
  )))

  time_records <- records[vapply(
    records,
    function(record) record$unit == "hours/person/year",
    logical(1)
  )]
  testthat::expect_length(time_records, 3L)
  testthat::expect_true(all(vapply(
    time_records,
    function(record) grepl(
      "annualized hours-per-year",
      record$allowed_interpretation,
      fixed = TRUE
    ),
    logical(1)
  )))
  testthat::expect_true(all(vapply(
    time_records,
    function(record) any(grepl(
      "not necessarily hours observed during calendar year 2024",
      unlist(record$limitations),
      fixed = TRUE
    )),
    logical(1)
  )))
})
