# Analytical candidate review and release workflow

A Diagnostic Odyssey analytical result passes through four distinct states:

```text
raw public-use input
→ intermediate survey calculations
→ candidate analytical artifact
→ reviewed/released analytical artifact
```

The MEPS runner stops at **candidate analytical artifact**.

## Execution layers

Diagnostic Odyssey deliberately separates four different mechanisms:

1. **Ordinary CI** (`.github/workflows/ci.yml`) — runs on pushes/PRs and checks TypeScript correctness, build/lint/tests, and synthetic R scientific invariants. It does not touch real HC-256 microdata.
2. **Manual real-data candidate workflow** (`.github/workflows/meps-candidate.yml`) — runs only through `workflow_dispatch`, downloads the official public AHRQ HC-256 Stata file on an ephemeral GitHub-hosted runner, reruns synthetic checks, generates a preliminary candidate, validates it, and uploads only aggregate review files.
3. **Methods review** — a human/scientific assessment of cohort behavior, precision, denominators, plausibility, provenance, and interpretation.
4. **Release** — an explicit later promotion of only reviewed estimates to `reviewed_released`.

A green CI run or successful real-data workflow is therefore **not** a scientific release decision.

## GitHub Actions candidate generation

Workflow: **MEPS 2024 Long COVID Candidate**

The workflow checks out the exact `github.sha` selected by the manual dispatch, explicitly asserts `git rev-parse HEAD == GITHUB_SHA`, and records repository/ref, run ID, run attempt, SHA, and timestamp. The R runner repeats the commit-vs-`GITHUB_SHA` assertion before generating analytical output. It uses Node 22 and R 4.6.1, reruns TypeScript and synthetic R checks, then invokes the maintained HC-256 downloader and MEPS runner.

The workflow artifact contains only:

- `bundle.json`
- `diagnostics.json`
- `review-manifest.json`
- `hc256-source-metadata.json`
- `github-actions-run-manifest.json`
- `SHA256SUMS`

The review manifest also preserves SHA-256 values for `bundle.json` and `diagnostics.json`. The raw ZIP, `h256.dta`, person-level rows, and intermediate microdata are never uploaded. Raw files exist only ephemerally on the GitHub-hosted runner.

Workflow **candidate** artifacts are retained for 14 days and are named `meps-2024-long-covid-candidate-<run-id>`. This short-lived Actions copy is review transport only and is not the durable store for an approved artifact.

## Source-integrity gate

The current reviewed HC-256 bytes are pinned in `analysis/r/config/meps_hc256_source_integrity.json` using both the official ZIP SHA-256 and extracted Stata-file SHA-256. The downloader and runner fail on a mismatch. Expected hashes may be changed only after explicit review of an updated official AHRQ source; they must never be changed merely to make CI or a candidate run succeed.

## Candidate generation

The runner writes:

```text
artifacts/generated/meps-2024-long-covid-candidate/
  bundle.json
  diagnostics.json
  review-manifest.json
```

`bundle.json` uses `display_status="analytical_artifact"` but every generated numeric estimate uses `release_status="preliminary"`.

The runtime/export gate therefore cannot include these estimates in a released Planning Brief.

## Mandatory review

Before any estimate can be changed to `reviewed_released`, all checklist items must be explicitly reviewed:

1. **Methods review** — estimator matches the frozen variable/estimand map and survey design.
2. **Cohort review** — Long COVID round-resolution diagnostics are plausible; conflicts/missing histories are inspected.
3. **Weighted/unweighted N review** — every measure's analytical N and weighted denominator are plausible for its questionnaire universe.
4. **Interval review** — standard errors/CIs are finite, appropriately wide, and use the intended design.
5. **Denominator/universe review** — person, ESAQ, PSAQ, and EQDENY-specific denominators are accurately labeled.
6. **Plausibility review** — totals/means/proportions are compared with relevant AHRQ published distributions or other justified benchmarks.
7. **Provenance review** — source locator, dataset release, code commit, input checksum, weight, VARSTR/VARPSU, and method metadata are present.
8. **Interpretation review** — labels preserve gross-vs-attributable, national-vs-local, component-vs-total, screening-vs-diagnosis, and assumption-vs-effect boundaries.

A reviewer also confirms that no suppressed/unreliable value should be released.

## Durable reviewed-artifact storage

Actions retention is intentionally not relied upon for a reviewed release. Once a candidate has completed methods review and is explicitly approved, its **aggregate-only** reviewed package should be copied into:

`artifacts/reviewed/<artifact_version>/`

and committed to repository history together with:

- the reviewed `bundle.json`;
- reviewed `diagnostics.json`;
- completed review manifest;
- safe HC-256 source metadata;
- GitHub run provenance;
- `SHA256SUMS`.

A GitHub Release may additionally attach the same immutable aggregate package for convenient retrieval, but the version-controlled reviewed directory is the primary durable provenance record. Raw HC-256 ZIP/DTA files and respondent-level/intermediate data remain excluded.

The reviewed directory must not be created by the candidate workflow. Creating it is an explicit promotion action after human methods review.

## Promotion

Promotion is intentionally **not automated**. There is no script that silently changes `preliminary` to `reviewed_released`.

After review, a reviewer should:

1. copy the approved aggregate candidate into `artifacts/reviewed/<artifact_version>/`;
2. update only explicitly approved estimates to `reviewed_released`;
3. mark unavailable/suppressed estimates appropriately;
4. attach the completed review manifest;
5. rerun the TypeScript artifact validator;
6. rerun repository CI;
7. only then change runtime artifact selection to the reviewed version.

The completed review manifest is evidence of review, not a substitute for code review or statistical judgment.


## Completed reviewed promotion — MEPS 2024 Long COVID

The reviewed artifact at
`artifacts/reviewed/meps-2024-long-covid-candidate-20260923T020607Z/`
is an explicit release-state-only promotion of workflow run
`35808850878`, artifact ID `10728314484`, generated by analytical
commit `8952bb7446b7b0461e41f1794146ab5e612ebf40`.

Promotion convention for this reviewed package:

- all eight review-manifest checks use `status="approved"`;
- overall review-manifest `release_status="reviewed_released"`;
- `automatic_release=false`;
- all 21 analytical estimates use `release_status="reviewed_released"`;
- candidate and reviewed bundle SHA-256 identities are preserved separately;
- diagnostics, HC-256 source metadata, and GitHub Actions run provenance remain byte-identical to the approved candidate;
- no analytical recomputation occurred during promotion;
- runtime artifact selection was not changed by the promotion commit.

The promotion followed completed methods, cohort, weighted/unweighted N,
interval, denominator/universe, plausibility, provenance, interpretation,
and final promotion-gate review. No reviewer credentials are asserted.


## Separate local-context release path — HRSA + ACS

Local implementation context has an independent artifact family and does not alter the reviewed MEPS package.

```text
official HRSA/ACS source
→ validated source snapshot / label contract
→ preliminary local-context candidate
→ independent local-context review
→ reviewed_released local-context artifact
→ later runtime composition with the unchanged reviewed MEPS artifact
```

The manual workflow is `.github/workflows/local-context-candidate.yml` (**Local Context Candidate — WV HRSA + ACS**). It requires the repository Actions secret `CENSUS_API_KEY`, checks out the exact dispatched SHA, acquires the current HRSA Primary Care and Mental Health All-HPSAs CSVs plus the 2024 ACS 5-year Data Profile state query for West Virginia (FIPS 54), verifies source contracts, and uploads aggregate-only review files.

Candidate HRSA/ACS indicators use `release_status="preliminary"` and `context_type="contextual_indicator"`. They are not selected by the web runtime, do not populate Local Context, and cannot modify MEPS estimates or scenario arithmetic. Promotion remains an explicit later action after independent review.


## Completed reviewed promotion — MEPS Typical Range Phase A

The reviewed artifact at
`artifacts/reviewed/meps-2024-long-covid-candidate-20260926T011343Z/`
is an explicit release-state-only promotion of workflow run
`36207596582`, artifact ID `10894637150`, generated by analytical
commit `7b56517442d75f6ac662e7f8db6bbd44cca3de33`.

This promotion performed **no numerical recomputation**. All 21 pre-existing
Estimate records are unchanged under the reviewed normalization that excludes
only `release_status`, `artifact_version`, and the newly reviewed
`distribution_summary` field.

The two reviewed survey-weighted Typical Ranges are:

- `meps24-gross-all-cause-spending-mean` (`TOTEXP24`): mean
  14237.696056344794 USD/person/year (95% CI
  10668.223034717283–17807.169077972307), median 3624, and Typical Range
  (25th–75th percentile) 1116–14840; unweighted n=380 and weighted
  denominator=6831165.1075489996 using `PERWT24F`, `VARSTR`, and `VARPSU`.
- `meps24-healthcare-paperwork-time-mean` (`EQPPAM53`): mean
  24.489576768149263 hours/person/year (95% CI
  12.761858181564543–36.217295354733984), median 3, and Typical Range
  (25th–75th percentile) 0–12; unweighted n=296 and weighted
  denominator=6814915.2541849995 using `ESAQWT24F`, `VARSTR`, and `VARPSU`.

These quartiles are survey-weighted point estimates. The interquartile range is
descriptive and is **not** a confidence interval; Phase A does not report
separate sampling-confidence intervals around the quantile cutpoints. The
520-hour `EQPPAM53` top code is far above p75=12, so it does not determine
the reported IQR, but it remains a documented limitation for the upper tail and
mean.

Runtime selection is intentionally unchanged by this promotion. The web runtime
continues to select
`meps-2024-long-covid-candidate-20260923T020607Z`, because the reviewed West
Virginia local-context artifact remains explicitly bound to that national MEPS
version. A separate follow-up change must review compatibility/rebinding before
the national runtime selector can move.

Phase 2 Pilot calibration remains unsupported: no current reviewed MEPS
distribution exactly matches a Pilot assumption in construct,
population/denominator, and unit. These reviewed ranges remain descriptive
national burden evidence and must not be represented as causal or attributable
burden, preventable spending, savings, or local/state burden.
