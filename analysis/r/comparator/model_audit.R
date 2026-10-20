# Independent descriptive/model diagnostics for comparator scientific review.
# Never changes ordinary released estimates or the predictor/estimator implementation.

comparator_model_audit <- function(full_design, insurance = FALSE,
                                   reference_sample = c("primary", "insurance")) {
  reference_sample <- match.arg(reference_sample)
  if (insurance && reference_sample != "insurance") {
    stop("Insurance model audit requires insurance-complete sample.", call. = FALSE)
  }
  assert_survey_available()
  domain <- if (reference_sample == "insurance") {
    subset(full_design, .do_cmp_insurance_complete)
  } else {
    subset(full_design, .do_cmp_primary_complete)
  }
  pos_domain <- subset(domain, .do_cmp_positive == 1L)
  df <- domain$variables
  positive <- pos_domain$variables
  predictors <- ".do_cmp_group + .do_cmp_age10 + .do_cmp_sex + .do_cmp_region + .do_cmp_panel"
  if (isTRUE(insurance)) predictors <- paste(predictors, "+ .do_cmp_insurance")
  form_zero <- stats::as.formula(paste(".do_cmp_positive ~", predictors))
  form_positive <- stats::as.formula(paste(".do_cmp_y ~", predictors))
  stage_zero <- survey::svyglm(
    form_zero, design = domain, family = stats::quasibinomial(link = "logit")
  )
  stage_positive <- survey::svyglm(
    form_positive, design = pos_domain, family = stats::Gamma(link = "log")
  )
  if (!isTRUE(stage_zero$converged) || !isTRUE(stage_positive$converged) ||
      stage_zero$rank < length(stats::coef(stage_zero)) ||
      stage_positive$rank < length(stats::coef(stage_positive))) {
    stop("Survey-weighted model audit found nonconvergence or singularity.", call. = FALSE)
  }
  coefficient_summary <- function(fit) {
    beta <- stats::coef(fit)
    se <- sqrt(diag(stats::vcov(fit)))
    as.list(stats::setNames(lapply(seq_along(beta), function(i) {
      list(coefficient = unname(beta[[i]]), design_robust_se = unname(se[[i]]))
    }), names(beta)))
  }
  predict_ranges <- function(fit, data) {
    vals <- as.numeric(stats::predict(fit, newdata = data, type = "response"))
    if (!length(vals) || any(!is.finite(vals))) {
      stop("Model audit returned invalid predictions.", call. = FALSE)
    }
    c(min = min(vals), max = max(vals))
  }
  group_support <- function(data, weight) {
    groups <- as.character(data$.do_cmp_group)
    lapply(c("noncurrent", "current"), function(g) {
      vals <- weight[groups == g]
      list(
        unweighted_n = length(vals),
        positive_weight_sum = sum(vals),
        max_single_weight_share = if (sum(vals) > 0) max(vals) / sum(vals) else NA_real_
      )
    })
  }
  group_n <- group_support(df, as.numeric(stats::weights(domain)))
  names(group_n) <- c("noncurrent", "current")
  positive_n <- group_support(positive, as.numeric(stats::weights(pos_domain)))
  names(positive_n) <- c("noncurrent", "current")
  full_frame <- full_design$variables
  n_psus <- nrow(unique(full_frame[, c("VARSTR", "VARPSU"), drop = FALSE]))

  list(
    model_family = list(
      zero_part = "survey::svyglm, quasibinomial(logit)",
      positive_part = "survey::svyglm, Gamma(log)"
    ),
    coefficient_se_method = "survey Taylor/design-robust covariance on full-design domains",
    comparison_population = reference_sample,
    covariates = c("AGE31X", "SEX", "REGION31", "PANEL",
                   if (insurance) "INS31X"),
    full_design = list(
      weight = "PERWT24F",
      unweighted_n = nrow(full_frame),
      strata_n = length(unique(full_frame$VARSTR)),
      unique_stratum_psu_n = n_psus,
      degrees_of_freedom = survey_df(full_design, "full person design")
    ),
    domain_support = group_n,
    positive_spending_support = positive_n,
    observed_probability_by_group = {
      fitted_p <- as.numeric(stats::predict(stage_zero, newdata = df, type = "response"))
      gp <- as.character(df$.do_cmp_group)
      tmp <- lapply(c("noncurrent", "current"), function(g) {
        vals <- fitted_p[gp == g]
        list(min = min(vals), max = max(vals),
             less_than_0_01_n = sum(vals < 0.01),
             greater_than_0_99_n = sum(vals > 0.99),
             near_separation_1e_minus_8_n = sum(vals <= 1e-8 | vals >= 1 - 1e-8))
      })
      names(tmp) <- c("noncurrent", "current")
      tmp
    },
    stage_zero = list(
      converged = isTRUE(stage_zero$converged),
      coefficients = coefficient_summary(stage_zero),
      observed_probability_range = as.list(predict_ranges(stage_zero, df))
    ),
    stage_positive = list(
      converged = isTRUE(stage_positive$converged),
      coefficients = coefficient_summary(stage_positive),
      observed_conditional_mean_range = as.list(predict_ranges(stage_positive, positive))
    ),
    limitations = c(
      "Observed-data prediction ranges and group support are diagnostic only;",
      "covariate overlap, extreme PSU weights, and model misspecification require independent review."
    )
  )
}
