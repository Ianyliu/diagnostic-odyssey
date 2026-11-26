# MEPS HC-256 (2024) survey-weighted Long COVID comparator — prespecified **candidate** methods

**Status:** scientific-review candidate; NOT a modification or extension of the 21 released ordinary estimates. Issue #31, adjusted-comparator portion only. Payer decomposition remains separate and unimplemented.

**Pinned parent `main`:** `dac9b64526e4df1a93357d1a3776774cae4b1512` (2026-10-19). New code is exclusively under `analysis/r/comparator/` and `docs/methods/`.

## 1. Data provenance and already-reviewed boundaries

- HC-256 August 2026 release, 2024 Full Year Consolidated PUF. Load from `data/raw/meps/2024/h256.dta` or the verified source ZIP, through the existing HC-256 loader. Do not commit respondent-level data.
- Use the **unchanged** route-aware `construct_long_covid_cohort()`: `AGE31X` 18–64, positive `PERWT24F`, common 2024 Round 3/1 anchor, `COVIDEVER31`/`LCEVER31`/`COVSYMNOW31`. Panel 28 Round 3 and Panel 29 Round 1 both occur in 2024. `53` fields are diagnostic-only; Panel 29 Round 3 may fall in 2025.
- Current group: `do_current_long_covid == TRUE`. **Primary comparator:** `do_current_long_covid == FALSE` among adults with *known, classifiable* Round-31 status, including never-COVID, never-Long-COVID, and previously-Long-COVID but not currently symptomatic. Unresolved history/current symptoms, routing conflicts, nonpositive person weights and out-of-age adults are **excluded from the analytic domain**, not presumed controls. This population is NOT "never had Long COVID."
- Separately report comparator composition and a **restricted sensitivity** comparing current cases to adults with known NO Long-COVID history (`do_lc_history_positive == FALSE`); this sensitivity does not overwrite the primary result. Previously affected but non-current adults must be counted explicitly rather than silently omitted.
- Primary outcome: `TOTEXP24` annual **all-cause** expenditure, measured during calendar 2024, which may precede or follow the status interview. Nonnegative values including **zero** are real; negative reserved codes are missing, not zero.
- Primary design: full `PERWT24F` person-weighted `svydesign(ids=~VARPSU, strata=~VARSTR, nest=TRUE)`, constructed BEFORE subpopulation restriction, then domain estimation. `survey.lonely.psu='adjust'` and `survey.adjust.domain.lonely=FALSE`; Taylor linearization under MEPS with-replacement design. Do not analyze person outcomes with `ESAQWT24F`, `SAQWT24F`, or `PESAQWT24F`.
- Published/baseline reviewed artifact `artifacts/reviewed/meps-2024-long-covid-candidate-20260926T011343Z/`: 21 estimates, explicitly approved; prior diagnostics 18,683 full PERSON design records, 105 strata, 264 VARSTR/VARPSU, 159 full-design df, 10,234 positive-weight age-eligible people, 10,070 classifiable, 164 unresolved, 380 current cases, 6,831,165 weighted current cases. These are **historical review benchmarks only**, not newly computed comparator results or fixed assertions for a new source release.
- Review-only variance analysis `analysis/r/review/meps_variance_policy_review.R` established zero *full-design* singleton strata. Domain singleton PSUs are not true full-design singletons. Reuse, rather than silently changing, this variance policy.
- ESAQ outcomes: `ESAQELIG=1`, `ESAQWT24F`; PSAQ: `SAQELIG=1`, `SAQWT24F`; joint instruments only with justified joint weight. These supplements are **not** in the current primary comparator and may not be merged into its denominator. Future companion comparisons require separate universes, missingness and full-design df.

## 2. Primary unadjusted estimand and variance

For observed status group `g ∈ {0,1}`, outcome `Y=TOTEXP24`, person weights `w`, in the classifiable, valid-outcome domain:

```text
μ_g = Σ_i w_i I(G_i=g) Y_i / Σ_i w_i I(G_i=g)
Δ_unadjusted = μ_1 - μ_0
Var(Δ) = Var(μ_1) + Var(μ_0) - 2 Cov(μ_1, μ_0)
```

Compute both subgroup means in **one joint `survey::svyby(..., covmat=TRUE)`** call on the unchanged full survey design restricted by `subset()`. Use the entire 2×2 covariance matrix and the contrast vector `(-1,+1)`. Do **not** combine independent subgroup confidence intervals or ignore covariance. Calculate a two-sided 95% t CI with `survey::degf(full_person_design)`, not domain-specific df or an assumed 159. This unadjusted contrast is descriptive, observational, and is not a cost attributable to Long COVID.

## 3. Prespecified adjusted observational analysis

- **Primary covariates:** `AGE31X` (linear, centered at 40 and scaled by 10 years), `SEX` (1 male / 2 female as defined on the HC-256 PUF), `REGION31` (1 Northeast, 2 Midwest, 3 South, 4 West) and `PANEL` (28 / 29). These are treated as descriptive case-mix variables; timing and modeling assumptions still limit interpretation.
- **Insurance sensitivity only:** `INS31X` (edited insured at R3/1 interview: 1 yes / 2 no); and separately inspect `INSCOV24` (annual 2024 classification 1 any private, 2 public-only, 3 uninsured). **Do not use annual INSCOV24 in the primary model**, as it uses contemporaneous/full-year information that may be downstream of health and spending. The insurance sensitivity remains associational and is not a corrected causal model.
- Validate allowable categorical codes *before* any factor recode: `SEX∈{1,2}`, `PANEL∈{28,29}`, `REGION31∈{1,2,3,4}` (with -1 inapplicable), `INS31X∈{-1,1,2}`, `INSCOV24∈{1,2,3}`; negative/reserved are missing, not an extra substantive factor. Fail on undocumented positive codes. Also validate `AGE31X` and `TOTEXP24`. Record missing/invalid by status, exposure group and positive-spending counts.
- **Two-part primary model:** survey-weighted quasi-binomial logit of `P(Y>0|G,X)`, and survey-weighted Gamma with log link of `E(Y|Y>0,G,X)` among positive expenditures. Factor encodings, covariate set and outcome cleaning must be fixed before reading results.
- Standardize each hypothetical exposure setting to the **same pooled, classifiable, outcome/covariate-complete analytic reference distribution** (observed weights). The standardized predicted annual mean for assignment `g` is
```text
μ_g^std = Σ_i w_i [p̂(Y_i>0 | G=g,X_i) × m̂(Y_i | Y_i>0,G=g,X_i)] / Σ_i w_i
Δ_adjusted = μ_1^std - μ_0^std
```
The `g=0`/ `g=1` assignments are *model prediction devices*, NOT interventions or causal counterfactuals.
- Uncertainty: reproducible **survey design bootstrap replicates created from the full PERSON design**; refit **both** stages and repeat standardization *within every replicate*. Compute a joint covariance matrix from the replicate contrasts so coefficients, model refitting and reference-distribution estimation are all propagated. Prespecify 400 bootstrap replicates and seed 20261019. Full-person-design df governs t intervals. A replicate fit failure, nonfinite estimates, degenerate group or missing required covariance is a candidate **review blocker**, not a silently dropped replicate.
- Survey bootstrap is a design-aware approximation; it does not make a model correctly specified. Compare direction, precision, and sample composition against the unadjusted estimate; inspect separation/extreme predictions, high-weight influence, overlap and sparse cells.

## 4. Diagnostics and sensitivities

The candidate report must include raw eligible, classifiable, current/noncurrent, prior-only and unresolved counts (unweighted + survey-weighted where appropriate); per-outcome complete cases and zero/positive counts **by group**; analysis denominator weight sums; primary covariate levels/missingness; design df/PSU/stratum counts; stage convergence, prediction bounds and coefficients; replicates requested/successful; explicit loss from restriction; groupwise region/sex/insurance counts and missingness. Independently cross-check `SEX`, `REGION31`, `INS31X`, `INSCOV24`, `PANEL`, `AGE31X` against HC-256 codebook/record counts.

Run: (a) restricted no-history comparator, (b) interview-time insurance in an explicitly secondary adjusted sensitivity, (c) available-case versus covariate-complete unadjusted contrast, (d) influence/sparse-cell and observed weighted support checks. Additional spending family and supplement comparisons are **not silently included**.

## 5. Precision and publication governance

- No automatic promotion; schema remains **separate** from `bundle.json` and the 21 ordinary released estimates.
- Prespecified screening thresholds for public display recommendation, **not** proof of validity: unweighted valid total **≥100 per group** and positive-spending **≥30 per group**; both represented weighted denominators finite and positive; contrast SE finite/nonnegative; model stages converged; all 400 replicate fits successful; no singular design/model matrix; and absolute RSE for nonzero subgroup means **≤0.30**. Escalate small strata, concentrated weights, bootstrap instability, CI that crosses implausible ranges, and model extrapolation to methods review. Apply the project's established AHRQ reliability and suppression policy before any eventual public release. A negative difference CI bound is possible for a **contrast** and should not be mechanically truncated to zero.
- Missing statuses/values are never invented or reclassified to enlarge cells. Synthetic fixtures do not count as MEPS evidence.
- A candidate can be marked `preliminary`, `automatic_release=false`, `independent_methods_review=pending`; only an explicit human scientific sign-off can authorize a separate promotion PR. This workstream never does so.

## 6. Interpretation / proposed future UI contract

**Candidate label:** “Difference in annual all-cause health care spending between adults with operational current Long COVID and status-classifiable adults not currently reporting it (MEPS 2024).” Unadjusted and adjusted model-based standardized differences must appear **distinct**, with 95% uncertainty intervals and group sizes. Comparator includes never-exposed and past-history non-current adults. Report the point-in-time/annual-timing mismatch.

Permissible: **“observational spending association”**, **“all-cause annual spending contrast”**, **“model-standardized comparison.”**

Prohibited: “attributable cost,” “additional cost caused by Long COVID,” “avoidable/preventable spending,” “diagnostic delay savings,” “ROI,” “Medicaid claims burden,” “state-specific spending” and “effects of treating/resolving Long COVID.” No app visibility prior to independent review.

## 7. Data blocker and execution contract

Run only where authorized raw `h256.dta` or the verified source ZIP exists; enforce the existing `analysis/r/config/meps_hc256_source_integrity.json` SHA-256 policy. **Do not download, invent or reconstruct respondent-level records here.** The runner explicitly refuses missing raw data and writes only to `artifacts/generated/meps24-comparator-candidate/` on successful validation. It MUST NOT write `artifacts/reviewed/`, the web bundle or ordinary estimate IDs.

Source: https://meps.ahrq.gov/data_stats/download_data/pufs/h256/h256doc.shtml ; codebook links in `analysis/r/comparator/comparator_config.json`.

## 8. Workstream F corrections — pending fresh independent delta review

This addendum supersedes any broader earlier sensitivity/precision implication. The original review at `a33f1ebf3f0f7d60b712f5d5b1ec24ec0db06d7d` requested F1–F8 changes. Changes on the *same draft PR branch* are candidate code for **a new independent review**, not an approval.

**Adjusted covariance/precision (F1, F8).** Joint 3-by-3 bootstrap covariance for pooled standardized noncurrent/current means and their contrast is checked for finite values, symmetry within relative numerical tolerance, nonnegative marginal variances, and positive-semidefiniteness within tolerance. Materially negative diagonal/eigenvalues are an error; they must not be truncated to zero. The preliminary numerical advisory checks adjusted and unadjusted means, positive finite contrast SE, valid CIs, and all replicates. A near-zero signed contrast is *not* judged by its RSE; unadjusted and adjusted mean RSE checks are advisory. `numerical_advisory_passed` **never authorizes publication**. Formal disclosure review remains separate.

**Bootstrap observability (F3, F4).** Design-bootstrap weights are generated from the entire PERSON design *before* restricting to the primary or interview-insurance complete-case domain. Both weighted two-part stages refit in every replicate. Zero and positive spending support is required in **each** group; rank deficient, nonconvergent, warning-generating or near-separated results fail closed. If `withReplicates` errors, diagnostics rerun the point fit and iterate **the exact generated replicate-weight columns** to identify the first failed replicate index with stage/group/reason. No replicate is silently removed and no unplanned variance fallback is used. A failure before writing the artifact is a documented execution blocker; stdout/stderr from an authorized run must be preserved. Multiple bootstrap sizes/stability checks remain **independent empirical review work**, not claimed completed by the fixed-seed 400-replicate candidate.

**Sensitivity contrast (F5, F6).** The insurance-adjusted model is compared with an otherwise identical **base model on the same interview-insurance-complete reference records**, with identical full-design bootstrap construction and seed. The main base model on its broader primary complete-case universe is still retained, but comparison of those two is a **composition** comparison, not an insurance coefficient effect. The known-no-history group contrast is **unadjusted only**. Its adjusted extension is **deferred**, not claimed. Age/sex/region/panel coding, interview-insurance missingness and calendar-year insurance are reported separately. Groupwise outcome-observed/primary-complete/insurance-complete **unweighted and weighted** loss is emitted.

**Diagnostic-only influence and support (F2, F7).** `comparator_influence_diagnostics()` adds group Kish effective n, positive/zero counts, weighted concentration, age-band by sex/region/panel cross-cell overlap tallies, one-PSU deletion *point-contrast* perturbations and top-one/top-five high-expenditure *point-contrast* perturbations. These are **descriptive influence probes, not valid replacement Taylor SEs, not formal imputations, and not primary trimmed estimates**. No full two-part refit under trimming is implied; that remains **deferred** pending prespecified scientific consideration. `comparator_model_audit()` adds per-group fitted probability extremes, both exposure-scenario prediction bounds, coefficient ranks/magnitudes and design-robust coefficient SE. Extreme or nonoverlapping patterns must be evaluated by a scientist; observed overlap is not proof of causal exchangeability.

**Statistical and software limits.** Kish n_eff does not incorporate clustering and is not interchangeable with design df. Leave-one-PSU and high-cost-case deletion results are deterministic sensitivity diagnostics only. Two-part model comparisons remain observational, potentially model-dependent and subject to within-2024 status/spending timing mismatch. All candidate aggregates remain local **preliminary** outputs under `artifacts/generated`; some diagnostic cell aggregates could be disclosure-sensitive and must not be publicly uploaded before suppression review. Payer/source-of-payment decomposition is **out of scope**, separate Issue #31 work.

### Explicit implementation inventory

| Analysis | Status |
|---|---|
| Covariance-aware unadjusted primary group contrast | **Implemented, retained** |
| Two-part pooled standardized primary adjusted contrast and joint bootstrap | **Implemented; synthetic-tested; real-data review pending** |
| Known-no-history restricted comparator | **Implemented, unadjusted only** |
| Primary covariate-complete vs outcome-observed unadjusted | **Implemented** |
| Interview-insurance adjusted model vs primary base on *identical* insurance-complete sample | **Implemented; empirical comparison pending** |
| Groupwise sample loss, Kish n, sparse cells, scenario probabilities, PSU/expense tail perturbations | **Diagnostic only; scientific interpretation pending** |
| Adjusted no-history and refit-under-tail sensitivity | **Deferred** |
| Alternative spending-family robustness, imputation, formal overlap weights | **Deferred; not required for this code candidate** |
| Payer/source-of-payment decomposition or attributable-cost inference | **Out of scope** |

### Engineering versus statistical evidence

Passing R synthetic tests verifies guards and representative algebra, not real HC-256 fit stability, 400-replicate precision adequacy, population overlap, inference validity, disclosure safety or publication readiness. A scientifically acceptable candidate still requires verified raw source bytes, independent numerical reproduction, a fresh F delta review, and separate PM scientific-release authorization.
