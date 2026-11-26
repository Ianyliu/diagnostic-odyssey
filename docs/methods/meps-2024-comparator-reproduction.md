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

## Workstream F reproduction and failure provenance (code candidate v0.2)

Independent F review requested correct adjusted contrast precision, replicate failure attribution, and explicit same-sample interpretation. The runner now fits three adjusted candidate variants, each based on 400 full-PERWT24F survey-bootstrap replicates with documented seed 20261019: primary base model on the primary complete-case sample; **base model without insurance on the insurance-complete sample**; and the **insurance-adjusted model on exactly the same insurance-complete sample**. Both insurance-complete models use the same survey-bootstrap generation seed, same variables in the pooled reference distribution, and the same sampling restrictions. Differences between the original primary base model and the insurance-complete base model quantify *composition/model-sample change* and should not be attributed to insurance adjustment.

The output contains numerical checks for adjusted and unadjusted subgroup means and both contrasts, finite positive contrast SE, covariance symmetry/PSD tolerance, and RSE advisory screening. It separately identifies `publication_approved=false` and `independent_methods_review=pending`. Successful numerical screening is **never** a reviewed release.

On a failed analytical stage after data-source verification, `artifacts/generated/meps24-comparator-candidate-<UTC timestamp>/failed-candidate.json` records the stage, error, requested replicates and seed, source input SHA-256, code commit and R session. If `withReplicates` fails, the code replays the exact generated design replicate columns and reports a **replicate index plus model stage and group positive/zero support**. The runner then fails with a nonzero status. **No invalid candidate estimates are written or promoted.**

Successful candidates now include `primary_influence`, `insurance_complete_influence`, `primary_model_audit`, `base_model_on_insurance_complete_sample_audit` and `insurance_sensitivity_model_audit` plus unweighted/weighted sample flow. Influence outputs (delete-one-PSU and delete-one/five highest expenditures) are **diagnostic-only point perturbations**, not alternate adjusted-model uncertainties and do not remove records from the primary fit. Candidate diagnostics and sample-cell metadata require independent disclosure review *before sharing or uploading*.

Capture a raw execution log, source checksums, exact commit SHA, toolchain/R session and generated JSON SHA-256. Independently re-estimate the covariance-aware unadjusted contrast, adjusted standardized means/covariance and paired insurance-complete models. In addition to the default 400 replicates, reviewers should assess Monte Carlo stability using a **separately prespecified, justified larger replicate count**; no such larger-B empirical result is yet asserted.

**Current precise blocker:** Verified raw respondent-level HC-256 `h256.dta` / official ZIP was not available inside the execution environment used to author the GitHub branch, and there is no R interpreter in that container. Publicly posted reviewed aggregate artifacts do **not** supply the individual-level record needed for these models. Source hashes in this document are **expected immutable policy values**, not claims of freshly computed raw-file hashes. No numerical comparison is reported until an authorized source-verified R run succeeds.

See [F1–F8 implementation disposition](meps-2024-comparator-F1-F8-response.md).
