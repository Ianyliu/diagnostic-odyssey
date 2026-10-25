# C3 fit-only numerical stabilization — independent delta review required

Parent: `0cc47c015ba22782608751e5337375a1a569f115` (historical F approval
applies only to that commit). Target: PR #121,
`methods/meps24-long-covid-comparator-20261019`. Scientific release remains blocked.
No reviewed product artifacts are changed.

## Exact implementation delta

`comparator_stage_predictions` divides fitting weights by the mean of strictly
positive original weights. One finite positive scalar is common to both existing
unpenalized GLMs in each full-sample or replicate call. The positive-stage weights
need not have mean one. Validate finite normalized values and exact preservation
of positive/zero support; fail on underflow, overflow, nonfinite original total,
or invalid input rather than inventing weights or using a fallback.

The original quasibinomial(logit) and Gamma(log), formulas, data, default GLM
controls and starts remain. The normalized weights also reach the binary
weight-dependent initializer. Original weights remain in subgroup support and
pooled standardization. The design objects, full-design bootstrap before domain
restriction, seed, MSE centering, scale/rscales, df and covariance code are unchanged.
All previous warning, convergence, rank, support and prediction guards remain.
No penalties, trimming, failed-column exclusion or fallback estimator are added.

`comparator_fit_accuracy` adds fail-closed estimating-equation and objective
checks after each successful fit. Scores use the fitted linear predictor without
probability flooring and stage-specific normalized positive fitting weights:

- Binary: max absolute component of `X' w (y - plogis(X beta)) / sum(w)`;
  limit `1e-7`. Stable logistic cross-entropy uses softplus.
- Gamma: max absolute component of `X' w (y exp(-X beta) - 1) / sum(w)`;
  limit `1e-4`. Convex objective is mean `y exp(-eta) + eta`, ignoring
  coefficient-independent terms and the dispersion multiplier.

Each objective must be finite and no worse than its weighted intercept-only
optimum, allowing `1e-10 * (1 + abs(null objective))` rounding error. These checks
supplement the convergence flag; they do not assert monotonicity of every IRLS
iteration. Coordinate score budgets apply to the unchanged model coding (age per
10 years and categorical indicators), not arbitrary covariate rescalings. Gamma
uses a looser score budget because its default relative-deviance stopping rule
left scores near `1e-5` in C2; binary scores were near machine precision. The
budgets are fixed before new authentic execution and are numerical screens,
not scientific precision or publication criteria.

Common positive weight scaling divides either unpenalized score by a scalar
and leaves its mathematical root unchanged. The pooled original-weight ratio
and each replicate statistic therefore retain the same estimand. Covariance
continues to come solely from the unchanged joint survey replication procedure;
GLM model-based covariance is never substituted.

## Regression and execution protocol

Synthetic tests cover common scales `1e-200` through `1e200`, zero and subnormal
weights, invalid totals and lost positive support, the initialization intervention,
both estimating equations/objectives, nominally converged wrong solutions,
complete/quasi separation, both-stage rank failure, nonfinite covariates, support,
exact replicate attribution and manual/package MSE covariance with independently
scaled columns across all three specifications. Run the complete suite with
R 4.5.2 and the preserved isolated library, using `Rscript --vanilla
analysis/r/tests/run_tests.R`.

After tests, reverify both source hashes and every frozen dependency version.
Run the unchanged candidate runner (B=400, seed 20261019) locally, retaining all
outputs. An additional restricted harness evaluates every column for each of the
three prespecified specifications even if another fit fails, records every error,
and audits numerical accuracy without replacing the production statistic.
Only if all B=400 specifications pass, run B=1600 with the same seed. Preserve
all failures; do not run larger B to rescue a failed primary analysis.

Keep the original prospective stability plan: compare all marginal/contrast SEs,
joint covariance and t intervals; relative SE change >10% flags independent
review, with no automatic acceptance. B=400 and B=1600 are separate survey draws
under the same seed; do not assume the first 400 columns are nested.

Supplementary numerical audits compare default versus epsilon=1e-12,
maxit=100 diagnostic refits on each full sample. They must reduce the score,
change conditional predictions by at most `1e-3` relatively, and reduce the
stage objective by no more than `1e-8` in absolute average units. These fixed
budgets investigate default stopping accuracy and never replace the production
fit. Review support, missingness, paired sample identity, tails and covariance
algebra separately. A numerical pass does not establish model adequacy.

## Provenance and handling

C2's unapplied patch and prototype were read from the restricted ignored local
`artifacts/generated/meps31-independent-numerical-review-20261025/` bundle.
Production changes were written separately, adding validation and score/objective
checks beyond that two-call patch. The original controlled execution bundle,
approved checkout and source-integrity policy are preserved. New code, tests and
this note are reviewable Git deltas; empirical outputs, coefficient vectors,
covariances, sparse cells, detailed logs and reproduction harnesses stay only in
restricted ignored local artifact directories. No microdata or unreleased result
is admitted to Git or CI. The isolated library is reused, not a clean restore.

An independent Workstream F reviewer must assess the exact new commit and its
restricted evidence. Historical approval does not transfer. No merge, deployment,
promotion or publication approval is authorized by this workstream.
