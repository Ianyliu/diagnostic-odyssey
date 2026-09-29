linked_condition_estimator_fixture <- function() {
  data.frame(
    DUPERSID = paste0("P", 1:8),
    VARSTR = rep(c(1, 2), each = 4),
    VARPSU = rep(c(1, 1, 2, 2), 2),
    PERWT24F = c(1, 3, 1, 1, 2, 1, 4, 1),
    do_age_18_64 = TRUE,
    do_current_long_covid = c(TRUE, TRUE, FALSE, FALSE, TRUE, TRUE, FALSE, FALSE),
    do_current_long_covid_known = TRUE,
    do_u09_condition_n = c(1L, 0L, 0L, 0L, 1L, 0L, 0L, 0L),
    do_u09_linked_event_n = c(2L, 0L, 0L, 0L, 1L, 0L, 0L, 0L),
    do_has_u09_condition = c(TRUE, FALSE, FALSE, FALSE, TRUE, FALSE, FALSE, FALSE),
    do_has_u09_linked_event = c(TRUE, FALSE, FALSE, FALSE, TRUE, FALSE, FALSE, FALSE),
    do_u09_linked_office_event_n = c(1L, 0L, 0L, 0L, 1L, 0L, 0L, 0L),
    do_u09_linked_outpatient_event_n = c(1L, 0L, 0L, 0L, 0L, 0L, 0L, 0L),
    do_u09_linked_emergency_event_n = 0L,
    do_u09_linked_inpatient_event_n = 0L,
    stringsAsFactors = FALSE
  )
}

testthat::test_that("linked-condition candidate estimators use full PERSON design before domain", {
  data <- linked_condition_estimator_fixture()
  design <- build_meps_design(data, "PERWT24F")
  integrity <- assert_linked_condition_candidate_design_integrity(data, design)
  estimates <- estimate_linked_condition_service_use(design)

  testthat::expect_true(integrity$target_domain_membership_exact)
  testthat::expect_equal(integrity$target_excluded_from_full_person_design_n, 0L)
  testthat::expect_equal(
    estimates$u09_linked_service_use_person_share$ci_degrees_of_freedom,
    survey::degf(design)
  )

  target_only <- build_meps_design(
    data[build_linked_condition_target(data), , drop = FALSE],
    "PERWT24F"
  )
  testthat::expect_false(isTRUE(all.equal(
    survey::degf(design),
    survey::degf(target_only)
  )))
})

testthat::test_that("Candidate A is person based and Candidate B retains explicit zero persons", {
  data <- linked_condition_estimator_fixture()
  design <- build_meps_design(data, "PERWT24F")
  estimates <- estimate_linked_condition_service_use(design)
  a <- estimates$u09_linked_service_use_person_share
  b <- estimates$u09_linked_service_use_encounters_mean

  testthat::expect_equal(a$unweighted_target_n, 4L)
  testthat::expect_equal(a$unweighted_nonzero_person_n, 2L)
  testthat::expect_equal(a$observed_qualifying_event_n, 3L)
  testthat::expect_equal(b$unweighted_target_n, 4L)
  testthat::expect_equal(b$unweighted_nonzero_person_n, 2L)
  testthat::expect_equal(b$observed_qualifying_event_n, 3L)
  testthat::expect_equal(a$weighted_denominator, 7)
  testthat::expect_equal(b$weighted_denominator, 7)
  testthat::expect_equal(b$unweighted_target_n, 4L)
  testthat::expect_false(isTRUE(all.equal(a$value, 2 / 4)))
})

testthat::test_that("Candidate C families share target denominator and reconcile event totals", {
  data <- linked_condition_estimator_fixture()
  design <- build_meps_design(data, "PERWT24F")
  estimates <- estimate_linked_condition_service_use(design)
  ids <- paste0(
    "u09_linked_service_use_",
    c("office", "outpatient", "emergency", "inpatient"),
    "_encounters_mean"
  )
  families <- estimates[ids]

  testthat::expect_true(all(vapply(families, function(x) x$unweighted_target_n == 4L, logical(1))))
  testthat::expect_true(all(vapply(families, function(x) x$weighted_denominator == 7, logical(1))))
  testthat::expect_equal(
    sum(vapply(families, function(x) x$observed_qualifying_event_n, integer(1))),
    estimates$u09_linked_service_use_encounters_mean$observed_qualifying_event_n
  )
  testthat::expect_equal(estimates$u09_linked_service_use_office_encounters_mean$observed_qualifying_event_n, 2L)
  testthat::expect_equal(estimates$u09_linked_service_use_outpatient_encounters_mean$observed_qualifying_event_n, 1L)
})

testthat::test_that("zero-support family preserves null RSE and zero support without fake design", {
  data <- linked_condition_estimator_fixture()
  design <- build_meps_design(data, "PERWT24F")
  inpatient <- estimate_linked_condition_service_use(design)$u09_linked_service_use_inpatient_encounters_mean

  testthat::expect_equal(inpatient$value, 0)
  testthat::expect_equal(inpatient$standard_error, 0)
  testthat::expect_equal(inpatient$interval_low, 0)
  testthat::expect_equal(inpatient$interval_high, 0)
  testthat::expect_null(inpatient$relative_standard_error)
  testthat::expect_equal(inpatient$unweighted_nonzero_person_n, 0L)
  testthat::expect_equal(inpatient$nonzero_support$represented_strata_n, 0L)
  testthat::expect_equal(inpatient$nonzero_support$represented_stratum_psu_pairs_n, 0L)
  testthat::expect_false("reliability_status" %in% names(inpatient))
  testthat::expect_false("reliability_rule_version" %in% names(inpatient))
  testthat::expect_false("release_eligible" %in% names(inpatient))
})

testthat::test_that("candidate generation fails closed for governed target missing design fields", {
  data <- linked_condition_estimator_fixture()
  data$VARSTR[1] <- NA
  design <- build_meps_design(data, "PERWT24F")
  testthat::expect_error(
    assert_linked_condition_candidate_design_integrity(data, design),
    "missing VARSTR"
  )

  data <- linked_condition_estimator_fixture()
  data$VARPSU[1] <- NA
  design <- build_meps_design(data, "PERWT24F")
  testthat::expect_error(
    assert_linked_condition_candidate_design_integrity(data, design),
    "missing VARPSU"
  )
})

testthat::test_that("support diagnostics distinguish target and nonzero-person representation", {
  data <- linked_condition_estimator_fixture()
  design <- build_meps_design(data, "PERWT24F")
  a <- estimate_linked_condition_service_use(design)$u09_linked_service_use_person_share
  testthat::expect_equal(a$target_support$unweighted_person_n, 4L)
  testthat::expect_equal(a$nonzero_support$unweighted_person_n, 2L)
  testthat::expect_lte(a$nonzero_support$represented_strata_n, a$target_support$represented_strata_n)
  testthat::expect_lte(
    a$nonzero_support$represented_stratum_psu_pairs_n,
    a$target_support$represented_stratum_psu_pairs_n
  )
})
