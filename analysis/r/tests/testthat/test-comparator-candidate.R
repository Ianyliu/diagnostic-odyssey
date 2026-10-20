# Standalone comparator tests; no raw HC-256, no released-artifact changes.
source(file.path(Sys.getenv("DIAGNOSTIC_ODYSSEY_ROOT"),
                 "analysis", "r", "comparator", "comparator_methods.R"))
source(file.path(Sys.getenv("DIAGNOSTIC_ODYSSEY_ROOT"),
                 "analysis", "r", "comparator", "model_audit.R"))
source(file.path(Sys.getenv("DIAGNOSTIC_ODYSSEY_ROOT"),
                 "analysis", "r", "comparator", "influence_diagnostics.R"))

synthetic_comparator_frame <- function() {
  grid <- expand.grid(i = seq_len(16), psu = 1:2, stratum = 1:8)
  n <- nrow(grid)
  # Seeded Bernoulli outcomes avoid artificial perfect separation from modular
  # arithmetic while preserving reproducibility and rare-case imbalance.
  set.seed(20261019)
  case <- as.logical(stats::rbinom(n, size = 1L, prob = 0.34))
  positive <- as.logical(stats::rbinom(n, size = 1L, prob = 0.72))
  spend <- ifelse(positive, 200 + 19 * grid$i + 25 * grid$stratum +
                    100 * as.integer(case) + 30 * grid$psu, 0)
  data.frame(
    VARSTR = grid$stratum,
    VARPSU = grid$psu,
    PERWT24F = 1 + ((grid$i + grid$psu) %% 4) / 5,
    AGE31X = 25 + ((3 * grid$i + grid$stratum) %% 35),
    SEX = 1L + ((grid$i + grid$stratum) %% 2),
    REGION31 = 1L + ((grid$i + grid$psu) %% 4),
    PANEL = 28L + ((grid$i + grid$stratum + grid$psu) %% 2),
    INS31X = 1L + ((grid$i %/% 3 + grid$stratum + grid$psu) %% 2),
    INSCOV24 = 1L + ((grid$i + grid$psu + grid$stratum) %% 3),
    TOTEXP24 = spend,
    do_age_18_64 = rep(TRUE, n),
    do_current_long_covid = case,
    do_lc_history_positive = ifelse(case, TRUE,
                                   (grid$i + grid$stratum) %% 4 == 0)
  )
}

testthat::test_that("known prior history noncurrent stays in primary comparator", {
  d <- synthetic_comparator_frame()
  d$do_current_long_covid[[1]] <- NA
  d$do_lc_history_positive[[1]] <- NA
  p <- comparator_prepare(d)
  testthat::expect_true(is.na(p$.do_cmp_group[[1]]))
  testthat::expect_identical(levels(p$.do_cmp_group), c("noncurrent", "current"))
  historical <- which(!is.na(p$.do_cmp_group) &
                        as.character(p$.do_cmp_group) == "noncurrent" &
                        p$do_lc_history_positive %in% TRUE)
  testthat::expect_gt(length(historical), 0L)
  testthat::expect_true(all(as.character(p$.do_cmp_group[historical]) == "noncurrent"))
  testthat::expect_true(all(is.na(p$.do_cmp_restricted[historical])))
  no_history <- which(as.character(p$.do_cmp_group) == "noncurrent" &
                        p$do_lc_history_positive %in% FALSE)
  testthat::expect_gt(length(no_history), 0L)
  testthat::expect_true(all(as.character(p$.do_cmp_restricted[no_history]) == "noncurrent"))
})

testthat::test_that("all-zero expenditures are kept as valid; negatives excluded", {
  d <- synthetic_comparator_frame()
  d$TOTEXP24[[1]] <- 0
  d$TOTEXP24[[2]] <- -1
  d$TOTEXP24[[3]] <- -15
  p <- comparator_prepare(d)
  testthat::expect_equal(p$.do_cmp_y[[1]], 0)
  testthat::expect_true(is.na(p$.do_cmp_y[[2]]))
  testthat::expect_true(is.na(p$.do_cmp_y[[3]]))
  testthat::expect_false(p$.do_cmp_primary_complete[[2]])
  testthat::expect_false(p$.do_cmp_primary_complete[[3]])
})

testthat::test_that("unknown positive code fails before model recoding", {
  d <- synthetic_comparator_frame()
  for (field in c("SEX", "REGION31", "INS31X", "INSCOV24", "PANEL")) {
    bad <- d
    bad[[field]][[1]] <- 99
    testthat::expect_error(comparator_prepare(bad), "Unexpected HC-256 codes")
  }
  d$REGION31[[1]] <- -1
  p <- comparator_prepare(d)
  testthat::expect_true(is.na(p$.do_cmp_region[[1]]))
  testthat::expect_false(p$.do_cmp_primary_complete[[1]])
})

testthat::test_that("unadjusted covariance-aware contrast matches joint survey contrast", {
  d <- comparator_prepare(synthetic_comparator_frame())
  design <- build_meps_design(d, "PERWT24F")
  result <- comparator_unadjusted(design)
  reference <- survey::svyby(
    ~.do_cmp_y, ~.do_cmp_group,
    subset(design, .do_cmp_primary_complete),
    survey::svymean, covmat = TRUE
  )
  v <- as.matrix(stats::vcov(reference))
  cvec <- c(-1, 1)
  expect_diff <- sum(as.numeric(stats::coef(reference)) * cvec)
  expect_se <- sqrt(as.numeric(t(cvec) %*% v %*% cvec))
  testthat::expect_equal(result$results$current_minus_noncurrent$estimate, expect_diff,
                         tolerance = 1e-8)
  testthat::expect_equal(result$results$current_minus_noncurrent$standard_error, expect_se,
                         tolerance = 1e-8)
  testthat::expect_equal(result$covariance_noncurrent_current, unname(v[1, 2]),
                         tolerance = 1e-8)
  testthat::expect_equal(result$ci_df, survey::degf(design))
  testthat::expect_true(all(unlist(result$unweighted_valid_n) > 0))
})

testthat::test_that("full-design df and weight provenance stay PERSON-specific", {
  d <- comparator_prepare(synthetic_comparator_frame())
  design <- build_meps_design(d, "PERWT24F")
  diag <- comparator_domain_diagnostics(d, design)
  testthat::expect_identical(attr(design, "do_weight_variable"), "PERWT24F")
  testthat::expect_equal(diag$full_person_design_df, survey::degf(design))
  testthat::expect_equal(diag$classifiable_n, nrow(d))
  testthat::expect_equal(diag$current_n + diag$noncurrent_n, nrow(d))
  testthat::expect_equal(diag$unresolved_n, 0)
  testthat::expect_equal(
    diag$known_no_history_noncurrent_n + diag$known_prior_history_noncurrent_n,
    diag$noncurrent_n
  )
})

testthat::test_that("two-part models refit under design bootstrap without claiming causal effect", {
  d <- comparator_prepare(synthetic_comparator_frame())
  design <- build_meps_design(d, "PERWT24F")
  point <- comparator_stage_predictions(
    stats::weights(design),
    design$variables, ".do_cmp_group"
  )
  testthat::expect_equal(unname(point[["difference"]]),
                         unname(point[["current"]] - point[["noncurrent"]]))
  testthat::expect_true(all(is.finite(point)))
  testthat::expect_true(all(point[1:2] > 0))

  result <- comparator_adjusted(design, replicates = 16L, seed = 73L)
  testthat::expect_true(is.finite(
    result$results$current_minus_noncurrent$standard_error
  ))
  testthat::expect_identical(result$replicates_successful, 16L)
  testthat::expect_equal(result$ci_df, survey::degf(design))
  testthat::expect_false(result$insurance_sensitivity)
  testthat::expect_true(all(is.finite(result$covariance)))
})

testthat::test_that("unsupported small samples do not pass precision screen", {
  d <- comparator_prepare(synthetic_comparator_frame())
  design <- build_meps_design(d, "PERWT24F")
  diagnostics <- comparator_domain_diagnostics(d, design)
  unadjusted <- comparator_unadjusted(design)
  fake_adjusted <- list(replicates_requested = 400L, replicates_successful = 400L)
  gate <- comparator_precision_screen(
    unadjusted, fake_adjusted, diagnostics,
    min_valid_n = 100000L, min_positive_n = 30000L
  )
  testthat::expect_false(gate$numerical_advisory_passed)
  testthat::expect_true(gate$scientific_review_required)
})


testthat::test_that("survey-stage audit reports fit and effective support on synthetic data", {
  d <- comparator_prepare(synthetic_comparator_frame())
  design <- build_meps_design(d, "PERWT24F")
  audit <- comparator_model_audit(design)
  testthat::expect_true(audit$stage_zero$converged)
  testthat::expect_true(audit$stage_positive$converged)
  testthat::expect_equal(audit$full_design$degrees_of_freedom,
                         survey::degf(design))
  testthat::expect_identical(audit$full_design$weight, "PERWT24F")
  testthat::expect_gt(audit$full_design$unique_stratum_psu_n, 1L)
  testthat::expect_true(all(unlist(audit$stage_zero$observed_probability_range) >= 0))
  testthat::expect_true(all(unlist(audit$stage_zero$observed_probability_range) <= 1))
  testthat::expect_true(all(unlist(audit$stage_positive$observed_conditional_mean_range) > 0))
  testthat::expect_true(all(vapply(audit$positive_spending_support,
                                  function(x) x$unweighted_n > 0, logical(1))))
})


testthat::test_that("covariance helper rejects asymmetry, negative diagonal and non-PSD matrices", {
  testthat::expect_equal(comparator_t_ci(c(4, 6), diag(c(1, 2)), df = 10)[[1]]$estimate, 4)
  testthat::expect_error(comparator_t_ci(c(4, 6), matrix(c(1, 0, 1, 1), 2), 10),
                         "not symmetric")
  testthat::expect_error(comparator_t_ci(c(4, 6), diag(c(-0.2, 1)), 10),
                         "negative marginal variance")
  testthat::expect_error(comparator_t_ci(c(4, 6), matrix(c(1, 2, 2, 1), 2), 10),
                         "not positive semidefinite")
  testthat::expect_error(comparator_t_ci(c(4, 6), matrix(c(NaN, 0, 0, 1), 2), 10),
                         "Nonfinite")
  valid <- matrix(c(1, 0.3, 0.3, 1), 2)
  testthat::expect_equal(comparator_validate_covariance(c(1, 2), valid), valid)
})

testthat::test_that("adjusted joint covariance difference is algebraically preserved", {
  d <- comparator_prepare(synthetic_comparator_frame())
  des <- build_meps_design(d, "PERWT24F")
  fit <- comparator_adjusted(des, replicates = 16L, seed = 83L)
  v <- fit$covariance
  testthat::expect_equal(
    fit$results$current_minus_noncurrent$standard_error^2,
    v[1, 1] + v[2, 2] - 2 * v[1, 2], tolerance = 1e-6)
  testthat::expect_equal(
    fit$results$current_minus_noncurrent$estimate,
    fit$results$current_mean$estimate - fit$results$noncurrent_mean$estimate,
    tolerance = 1e-7)
  testthat::expect_identical(fit$bootstrap_failure_count, 0L)
  testthat::expect_length(fit$replicate_failures, 0L)
})

testthat::test_that("adjusted screening explicitly tests contrast covariance and means", {
  d <- comparator_prepare(synthetic_comparator_frame())
  des <- build_meps_design(d, "PERWT24F")
  unadj <- comparator_unadjusted(des)
  diag <- comparator_domain_diagnostics(d, des)
  adj <- comparator_adjusted(des, 16L, seed = 101L)
  ok <- comparator_precision_screen(unadj, adj, diag,
                                     min_valid_n = 1L, min_positive_n = 1L,
                                     max_mean_rse = 100)
  testthat::expect_true(ok$screening_checks$adjusted_covariance_finite_symmetric_psd)
  testthat::expect_true(ok$screening_checks$adjusted_contrast_precision)
  testthat::expect_true(ok$screening_checks$current_adjusted_mean_rse_ok)
  testthat::expect_false(ok$publication_approved)
  adj$covariance[1, 1] <- -1
  bad <- comparator_precision_screen(unadj, adj, diag)
  testthat::expect_false(bad$screening_checks$adjusted_covariance_finite_symmetric_psd)
  testthat::expect_false(bad$numerical_advisory_passed)
})

testthat::test_that("positive AND zero support, rank failure, missingness fail explicitly", {
  d <- synthetic_comparator_frame()
  d$TOTEXP24[d$do_current_long_covid] <- 100
  prepared <- comparator_prepare(d)
  des <- build_meps_design(prepared, "PERWT24F")
  testthat::expect_error(comparator_stage_predictions(
    stats::weights(des), des$variables, ".do_cmp_group"),
    "stage=support group=current.*zero=0")
  testthat::expect_error(comparator_adjusted(des, 16L, seed = 11L),
                         "Bootstrap full_sample: stage=support|Bootstrap replicate=")

  d <- synthetic_comparator_frame()
  d$REGION31[] <- 1L
  prepared <- comparator_prepare(d)
  des <- build_meps_design(prepared, "PERWT24F")
  testthat::expect_error(comparator_stage_predictions(
    stats::weights(des), des$variables, ".do_cmp_group"),
    "stage=binary_logit|rank-deficient")

  d <- synthetic_comparator_frame()
  d$TOTEXP24[1:3] <- -1
  d$REGION31[4:8] <- -1
  d$INS31X[9:12] <- -1
  prepared <- comparator_prepare(d)
  des <- build_meps_design(prepared, "PERWT24F")
  flow <- comparator_domain_diagnostics(prepared, des)$complete_case_flow_by_group
  for (g in c("current", "noncurrent")) {
    x <- flow[[g]]
    testthat::expect_equal(x$primary_complete_n + x$primary_excluded_from_classifiable_n,
                           x$classifiable_n)
    testthat::expect_equal(x$primary_complete_weight + x$primary_excluded_from_classifiable_weight,
                           x$classifiable_weight, tolerance = 1e-7)
    testthat::expect_equal(x$primary_complete_n,
                           x$insurance_complete_n + x$insurance_excluded_from_primary_n)
  }
})

testthat::test_that("insurance coefficients are compared on identical analytic sample", {
  d <- synthetic_comparator_frame()
  d$INS31X[c(2, 23, 44)] <- -1
  d <- comparator_prepare(d)
  des <- build_meps_design(d, "PERWT24F")
  original <- comparator_adjusted(des, 16L, seed = 103L)
  paired_base <- comparator_adjusted(des, 16L, seed = 103L,
                                     reference_sample = "insurance")
  with_ins <- comparator_adjusted(des, 16L, seed = 103L,
                                  reference_sample = "insurance", insurance = TRUE)
  testthat::expect_gt(original$unweighted_complete_n, paired_base$unweighted_complete_n)
  testthat::expect_equal(paired_base$unweighted_complete_n, with_ins$unweighted_complete_n)
  testthat::expect_equal(paired_base$weighted_complete_by_group, with_ins$weighted_complete_by_group)
  testthat::expect_identical(with_ins$reference_sample, "insurance")
  testthat::expect_error(comparator_adjusted(des, 16L, insurance = TRUE),
                         "insurance-complete")
  testthat::expect_true(all(is.finite(
    vapply(with_ins$results, function(x) x$estimate, numeric(1)))))
})

testthat::test_that("Kish, sparse cells, extreme weights and spending-tail effects audited", {
  d <- synthetic_comparator_frame()
  d$PERWT24F[1] <- 1e6
  d$TOTEXP24[1] <- 1e9
  d$REGION31[c(4, 18)] <- -1
  p <- comparator_prepare(d)
  des <- build_meps_design(p, "PERWT24F")
  audit <- comparator_influence_diagnostics(des)
  testthat::expect_identical(audit$weight, "PERWT24F")
  testthat::expect_lte(audit$group$noncurrent$kish_effective_n,
                       audit$group$noncurrent$unweighted_n)
  testthat::expect_lte(audit$group$current$kish_effective_n,
                       audit$group$current$unweighted_n)
  testthat::expect_gt(audit$joint_covariate_overlap$observed_joint_cells_n, 0)
  testthat::expect_gt(audit$psu_influence$n_psu_examined, 1)
  testthat::expect_true(is.finite(audit$psu_influence$max_absolute_change_in_contrast))
  testthat::expect_true(is.finite(audit$spending_tail$delete_top_one_point_contrast))
  testthat::expect_true(audit$spending_tail$no_records_trimmed_in_primary_model)
  testthat::expect_true(audit$spending_tail$group$current$n > 0)
})


testthat::test_that("independent two-part reference reproduces pooled standardization", {
  d <- comparator_prepare(synthetic_comparator_frame())
  design <- build_meps_design(d, "PERWT24F")
  df <- design$variables
  weights <- as.numeric(stats::weights(design))
  df$.do_cmp_w <- weights
  df$.do_cmp_exposure <- factor(as.character(df$.do_cmp_group),
                                levels = c("noncurrent", "current"))
  rhs <- ".do_cmp_exposure + .do_cmp_age10 + .do_cmp_sex + .do_cmp_region + .do_cmp_panel"
  fit0 <- stats::glm(stats::as.formula(paste(".do_cmp_positive ~", rhs)),
                     data = df, weights = .do_cmp_w,
                     family = stats::quasibinomial(link = "logit"))
  fitplus <- stats::glm(stats::as.formula(paste(".do_cmp_y ~", rhs)),
                        data = df[df$.do_cmp_positive == 1L, , drop = FALSE],
                        weights = .do_cmp_w,
                        family = stats::Gamma(link = "log"))
  expected <- vapply(c("noncurrent", "current"), function(group) {
    scenario <- df
    scenario$.do_cmp_exposure <- factor(rep(group, nrow(df)),
                                        levels = c("noncurrent", "current"))
    stats::weighted.mean(
      stats::predict(fit0, newdata = scenario, type = "response") *
      stats::predict(fitplus, newdata = scenario, type = "response"), weights)
  }, numeric(1))
  estimator <- comparator_stage_predictions(weights, df, ".do_cmp_group")
  testthat::expect_equal(unname(estimator[1:2]), unname(expected), tolerance = 1e-7)
  testthat::expect_equal(unname(estimator[[3]]),
                         unname(diff(expected)), tolerance = 1e-7)
})

testthat::test_that("exact bootstrap replicate index and group support failures are auditable", {
  d <- comparator_prepare(synthetic_comparator_frame())
  design <- build_meps_design(d, "PERWT24F")
  w <- as.numeric(stats::weights(design))
  invalid <- w
  invalid[as.character(design$variables$.do_cmp_group) == "current"] <- 0
  replicates <- cbind(w, w, invalid)
  fn <- function(weights, data) {
    comparator_stage_predictions(weights, data, ".do_cmp_group")
  }
  testthat::expect_error(
    comparator_trace_replicate_failures(replicates, design$variables, fn),
    "Bootstrap replicate=3/3: stage=support group=current:.*support="
  )
  testthat::expect_error(
    comparator_trace_replicate_failures(matrix(1, 2, 1), design$variables, fn),
    "Invalid bootstrap replicate matrix"
  )
})

testthat::test_that("runner syntax, data gate and output isolation are invariant", {
  root <- Sys.getenv("DIAGNOSTIC_ODYSSEY_ROOT")
  runner <- file.path(root, "analysis", "r", "comparator",
                      "run_comparator_candidate.R")
  testthat::expect_silent(parse(file = runner))
  src <- paste(readLines(runner, warn = FALSE), collapse = "\n")
  testthat::expect_match(src, "independent_methods_review")
  testthat::expect_match(src, "failed-candidate.json", fixed = TRUE)
  testthat::expect_match(src, "assert_sha256_matches", fixed = TRUE)
  testthat::expect_match(src, "candidate_step", fixed = TRUE)
  testthat::expect_false(grepl("artifacts[\x2f]reviewed", src))
})

testthat::test_that("cross-cell zero/positive support and both scenarios are audited", {
  d <- comparator_prepare(synthetic_comparator_frame())
  design <- build_meps_design(d, "PERWT24F")
  support <- comparator_influence_diagnostics(design)$joint_covariate_overlap
  testthat::expect_gte(support$cells_missing_zero_in_any_present_group_n, 0L)
  testthat::expect_gte(support$cells_missing_positive_in_any_present_group_n, 0L)
  testthat::expect_lte(support$both_groups_present_n, support$observed_joint_cells_n)
  audit <- comparator_model_audit(design)
  for (group in c("noncurrent", "current")) {
    x <- audit$both_exposure_scenario_predictions[[group]]
    testthat::expect_true(all(unlist(x[c("min_probability", "max_probability")]) >= 0))
    testthat::expect_lte(x$max_probability, 1)
    testthat::expect_gt(x$conditional_spend_min, 0)
  }
})
