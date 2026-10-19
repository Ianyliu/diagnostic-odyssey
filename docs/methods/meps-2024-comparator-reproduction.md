# MEPS 2024 comparator — reproduction runbook and current blocker

## Current data availability (2026-10-19)

The **connected GitHub repository provides reviewed aggregate MEPS candidate artifacts and their provenance manifests**, but not an accessible respondent-level `h256.dta` in this execution environment. The container used to author this branch also has no R installation or AHRQ-data network route. Therefore the new comparator **has not produced a real HC-256 numerical estimate** here. Prior reviewed 21-estimate values are **not** substitute comparator outputs; synthetic test frames are expressly not evidence.

AHRQ HC-256 is a publicly released data source (August 2026), but this is not equivalent to verified availability to this execution environment. The source is downloaded only by a permitted operator in a suitable R environment, and source integrity must pass before any fit.

## Exact source integrity (preserved from existing reviewed policy)

- Official source: https://meps.ahrq.gov/data_files/pufs/h256/h256dta.zip
- Original reviewed policy: `analysis/r/config/meps_hc256_source_integrity.json`
- Expected ZIP SHA256: `653891861ec18574b07f576915e6f9e423263fc947610dc34e1bd176feff7b40`
- Expected extracted `h256.dta` SHA256: `b4bde859b39f626345561c05570292bb7264dd92eb76ce0c1a14d6b89076aed5`
- Any mismatch is **fail-fast** and requires independent source revision review; do **not** update hashes to bypass validation.

## Reproduce in an authorized, network-enabled environment

From the exact branch/commit at the repository root:

```bash
Rscript analysis/r/install_dependencies.R
Rscript analysis/r/tests/run_tests.R
# Option A: place the official, independently verified source Stata ZIP under data/raw/meps/2024/.
# Option B: fetch and verify against the immutable source-integrity policy:
Rscript pipelines/data/download_meps_hc256.R
Rscript analysis/r/comparator/run_comparator_candidate.R
```

The runner reads the original route-aware 2024 cohort code and returns preliminary comparator-only aggregates under `artifacts/generated/meps24-comparator-candidate-<UTC timestamp>/`, with `candidate-comparator.json` and `review-manifest.json`. No raw data are copied to the candidate output. A manual run **does not** alter `artifacts/reviewed/` or the application. Keep local candidate files private until suppression/disclosure approval. Do not upload small or potentially disclosive subgroup diagnostics to a publicly accessible artifact store.

The default full survey design uses `PERWT24F`, and both adjusted analyses request 400 design-bootstrap replicates. Execution failure (singular model, invalid replicate, unexpected code or source checksum mismatch) is a **scientific blocker**, not license to drop records or rerun until a desired result appears.

## Independent acceptance checklist

1. Cross-reference the source/commit SHA and AHRQ documentation, then reconcile the existing age/status-cohort diagnostics with the original reviewed release.
2. Confirm all primary comparator group memberships including known prior history, structural skips, unresolved history and routing conflicts.
3. Independently reproduce unadjusted `survey::svyby(..., covmat=TRUE)` contrast, covariance, and t degrees of freedom from the full person design.
4. Independently reproduce two-part survey-weighted model coefficients, original point predictions, and bootstrap covariance; compare model audit against refit results, examine sparse categories/positivity, separation and influential weights.
5. Review outcome/insured/covariate missingness and weighted denominators for the primary and restricted comparator, age/sex/region/panel mapping and 2024 insurance timing.
6. Validate sensitivity analyses and the reliability/suppression recommendations on observed positive counts, N, RSE and design effects. The advisory `N >=100` and positive `N >=30` minimums are *not* sufficient on their own.
7. Have an independent scientist approve or reject the noncausal interpretation, proposed future UI contract and explicit temporal mismatch. **Do not promote any estimate as part of this PR.**

## Out of scope for Issue #31 here

The payer/source-of-payment decomposition is a separate, still-pending scientific analysis; no `TOTSLF24` component is added to `TOTEXP24` and no state Medicaid-claim inference is made.

## Test evidence policy

GitHub PR CI includes `Rscript analysis/r/tests/run_tests.R`, along with build, type checking and checksums. Record the **exact final HEAD, run ID, job statuses and method-test result** after the final commit. An R test job that fails during third-party package installation is infrastructure-inconclusive, **not** a method pass.
