# Standalone comparator tests; no raw HC-256, no released-artifact changes.
source(file.path(Sys.getenv("DIAGNOSTIC_ODYSSEY_ROOT"),
                 "analysis", "r", "comparator", "comparator_methods.R"))

synthetic_comparator_frame <- function() {
  grid <- expand.grid(i = seq_len(16), psu = 1:2, stratum = 1:8)
  n <- nrow(grid)
  case <- ((2 * grid$i + 3 * grid$psu + grid$stratum) %% 7) <= 2
  positive <- ((grid$i + grid$psu + grid$stratum) %% 6) != 0
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
    INS31X = 1L + ((grid$i + grid$stratum) %% 2),
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
  expect_se <- sqrt(unname(t(cvec) %*% v %*% cvec))
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
  testthat::expect_false(gate$public_display_recommended)
  testthat::expect_true(gate$scientific_review_required)
})
