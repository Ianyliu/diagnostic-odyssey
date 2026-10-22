# Standalone, UNRELEASED comparator methods. Never source from ordinary MEPS bootstrap.
# Caller must first source analysis/r/meps/bootstrap.R. Do not change the 21 existing estimators.

comparator_required_columns <- function() c(
  "AGE31X", "SEX", "REGION31", "PANEL", "INS31X", "INSCOV24",
  "TOTEXP24", "PERWT24F", "VARSTR", "VARPSU", "do_current_long_covid",
  "do_lc_history_positive", "do_age_18_64"
)

comparator_validate_code <- function(x, valid, field) {
  raw <- suppressWarnings(as.numeric(x))
  if (any(is.na(raw) & !is.na(x))) {
    stop("Non-numeric comparator field: ", field, call. = FALSE)
  }
  unexpected <- setdiff(unique(raw[!is.na(raw)]), valid)
  if (length(unexpected)) {
    stop("Unexpected HC-256 codes for ", field, ": ",
         paste(sort(unexpected), collapse = ", "), call. = FALSE)
  }
  invisible(TRUE)
}

comparator_validate_source <- function(data) {
  missing <- setdiff(comparator_required_columns(), names(data))
  if (length(missing)) stop("Comparator source missing: ", paste(missing, collapse = ", "), call. = FALSE)
  comparator_validate_code(data$SEX, c(1, 2), "SEX")
  comparator_validate_code(data$REGION31, c(-1, 1, 2, 3, 4), "REGION31")
  comparator_validate_code(data$PANEL, c(28, 29), "PANEL")
  comparator_validate_code(data$INS31X, c(-1, 1, 2), "INS31X")
  comparator_validate_code(data$INSCOV24, c(1, 2, 3), "INSCOV24")
  if (any(!is.na(data$AGE31X) & !(as.numeric(data$AGE31X) %in% c(-1, 0:85)))) {
    stop("Unexpected AGE31X code.", call. = FALSE)
  }
  if (any(!is.na(data$TOTEXP24) & !is.finite(as.numeric(data$TOTEXP24)))) {
    stop("Invalid nonfinite TOTEXP24.", call. = FALSE)
  }
  invisible(TRUE)
}

comparator_prepare <- function(data) {
  comparator_validate_source(data)
  current <- data$do_current_long_covid
  if (!is.logical(current)) stop("Cohort must first be constructed with the reviewed routing.", call. = FALSE)
  eligible <- data$do_age_18_64 & !is.na(data$PERWT24F) &
    as.numeric(data$PERWT24F) > 0
  group <- ifelse(eligible & !is.na(current),
                  ifelse(current, "current", "noncurrent"), NA_character_)
  restricted <- ifelse(group == "current", "current",
                       ifelse(group == "noncurrent" &
                                data$do_lc_history_positive %in% FALSE,
                              "noncurrent", NA_character_))
  data$.do_cmp_group <- factor(group, levels = c("noncurrent", "current"))
  data$.do_cmp_restricted <- factor(restricted, levels = c("noncurrent", "current"))
  data$.do_cmp_y <- meps_nonnegative(data$TOTEXP24)
  data$.do_cmp_positive <- ifelse(is.na(data$.do_cmp_y), NA_integer_,
                                 as.integer(data$.do_cmp_y > 0))
  age <- as.numeric(data$AGE31X)
  data$.do_cmp_age10 <- ifelse(age >= 18 & age <= 64, (age - 40) / 10, NA_real_)
  data$.do_cmp_sex <- factor(as.numeric(data$SEX), levels = 1:2,
                            labels = c("male", "female"))
  data$.do_cmp_region <- factor(as.numeric(data$REGION31), levels = 1:4,
                               labels = c("northeast", "midwest", "south", "west"))
  data$.do_cmp_panel <- factor(as.numeric(data$PANEL), levels = c(28, 29))
  data$.do_cmp_insurance <- factor(as.numeric(data$INS31X), levels = 1:2,
                                  labels = c("insured", "uninsured"))
  data$.do_cmp_primary_complete <- !is.na(data$.do_cmp_group) &
    !is.na(data$.do_cmp_y) & !is.na(data$.do_cmp_age10) &
    !is.na(data$.do_cmp_sex) & !is.na(data$.do_cmp_region) &
    !is.na(data$.do_cmp_panel)
  data$.do_cmp_insurance_complete <- data$.do_cmp_primary_complete &
    !is.na(data$.do_cmp_insurance)
  data
}

comparator_domain_diagnostics <- function(data, design) {
  scope <- data$do_age_18_64 & !is.na(data$PERWT24F) &
    as.numeric(data$PERWT24F) > 0
  group <- as.character(data$.do_cmp_group)
  group_n <- function(g, flag = rep(TRUE, nrow(data))) {
    sum(scope & !is.na(group) & group == g & flag, na.rm = TRUE)
  }
  group_weight <- function(g, flag = rep(TRUE, nrow(data))) {
    keep <- scope & !is.na(group) & group == g & flag
    sum(as.numeric(data$PERWT24F[keep]), na.rm = TRUE)
  }
  grouped_codes <- function(variable) {
    frame <- data.frame(
      group = ifelse(!scope, "out_of_scope",
                     ifelse(is.na(group), "unresolved", group)),
      code = ifelse(is.na(data[[variable]]), "NA", as.character(as.numeric(data[[variable]])))
    )
    frame <- frame[scope, , drop = FALSE]
    stats::setNames(
      lapply(split(frame$code, frame$group), function(x) as.list(table(x))),
      names(split(frame$code, frame$group))
    )
  }
  sample_loss <- function(g) {
    eligible <- scope & !is.na(group) & group == g
    weighted <- function(mask) sum(as.numeric(data$PERWT24F[eligible & mask]), na.rm = TRUE)
    n <- function(mask) sum(eligible & mask, na.rm = TRUE)
    spend <- !is.na(data$.do_cmp_y)
    primary <- data$.do_cmp_primary_complete
    insurance <- data$.do_cmp_insurance_complete
    list(
      classifiable_n = n(rep(TRUE, nrow(data))),
      classifiable_weight = weighted(rep(TRUE, nrow(data))),
      spending_valid_n = n(spend), spending_valid_weight = weighted(spend),
      spending_invalid_n = n(!spend), spending_invalid_weight = weighted(!spend),
      primary_complete_n = n(primary), primary_complete_weight = weighted(primary),
      primary_excluded_from_classifiable_n = n(!primary),
      primary_excluded_from_classifiable_weight = weighted(!primary),
      insurance_complete_n = n(insurance), insurance_complete_weight = weighted(insurance),
      insurance_excluded_from_primary_n = n(primary & !insurance),
      insurance_excluded_from_primary_weight = weighted(primary & !insurance),
      primary_complete_positive_n = n(primary & data$.do_cmp_y > 0),
      primary_complete_zero_n = n(primary & data$.do_cmp_y == 0)
    )
  }
  list(
    complete_case_flow_by_group = list(noncurrent = sample_loss("noncurrent"),
                                        current = sample_loss("current")),
    target_age_positive_weight_n = sum(scope, na.rm = TRUE),
    classifiable_n = sum(scope & !is.na(group), na.rm = TRUE),
    unresolved_n = sum(scope & is.na(group), na.rm = TRUE),
    current_n = group_n("current"),
    noncurrent_n = group_n("noncurrent"),
    known_prior_history_noncurrent_n = group_n("noncurrent", data$do_lc_history_positive %in% TRUE),
    known_no_history_noncurrent_n = group_n("noncurrent", data$do_lc_history_positive %in% FALSE),
    valid_spending_n = list(current = group_n("current", !is.na(data$.do_cmp_y)),
                            noncurrent = group_n("noncurrent", !is.na(data$.do_cmp_y))),
    positive_spending_n = list(current = group_n("current", data$.do_cmp_y > 0),
                               noncurrent = group_n("noncurrent", data$.do_cmp_y > 0)),
    zero_spending_n = list(current = group_n("current", data$.do_cmp_y == 0),
                           noncurrent = group_n("noncurrent", data$.do_cmp_y == 0)),
    primary_complete_n = list(current = group_n("current", data$.do_cmp_primary_complete),
                               noncurrent = group_n("noncurrent", data$.do_cmp_primary_complete)),
    interview_insurance_complete_n = list(
      current = group_n("current", data$.do_cmp_insurance_complete),
      noncurrent = group_n("noncurrent", data$.do_cmp_insurance_complete)
    ),
    classifiable_weight_total = sum(as.numeric(data$PERWT24F[scope & !is.na(group)])),
    weight_by_group = list(current = group_weight("current"),
                           noncurrent = group_weight("noncurrent")),
    positive_spending_weight_by_group = list(
      current = group_weight("current", data$.do_cmp_y > 0),
      noncurrent = group_weight("noncurrent", data$.do_cmp_y > 0)
    ),
    weight_variable = "PERWT24F",
    full_person_design_df = survey_df(design, "full PERSON / PERWT24F"),
    raw_codes_by_status = list(
      sex = grouped_codes("SEX"), region31 = grouped_codes("REGION31"),
      panel = grouped_codes("PANEL"), insurance31 = grouped_codes("INS31X"),
      insurance2024 = grouped_codes("INSCOV24")
    )
  )
}

comparator_validate_covariance <- function(values, covariance, tolerance = 1e-8) {
  if (!is.numeric(values) || !is.matrix(covariance) ||
      length(values) != nrow(covariance) ||
      nrow(covariance) != ncol(covariance) ||
      any(!is.finite(values)) || any(!is.finite(covariance))) {
    stop("Nonfinite or malformed comparator covariance.", call. = FALSE)
  }
  # Never let pmax(0, negative variances) conceal a failed estimator.
  scale <- max(1, max(abs(covariance)))
  if (max(abs(covariance - t(covariance))) > tolerance * scale) {
    stop("Comparator covariance is not symmetric.", call. = FALSE)
  }
  v <- (covariance + t(covariance)) / 2
  if (any(diag(v) < 0)) {
    stop("Comparator covariance has a negative marginal variance.", call. = FALSE)
  }
  eigenvalues <- eigen(v, symmetric = TRUE, only.values = TRUE)$values
  if (min(eigenvalues) < -tolerance * scale) {
    stop("Comparator covariance is not positive semidefinite.", call. = FALSE)
  }
  v
}

# The third standardized statistic MUST be current - noncurrent in every
# replicate. A standalone PSD covariance is insufficient if this identity breaks.
comparator_validate_contrast_covariance <- function(values, covariance,
                                                    tolerance = 1e-7) {
  v <- comparator_validate_covariance(values, covariance)
  if (length(values) != 3L) {
    stop("Expected two standardized means and their difference.", call. = FALSE)
  }
  cvec <- c(-1, 1)
  expected_variance <- as.numeric(t(cvec) %*% v[1:2, 1:2] %*% cvec)
  expected_cov <- as.vector(v[1:2, 1:2] %*% cvec)
  scale <- max(1, max(abs(v)))
  if (abs(values[[3]] - (values[[2]] - values[[1]])) >
        tolerance * max(1, max(abs(values))) ||
      abs(v[3, 3] - expected_variance) > tolerance * scale ||
      max(abs(v[1:2, 3] - expected_cov)) > tolerance * scale) {
    stop("Adjusted contrast covariance does not reconcile to joint subgroup means.",
         call. = FALSE)
  }
  v
}

comparator_t_ci <- function(values, covariance, df, level = 0.95) {
  covariance <- comparator_validate_covariance(values, covariance)
  if (length(df) != 1L || !is.finite(df) || df <= 0 ||
      length(level) != 1L || !is.finite(level) || level <= 0 || level >= 1) {
    stop("Invalid comparator interval degrees of freedom or level.", call. = FALSE)
  }
  ses <- sqrt(diag(covariance))
  crit <- stats::qt(1 - (1 - level) / 2, df = df)
  lapply(seq_along(values), function(i) {
    list(estimate = unname(values[[i]]), standard_error = unname(ses[[i]]),
         interval_low = unname(values[[i]] - crit * ses[[i]]),
         interval_high = unname(values[[i]] + crit * ses[[i]]))
  })
}

comparator_unadjusted <- function(full_design, group_variable = ".do_cmp_group",
                                  complete_case_only = FALSE) {
  assert_survey_available()
  valid <- !is.na(full_design$variables[[group_variable]]) &
    !is.na(full_design$variables$.do_cmp_y)
  if (complete_case_only) valid <- valid & full_design$variables$.do_cmp_primary_complete
  full_design$variables$.do_cmp_unadj_valid <- valid
  domain <- subset(full_design, .do_cmp_unadj_valid)
  group_formula <- stats::as.formula(paste0("~", group_variable))
  stat <- survey::svyby(~.do_cmp_y, group_formula, domain, survey::svymean,
                        na.rm = TRUE, covmat = TRUE, keep.var = TRUE)
  labels <- as.character(stat[[group_variable]])
  if (!identical(labels, c("noncurrent", "current"))) {
    stop("Both ordered comparator groups are required.", call. = FALSE)
  }
  means <- as.numeric(stats::coef(stat))
  v <- as.matrix(stats::vcov(stat))
  if (length(means) != 2L || !identical(dim(v), c(2L, 2L))) {
    stop("Joint two-group covariance unavailable; cannot assume independence.", call. = FALSE)
  }
  cvec <- c(-1, 1)
  difference <- sum(cvec * means)
  variance <- unname(t(cvec) %*% v %*% cvec)
  if (!is.finite(variance) || variance < -1e-8) {
    stop("Invalid design-aware variance for unadjusted contrast.", call. = FALSE)
  }
  full_df <- survey_df(full_design, "full PERSON / PERWT24F")
  all_values <- c(means, difference)
  all_v <- matrix(0, 3, 3)
  all_v[1:2, 1:2] <- v
  all_v[3, 3] <- max(variance, 0)
  all_v[1:2, 3] <- as.vector(v %*% cvec)
  all_v[3, 1:2] <- all_v[1:2, 3]
  intervals <- comparator_t_ci(all_values, all_v, full_df)
  names(intervals) <- c("noncurrent_mean", "current_mean", "current_minus_noncurrent")
  n <- table(factor(as.character(domain$variables[[group_variable]]),
                    levels = c("noncurrent", "current")))
  wt <- as.numeric(stats::weights(domain))
  groups <- as.character(domain$variables[[group_variable]])
  list(
    method = "joint survey::svyby(..., covmat=TRUE) Taylor linearization",
    weight = "PERWT24F", ci_df = full_df, ci_df_source = "full PERSON design",
    group = group_variable, complete_case_only = complete_case_only,
    unweighted_valid_n = as.list(n),
    weighted_denominator = list(
      noncurrent = sum(wt[groups == "noncurrent"]),
      current = sum(wt[groups == "current"])
    ),
    covariance_noncurrent_current = unname(v[1, 2]),
    results = intervals
  )
}

comparator_stage_predictions <- function(w, data, group_variable, insurance = FALSE) {
  support_trace <- character()
  stage_error <- function(stage, reason, group = "all") {
    stop(sprintf("stage=%s group=%s: %s; support={%s}", stage, group,
                 reason, paste(support_trace, collapse = " | ")), call. = FALSE)
  }
  df <- data
  df$.do_cmp_w <- as.numeric(w)
  if (length(df$.do_cmp_w) != nrow(df) || any(!is.finite(df$.do_cmp_w)) ||
      any(df$.do_cmp_w < 0) || sum(df$.do_cmp_w) <= 0) {
    stage_error("weights", "invalid/nonfinite/negative survey replicate weights")
  }
  df$.do_cmp_exposure <- factor(as.character(df[[group_variable]]),
                                levels = c("noncurrent", "current"))
  included <- df$.do_cmp_w > 0
  for (g in c("noncurrent", "current")) {
    eligible <- included & !is.na(df$.do_cmp_exposure) & df$.do_cmp_exposure == g
    n_pos <- sum(eligible & df$.do_cmp_positive == 1L, na.rm = TRUE)
    n_zero <- sum(eligible & df$.do_cmp_positive == 0L, na.rm = TRUE)
    support_trace <- c(support_trace, sprintf("%s:n=%d/positive=%d/zero=%d",
                                             g, sum(eligible), n_pos, n_zero))
    if (sum(eligible) < 2L || n_pos < 1L || n_zero < 1L) {
      stage_error("support",
                  sprintf("insufficient sample: total=%d positive=%d zero=%d",
                          sum(eligible), n_pos, n_zero), g)
    }
  }
  adjust <- ".do_cmp_exposure + .do_cmp_age10 + .do_cmp_sex + .do_cmp_region + .do_cmp_panel"
  if (insurance) adjust <- paste(adjust, "+ .do_cmp_insurance")
  binary_formula <- stats::as.formula(paste(".do_cmp_positive ~", adjust))
  positive_formula <- stats::as.formula(paste(".do_cmp_y ~", adjust))
  fit_stage <- function(stage, expression) {
    warning_messages <- character()
    fit <- tryCatch(
      withCallingHandlers(
        expression,
        warning = function(warning) {
          warning_messages <<- c(warning_messages, conditionMessage(warning))
          invokeRestart("muffleWarning")
        }
      ),
      error = function(e) stage_error(stage, conditionMessage(e))
    )
    if (length(warning_messages)) {
      stage_error(stage, paste("fit warnings:", paste(unique(warning_messages),
                                                    collapse = " | ")))
    }
    coefficients <- stats::coef(fit)
    if (!isTRUE(fit$converged) || fit$rank < length(coefficients) ||
        any(!is.finite(coefficients))) {
      stage_error(stage, "nonconverged, nonfinite or rank-deficient model")
    }
    fit
  }
  part1 <- fit_stage("binary_logit", stats::glm(
    binary_formula, family = stats::quasibinomial(link = "logit"),
    weights = .do_cmp_w, data = df, na.action = stats::na.fail
  ))
  pos <- df[df$.do_cmp_positive == 1L & included, , drop = FALSE]
  part2 <- fit_stage("positive_gamma", stats::glm(
    positive_formula, family = stats::Gamma(link = "log"),
    weights = .do_cmp_w, data = pos, na.action = stats::na.fail
  ))
  standardized <- vapply(c("noncurrent", "current"), function(g) {
    scenario <- df
    scenario$.do_cmp_exposure <- factor(rep(g, nrow(df)),
                                       levels = c("noncurrent", "current"))
    p <- tryCatch(stats::predict(part1, newdata = scenario, type = "response"),
                  error = function(e) stage_error("binary_prediction", conditionMessage(e), g))
    m <- tryCatch(stats::predict(part2, newdata = scenario, type = "response"),
                  error = function(e) stage_error("positive_prediction", conditionMessage(e), g))
    if (any(!is.finite(p)) || any(p <= 1e-8 | p >= 1 - 1e-8)) {
      stage_error("binary_prediction", "nonfinite or near-separated probability", g)
    }
    if (any(!is.finite(m)) || any(m <= 0)) {
      stage_error("positive_prediction", "nonfinite or nonpositive conditional spending", g)
    }
    out <- stats::weighted.mean(p * m, df$.do_cmp_w)
    if (!is.finite(out) || out <= 0) stage_error("standardization", "nonfinite mean", g)
    out
  }, numeric(1))
  c(noncurrent = standardized[["noncurrent"]],
    current = standardized[["current"]],
    difference = standardized[["current"]] - standardized[["noncurrent"]])
}

comparator_trace_replicate_failures <- function(replicate_weights, data, theta) {
  if (!is.matrix(replicate_weights) || !is.numeric(replicate_weights) ||
      nrow(replicate_weights) != nrow(data) || ncol(replicate_weights) < 1L) {
    stop("Invalid bootstrap replicate matrix for failure tracing.", call. = FALSE)
  }
  for (i in seq_len(ncol(replicate_weights))) {
    failure <- tryCatch({
      theta(replicate_weights[, i], data)
      NULL
    }, error = identity)
    if (inherits(failure, "error")) {
      stop(sprintf("Bootstrap replicate=%d/%d: %s", i, ncol(replicate_weights),
                   conditionMessage(failure)), call. = FALSE)
    }
  }
  invisible(ncol(replicate_weights))
}

comparator_adjusted <- function(full_design, replicates = 400L,
                                seed = 20261019L, insurance = FALSE,
                                reference_sample = c("primary", "insurance")) {
  assert_survey_available()
  reference_sample <- match.arg(reference_sample)
  if (insurance && reference_sample != "insurance") {
    stop("Insurance model must use the insurance-complete reference sample.", call. = FALSE)
  }
  replicates <- as.integer(replicates)
  if (length(replicates) != 1L || is.na(replicates) || replicates < 16L) {
    stop("Need at least 16 design-bootstrap replicates.", call. = FALSE)
  }
  domain_var <- if (reference_sample == "insurance") {
    ".do_cmp_insurance_complete"
  } else {
    ".do_cmp_primary_complete"
  }
  set.seed(seed)
  # Resampling starts from the FULL PERSON design, before subpopulation restriction.
  rep_design <- survey::as.svrepdesign(full_design, type = "bootstrap",
                                      replicates = replicates, mse = TRUE)
  domain <- subset(rep_design, get(domain_var))
  if (!nrow(domain$variables)) stop("Empty comparator bootstrap domain.", call. = FALSE)
  theta <- function(weights, data) {
    comparator_stage_predictions(weights, data, ".do_cmp_group",
                                 insurance = insurance)
  }
  # Fail-closed: if withReplicates errors, independently identify the failing
  # full-sample or exact replicate column using the original generated design.
  stat <- tryCatch(
    survey::withReplicates(domain, theta, return.replicates = TRUE),
    error = function(original_error) {
      w0 <- tryCatch(as.numeric(stats::weights(domain, type = "sampling")),
                     error = function(e) NULL)
      if (!is.null(w0)) {
        baseline <- tryCatch(theta(w0, domain$variables), error = identity)
        if (inherits(baseline, "error")) {
          stop("Bootstrap full_sample: ", conditionMessage(baseline), call. = FALSE)
        }
      }
      replicate_weights <- tryCatch(as.matrix(stats::weights(domain, type = "analysis")),
                                    error = function(e) NULL)
      if (is.null(replicate_weights) ||
          nrow(replicate_weights) != nrow(domain$variables) ||
          ncol(replicate_weights) != replicates) {
        stop("Bootstrap failed; cannot audit replicate weight matrix: ",
             conditionMessage(original_error), call. = FALSE)
      }
      comparator_trace_replicate_failures(replicate_weights, domain$variables, theta)
      stop("Bootstrap covariance/evaluation failed after all individual replicates passed: ",
           conditionMessage(original_error), call. = FALSE)
    }
  )
  values <- as.numeric(stats::coef(stat))
  v <- as.matrix(stats::vcov(stat))
  if (length(values) != 3L || !identical(dim(v), c(3L, 3L))) {
    stop("Adjusted joint replicate covariance missing.", call. = FALSE)
  }
  v <- comparator_validate_contrast_covariance(values, v)
  full_df <- survey_df(full_design, "full PERSON / PERWT24F")
  intervals <- comparator_t_ci(values, v, full_df)
  names(intervals) <- c("noncurrent_mean", "current_mean", "current_minus_noncurrent")
  ids <- as.character(domain$variables$.do_cmp_group)
  ww <- as.numeric(stats::weights(domain, type = "sampling"))
  list(
    method = "weighted quasi-binomial logit + positive Gamma(log); pooled marginal standardization",
    uncertainty = "full-PERWT24F-design bootstrap; refit both models and standardization per replicate",
    insurance_sensitivity = isTRUE(insurance), reference_sample = reference_sample,
    weight = "PERWT24F",
    covariates = c("AGE31X", "SEX", "REGION31", "PANEL",
                   if (insurance) "INS31X"),
    replicates_requested = replicates, replicates_successful = replicates,
    replicate_failures = list(), bootstrap_failure_count = 0L,
    failure_policy = "any failed full_sample/replicate aborts; failing index, stage and group in error",
    seed = seed, ci_df = full_df, ci_df_source = "full PERSON design",
    unweighted_complete_n = nrow(domain$variables),
    unweighted_complete_by_group = as.list(table(factor(ids, levels = c("noncurrent", "current")))),
    weighted_complete_by_group = list(noncurrent = sum(ww[ids == "noncurrent"]),
                                      current = sum(ww[ids == "current"])),
    covariance = unname(v),
    results = intervals
  )
}

comparator_precision_screen <- function(unadjusted, adjusted, diagnostics,
                                        min_valid_n = 100L,
                                        min_positive_n = 30L,
                                        max_mean_rse = 0.30) {
  groups <- c("current", "noncurrent")
  valid_stat <- function(stat, mean = FALSE) {
    if (!is.list(stat)) return(FALSE)
    z <- unlist(stat[c("estimate", "standard_error", "interval_low", "interval_high")],
                use.names = FALSE)
    if (length(z) != 4L || any(!is.finite(z)) ||
        z[[2]] <= 0 || z[[3]] > z[[1]] || z[[4]] < z[[1]] ||
        z[[4]] <= z[[3]]) return(FALSE)
    if (mean) return(z[[1]] > 0 && z[[2]] / z[[1]] <= max_mean_rse)
    TRUE
  }
  cov_ok <- tryCatch({
    comparator_validate_contrast_covariance(
      vapply(c("noncurrent_mean", "current_mean", "current_minus_noncurrent"),
             function(x) adjusted$results[[x]]$estimate, numeric(1)),
      as.matrix(adjusted$covariance)
    )
    TRUE
  }, error = function(e) FALSE)
  checks <- list(
    unadjusted_sample = all(unlist(diagnostics$valid_spending_n[groups]) >= min_valid_n),
    positive_support = all(unlist(diagnostics$positive_spending_n[groups]) >= min_positive_n),
    adjusted_complete_sample = all(vapply(groups, function(g)
      diagnostics$complete_case_flow_by_group[[g]]$primary_complete_n >= min_valid_n,
      logical(1))),
    adjusted_positive_support = all(vapply(groups, function(g)
      diagnostics$complete_case_flow_by_group[[g]]$primary_complete_positive_n >= min_positive_n,
      logical(1))),
    weighted_denominators_positive = all(unlist(diagnostics$weight_by_group[groups]) > 0),
    adjusted_replicates_complete = identical(adjusted$replicates_requested,
                                             adjusted$replicates_successful),
    adjusted_covariance_finite_symmetric_psd = cov_ok,
    unadjusted_contrast_precision = valid_stat(
      unadjusted$results$current_minus_noncurrent),
    adjusted_contrast_precision = valid_stat(adjusted$results$current_minus_noncurrent)
  )
  for (group in groups) {
    checks[[paste0(group, "_unadjusted_mean_rse_ok")]] <-
      valid_stat(unadjusted$results[[paste0(group, "_mean")]], mean = TRUE)
    checks[[paste0(group, "_adjusted_mean_rse_ok")]] <-
      valid_stat(adjusted$results[[paste0(group, "_mean")]], mean = TRUE)
  }
  list(
    screening_checks = checks,
    numerical_advisory_passed = isTRUE(all(unlist(checks))),
    scientific_review_required = TRUE,
    independent_methods_approval = "pending",
    publication_approved = FALSE,
    policy = paste(
      "Finite, nonnegative joint covariance, contrast SE and interval required;",
      "mean RSE threshold is advisory. Near-zero contrast does not receive an",
      "RSE screening threshold. Passing numerical checks is NEVER publication approval."
    )
  )
}
