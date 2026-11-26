# Synthetic-only C3 regression tests: no HC-256 required.
source(file.path(Sys.getenv("DIAGNOSTIC_ODYSSEY_ROOT"),
                 "analysis/r/comparator/comparator_methods.R"))
# Load the fixture without depending on test execution order.
for (expr in parse(file.path(Sys.getenv("DIAGNOSTIC_ODYSSEY_ROOT"),
                            "analysis/r/tests/testthat/test-comparator-candidate.R"))) {
  if (is.call(expr) && identical(expr[[1]], as.name("<-")) &&
      identical(expr[[2]], as.name("synthetic_comparator_frame"))) eval(expr)
}
fit_weight_frame <- function() comparator_prepare(synthetic_comparator_frame())
fit_weight_point <- function(w, d = fit_weight_frame(), insurance = FALSE) {
  comparator_stage_predictions(w, d, ".do_cmp_group", insurance)
}
fit_weight_models <- function(d, w, mustart = NULL) {
  d$w <- w
  form <- .do_cmp_positive ~ .do_cmp_group + .do_cmp_age10 +
    .do_cmp_sex + .do_cmp_region + .do_cmp_panel
  list(binary = glm(form, data = d, weights = w, family = quasibinomial(),
                    mustart = mustart),
       gamma = glm(update(form, .do_cmp_y ~ .),
                   data = d[d$.do_cmp_positive == 1, ], weights = w,
                   family = Gamma(link = "log")))
}

testthat::test_that("common fit scales preserve both scenarios and original inputs", {
  d <- fit_weight_frame(); w <- d$PERWT24F; before <- d
  for (insurance in c(FALSE, TRUE)) {
    baseline <- fit_weight_point(w, d, insurance)
    for (multiplier in c(1e-200, 1e-8, 1e8, 1e200)) {
      testthat::expect_equal(fit_weight_point(w * multiplier, d, insurance),
                             baseline, tolerance = 1e-9)
    }
  }
  testthat::expect_identical(d, before)
  w[1:10] <- 0
  testthat::expect_equal(fit_weight_point(w, d),
                         fit_weight_point(w[w > 0], d[w > 0, ]), tolerance = 1e-9)
})

testthat::test_that("invalid normalization fails closed and positive support cannot underflow", {
  d <- fit_weight_frame(); w <- d$PERWT24F
  for (bad in list(-1, NA_real_, NaN, Inf)) {
    ww <- w; ww[1] <- bad
    testthat::expect_error(fit_weight_point(ww, d), "stage=weights")
  }
  testthat::expect_error(fit_weight_point(w * 0, d), "stage=weights")
  testthat::expect_error(fit_weight_point(w[-1], d), "stage=weights|replacement")
  ww <- w; ww[] <- 1e300; ww[1] <- 1e-300
  testthat::expect_error(fit_weight_point(ww, d), "stage=weights.*lost positive support")
  testthat::expect_error(fit_weight_point(rep(1e308, length(w)), d), "stage=weights")
  # Near-uniform subnormal positive values still normalize to finite positives.
  testthat::expect_true(all(is.finite(fit_weight_point(rep(1e-310, length(w)), d))))
})

testthat::test_that("normalization controls weight-dependent initialization", {
  d <- fit_weight_frame(); w <- d$PERWT24F * 1e6
  raw <- suppressWarnings(fit_weight_models(d, w))
  normalized <- fit_weight_models(d, w / mean(w))
  neutral <- fit_weight_models(d, w, rep(0.5, nrow(d)))
  bad_start <- suppressWarnings(fit_weight_models(d, w / mean(w),
                                   (w * d$.do_cmp_positive + 0.5) / (w + 1)))
  testthat::expect_false(comparator_fit_accuracy(raw$binary, "binary_logit")$passed)
  testthat::expect_false(comparator_fit_accuracy(bad_start$binary, "binary_logit")$passed)
  testthat::expect_true(comparator_fit_accuracy(normalized$binary, "binary_logit")$passed)
  testthat::expect_equal(coef(normalized$binary), coef(neutral$binary), tolerance = 1e-6)
  testthat::expect_equal(coef(normalized$gamma), coef(raw$gamma), tolerance = 1e-9)
  testthat::expect_lt(comparator_fit_accuracy(normalized$binary, "binary_logit")$objective,
                      comparator_fit_accuracy(raw$binary, "binary_logit")$objective)
})

testthat::test_that("actual score and stable objectives have distinct stage budgets", {
  d <- fit_weight_frame(); fits <- fit_weight_models(d, d$PERWT24F / mean(d$PERWT24F))
  for (stage in c("binary_logit", "positive_gamma")) {
    fit <- fits[[if (stage == "binary_logit") "binary" else "gamma"]]
    a <- comparator_fit_accuracy(fit, stage)
    x <- model.matrix(fit); y <- fit$y; w <- fit$prior.weights
    eta <- drop(x %*% coef(fit))
    residual <- if (stage == "binary_logit") y - plogis(eta) else y / exp(eta) - 1
    testthat::expect_equal(a$max_abs_average_score,
                           max(abs(crossprod(x, w * residual) / sum(w))), tolerance = 1e-12)
    testthat::expect_true(a$passed)
    testthat::expect_lte(a$objective, a$null_objective + 1e-10)
    testthat::expect_identical(a$score_limit, if (stage == "binary_logit") 1e-7 else 1e-4)
    # A nominal convergence flag cannot bless a perturbed solution.
    fit$converged <- TRUE; fit$coefficients[1] <- fit$coefficients[1] + 0.01
    testthat::expect_false(comparator_fit_accuracy(fit, stage)$passed)
    fit$coefficients[1] <- 1000
    z <- comparator_fit_accuracy(fit, stage)
    testthat::expect_false(z$passed)
    testthat::expect_gt(z$objective, z$null_objective)
  }
})

testthat::test_that("separation rank nonfinite and original support guards survive", {
  d <- fit_weight_frame(); w <- d$PERWT24F * 1e5
  for (quasi in c(FALSE, TRUE)) {
    bad <- d
    if (quasi) {
      bad$.do_cmp_positive[bad$.do_cmp_age10 > 0] <- 1L
      bad$.do_cmp_positive[bad$.do_cmp_age10 < 0] <- 0L
    } else bad$.do_cmp_positive <- as.integer(bad$.do_cmp_age10 > 0)
    bad$.do_cmp_y <- ifelse(bad$.do_cmp_positive == 1L, 500, 0)
    testthat::expect_error(fit_weight_point(w, bad), "stage=binary_logit|stage=binary_prediction")
  }
  for (value in c(0, NA, Inf)) {
    bad <- d
    if (value == 0 || is.na(value)) bad$.do_cmp_age10[] <- value else bad$.do_cmp_age10[1] <- value
    testthat::expect_error(fit_weight_point(w, bad), "stage=binary_logit")
  }
  bad <- d
  # Binary matrix remains full rank; Gamma matrix loses age support.
  bad$.do_cmp_age10[bad$.do_cmp_positive == 1L] <- 0
  testthat::expect_error(fit_weight_point(w, bad), "stage=positive_gamma.*rank-deficient")
  ww <- w; ww[d$.do_cmp_group == "current"] <- 0
  testthat::expect_error(fit_weight_point(ww, d), "stage=support.*group=current")
  bad <- d; bad$.do_cmp_positive[bad$.do_cmp_group == "current"] <- 1L
  testthat::expect_error(fit_weight_point(w, bad), "stage=support.*group=current")
  testthat::expect_error(comparator_trace_replicate_failures(cbind(w, w, ww), d,
    function(w, d) fit_weight_point(w, d)), "Bootstrap replicate=3/3: stage=support group=current")
})

testthat::test_that("full design replication and MSE covariance survive independent column scaling", {
  raw <- synthetic_comparator_frame()
  raw$do_age_18_64[1:12] <- FALSE
  raw$INS31X[20:24] <- -1
  d <- comparator_prepare(raw); design <- build_meps_design(d, "PERWT24F")
  before <- design
  set.seed(103L)
  full <- survey::as.svrepdesign(design, type = "bootstrap", replicates = 16L, mse = TRUE)
  for (spec in c("primary", "paired_base", "insurance")) {
    dom <- if (spec == "primary") subset(full, .do_cmp_primary_complete) else
      subset(full, .do_cmp_insurance_complete)
    snapshot <- dom
    theta <- function(w, d) fit_weight_point(w, d, insurance = spec == "insurance")
    point <- theta(as.numeric(weights(dom, type = "sampling")), dom$variables)
    W <- as.matrix(weights(dom, type = "analysis"))
    A <- t(vapply(seq_len(ncol(W)), function(i) theta(W[, i], dom$variables), numeric(3)))
    C <- t(vapply(seq_len(ncol(W)), function(i)
      theta(W[, i] * 10^seq(-8, 8, length.out = ncol(W))[i], dom$variables), numeric(3)))
    covariance <- function(z) crossprod(sweep(z, 2, point) * sqrt(dom$rscales)) * dom$scale
    package <- survey::withReplicates(dom, theta, return.replicates = TRUE)
    testthat::expect_equal(A, C, tolerance = 1e-9)
    testthat::expect_equal(as.numeric(covariance(A)), as.numeric(vcov(package)), tolerance = 1e-9)
    testthat::expect_equal(covariance(A), covariance(C), tolerance = 1e-9)
    result <- comparator_adjusted(design, 16L, 103L, insurance = spec == "insurance",
                                  reference_sample = if (spec == "primary") "primary" else "insurance")
    testthat::expect_equal(as.numeric(result$covariance), as.numeric(covariance(A)), tolerance = 1e-9)
    testthat::expect_equal(result$ci_df, survey::degf(design))
    testthat::expect_identical(dom, snapshot)
  }
  testthat::expect_identical(design, before)
})
