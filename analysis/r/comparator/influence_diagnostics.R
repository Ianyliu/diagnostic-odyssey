# Diagnostic-only influence/overlap analyses; NOT survey variance estimators or
# independent release gates. All summaries are aggregate; no PSU/person IDs emitted.

comparator_effective_n <- function(w) {
  w <- as.numeric(w)
  if (!length(w) || any(!is.finite(w)) || any(w < 0) || sum(w) <= 0) return(NA_real_)
  sum(w)^2 / sum(w^2)
}

comparator_overlap_cells <- function(df) {
  # Demographic support is measured on the exact model reference sample.
  age <- as.numeric(df$AGE31X)
  age_band <- cut(age, breaks = c(18, 30, 45, 65), right = FALSE)
  key <- interaction(age_band, df$.do_cmp_sex, df$.do_cmp_region,
                     df$.do_cmp_panel, drop = TRUE, lex.order = TRUE)
  x <- table(key, factor(as.character(df$.do_cmp_group),
                         levels = c("noncurrent", "current")))
  if (ncol(x) != 2L) stop("Unexpected overlap group count.", call. = FALSE)
  outcome_levels <- factor(df$.do_cmp_positive, levels = c(0, 1))
  support <- table(key, factor(as.character(df$.do_cmp_group),
                                levels = c("noncurrent", "current")),
                   outcome_levels)
  # Counts only; never emit identifying cross-cell labels.
  zero <- matrix(support[, , "0"], nrow = nrow(x), ncol = 2L)
  positive <- matrix(support[, , "1"], nrow = nrow(x), ncol = 2L)
  list(
    dimensions = c("AGE31X bands [18,30),[30,45),[45,65)",
                   "SEX", "REGION31", "PANEL"),
    observed_joint_cells_n = nrow(x),
    both_groups_present_n = sum(x[, 1] > 0 & x[, 2] > 0),
    one_group_only_n = sum(x[, 1] == 0 | x[, 2] == 0),
    cells_with_any_group_below_5_n = sum(pmin(x[, 1], x[, 2]) < 5),
    smallest_nonempty_cell_unweighted_n = if (any(x > 0)) min(x[x > 0]) else NA_integer_,
    cells_missing_positive_in_any_present_group_n =
      sum((x[, 1] > 0 & positive[, 1] == 0) |
          (x[, 2] > 0 & positive[, 2] == 0)),
    cells_missing_zero_in_any_present_group_n =
      sum((x[, 1] > 0 & zero[, 1] == 0) |
          (x[, 2] > 0 & zero[, 2] == 0)),
    privacy = "No individual records or cell identifiers emitted; small cell counts diagnostic-only."
  )
}

comparator_weighted_group_totals <- function(df) {
  g <- as.character(df$.do_cmp_group)
  w <- as.numeric(df$PERWT24F)
  y <- as.numeric(df$.do_cmp_y)
  lapply(c("noncurrent", "current"), function(group) {
    i <- which(g == group)
    if (!length(i)) stop("Missing comparator group for influence audit.", call. = FALSE)
    list(indices = i, weighted_n = sum(w[i]), expenditure = sum(w[i] * y[i]),
         mean = sum(w[i] * y[i]) / sum(w[i]))
  })
}

comparator_psu_influence <- function(df) {
  groups <- as.character(df$.do_cmp_group)
  w <- as.numeric(df$PERWT24F)
  y <- as.numeric(df$.do_cmp_y)
  psu <- interaction(df$VARSTR, df$VARPSU, drop = TRUE)
  totals <- comparator_weighted_group_totals(df)
  wtotal <- vapply(totals, function(x) x$weighted_n, numeric(1))
  stotal <- vapply(totals, function(x) x$expenditure, numeric(1))
  base <- stotal[[2]] / wtotal[[2]] - stotal[[1]] / wtotal[[1]]
  counts <- matrix(0, nlevels(psu), 2)
  expenses <- matrix(0, nlevels(psu), 2)
  for (g in 1:2) {
    valid <- as.integer(groups == c("noncurrent", "current")[[g]])
    counts[, g] <- as.numeric(rowsum(w * valid, psu, reorder = TRUE)[, 1])
    expenses[, g] <- as.numeric(rowsum(w * y * valid, psu, reorder = TRUE)[, 1])
  }
  remaining_w <- sweep(-counts, 2, wtotal, "+")
  remaining_s <- sweep(-expenses, 2, stotal, "+")
  valid <- remaining_w[, 1] > 0 & remaining_w[, 2] > 0
  diffs <- remaining_s[valid, 2] / remaining_w[valid, 2] -
    remaining_s[valid, 1] / remaining_w[valid, 1]
  list(
    method = "delete-one-PSU weighted mean contrast recomputation; diagnostic only, NOT a jackknife SE",
    n_psu_examined = nlevels(psu), n_psu_deletions_with_both_groups = sum(valid),
    invalid_deletions_n = sum(!valid),
    max_absolute_change_in_contrast = if (length(diffs)) max(abs(diffs - base)) else NA_real_,
    maximum_weight_fraction_in_single_psu = list(
      noncurrent = max(counts[, 1]) / wtotal[[1]],
      current = max(counts[, 2]) / wtotal[[2]]
    ),
    maximum_spending_fraction_in_single_psu = list(
      noncurrent = if (stotal[[1]] > 0) max(expenses[, 1]) / stotal[[1]] else NA_real_,
      current = if (stotal[[2]] > 0) max(expenses[, 2]) / stotal[[2]] else NA_real_
    )
  )
}

comparator_spending_tail <- function(df) {
  wt <- as.numeric(df$PERWT24F)
  yy <- as.numeric(df$.do_cmp_y)
  gp <- as.character(df$.do_cmp_group)
  groups <- lapply(c("noncurrent", "current"), function(g) {
    idx <- which(gp == g)
    order_idx <- idx[order(yy[idx], decreasing = TRUE)]
    total <- sum(wt[idx] * yy[idx])
    n_drop <- min(5L, max(1L, length(order_idx) - 1L))
    one <- order_idx[[1]]
    out <- list(
      n = length(idx), largest_outcome = max(yy[idx]),
      maximum_single_person_fraction_of_group_spending =
        if (total > 0) max(wt[idx] * yy[idx]) / total else NA_real_,
      top_five_people_fraction_of_group_spending =
        if (total > 0) sum(head(wt[order_idx] * yy[order_idx], 5L)) / total else NA_real_,
      without_largest_one_mean =
        sum(wt[-one][which(gp[-one] == g)] * yy[-one][which(gp[-one] == g)]) /
        sum(wt[-one][which(gp[-one] == g)]),
      without_highest_five_mean = {
        drop <- head(order_idx, n_drop)
        keep <- setdiff(idx, drop)
        sum(wt[keep] * yy[keep]) / sum(wt[keep])
      }
    )
    out
  })
  names(groups) <- c("noncurrent", "current")
  baseline <- comparator_weighted_group_totals(df)
  base_difference <- baseline[[2]]$mean - baseline[[1]]$mean
  list(
    method = "leave-largest-1 and largest-5 annual spending records per group OUT solely for deterministic point influence diagnostics; original model untrimmed",
    no_records_trimmed_in_primary_model = TRUE,
    baseline_unadjusted_contrast = base_difference,
    delete_top_one_point_contrast = groups$current$without_largest_one_mean -
      groups$noncurrent$without_largest_one_mean,
    delete_top_five_point_contrast = groups$current$without_highest_five_mean -
      groups$noncurrent$without_highest_five_mean,
    group = groups,
    inference = "No CI or survey variance interpretation; diagnostic-only point perturbations"
  )
}

comparator_influence_diagnostics <- function(full_design,
                                             reference_sample = c("primary", "insurance")) {
  reference_sample <- match.arg(reference_sample)
  full <- full_design$variables
  keep <- if (reference_sample == "primary") {
    full$.do_cmp_primary_complete
  } else {
    full$.do_cmp_insurance_complete
  }
  df <- full[!is.na(keep) & keep, , drop = FALSE]
  if (!nrow(df)) stop("Empty complete comparator influence diagnostic.", call. = FALSE)
  g <- as.character(df$.do_cmp_group)
  w <- as.numeric(df$PERWT24F)
  group_summary <- lapply(c("noncurrent", "current"), function(group) {
    i <- which(g == group)
    ww <- w[i]
    y <- df$.do_cmp_y[i]
    list(
      unweighted_n = length(i),
      weighted_n = sum(ww),
      kish_effective_n = comparator_effective_n(ww),
      weight_concentration_max_person_share = max(ww) / sum(ww),
      zero_unweighted_n = sum(y == 0),
      positive_unweighted_n = sum(y > 0),
      positive_kish_effective_n = comparator_effective_n(ww[y > 0])
    )
  })
  names(group_summary) <- c("noncurrent", "current")
  list(
    reference_sample = reference_sample,
    weight = "PERWT24F",
    effective_n_definition = "(sum PERWT24F)^2/sum PERWT24F^2; Kish proxy only, NOT PSU-adjusted design df",
    group = group_summary,
    joint_covariate_overlap = comparator_overlap_cells(df),
    psu_influence = comparator_psu_influence(df),
    spending_tail = comparator_spending_tail(df),
    status = "diagnostic_only_pending_independent_scientific_interpretation"
  )
}
