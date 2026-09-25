testthat::test_that("EQDENY53 cleaner preserves the reviewed substantive Yes/No denominator", {
  raw <- c(1, 2, 3, 4, -1, -15, NA)
  cleaned <- meps_yes_no_response(raw)

  testthat::expect_equal(cleaned[1:2], c(1, 0))
  testthat::expect_true(all(is.na(cleaned[3:7])))
  testthat::expect_equal(sum(!is.na(cleaned)), 2L)
})

testthat::test_that("ESAQ annualized-time cleaners preserve reviewed top-code boundaries", {
  specs <- list(
    EQMVAM53 = 2080,
    EQMBAM53 = 720,
    EQPPAM53 = 520
  )

  for (variable in names(specs)) {
    maximum <- specs[[variable]]
    cleaned <- meps_bounded_score(c(0, maximum, -1, -15, maximum + 1), 0, maximum)

    testthat::expect_equal(cleaned[1], 0, info = variable)
    testthat::expect_equal(cleaned[2], maximum, info = variable)
    testthat::expect_true(is.na(cleaned[3]), info = variable)
    testthat::expect_true(is.na(cleaned[4]), info = variable)
    testthat::expect_true(is.na(cleaned[5]), info = variable)
  }
})

testthat::test_that("K6 cleaner and serious-distress threshold remain 0-24 and >=13", {
  testthat::expect_equal(k6_valid(c(0, 24)), c(0, 24))
  testthat::expect_true(all(is.na(k6_valid(c(-1, -15, 25)))))

  indicator <- k6_serious_indicator(c(12, 13, 24, -1, 25))
  testthat::expect_equal(indicator[1:3], c(0, 1, 1))
  testthat::expect_true(all(is.na(indicator[4:5])))
})

testthat::test_that("PHQ-2 cleaner and screen-positive threshold remain 0-6 and >=3", {
  testthat::expect_equal(phq2_valid(c(0, 6)), c(0, 6))
  testthat::expect_true(all(is.na(phq2_valid(c(-1, -15, 7)))))

  indicator <- phq2_positive_indicator(c(2, 3, 6, -1, 7))
  testthat::expect_equal(indicator[1:3], c(0, 1, 1))
  testthat::expect_true(all(is.na(indicator[4:5])))
})

testthat::test_that("candidate numeric validation fails closed and identifies the estimate", {
  invalid_cases <- list(
    value_na = list(field = "value", value = NA_real_, message = "invalid value"),
    value_nan = list(field = "value", value = NaN, message = "invalid value"),
    value_inf = list(field = "value", value = Inf, message = "invalid value"),
    se_na = list(field = "standard_error", value = NA_real_, message = "invalid standard_error"),
    se_inf = list(field = "standard_error", value = Inf, message = "invalid standard_error"),
    se_negative = list(field = "standard_error", value = -0.1, message = "standard_error"),
    low_inf = list(field = "interval_low", value = -Inf, message = "invalid interval_low"),
    high_inf = list(field = "interval_high", value = Inf, message = "invalid interval_high")
  )

  for (case_name in names(invalid_cases)) {
    case <- invalid_cases[[case_name]]
    record <- valid_candidate_record()
    record[[case$field]] <- case$value
    testthat::expect_error(
      validate_candidate_records(list(record)),
      paste0("id-example.*", case$message),
      info = case_name
    )
  }

  reversed <- valid_candidate_record()
  reversed$interval_low <- 2
  reversed$interval_high <- 1
  testthat::expect_error(
    validate_candidate_records(list(reversed)),
    "id-example.*interval_low > interval_high"
  )

  below <- valid_candidate_record()
  below$value <- 0.4
  testthat::expect_error(
    validate_candidate_records(list(below)),
    "id-example.*below interval_low"
  )

  above <- valid_candidate_record()
  above$value <- 1.6
  testthat::expect_error(
    validate_candidate_records(list(above)),
    "id-example.*above interval_high"
  )

  testthat::expect_true(validate_candidate_records(list(valid_candidate_record())))
})
