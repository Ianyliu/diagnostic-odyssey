# MEPS 2024 Long COVID national burden methods

## Frozen analytical scope

The first real national burden pipeline uses **MEPS HC-256 (2024 Full Year Consolidated PUF) alone**. NHIS, HRSA/ACS, PLACES, CMS, and MEPS event files are not prerequisites.

Target population: the U.S. civilian noninstitutionalized population represented by MEPS 2024. Reference analytic cohort: adults age 18–64 meeting the operational current-Long-COVID definition below.

The machine-readable source of truth is `analysis/r/config/meps_2024_variable_map.json`. Variable names must not be introduced ad hoc in estimator scripts.

## Cohort definition

### Temporal estimand: common Round 3/1 2024 point-in-time anchor

The primary estimand is **operational current Long COVID at the Round 3/1 interview in 2024**, among adults age 18–64 at that same interview.

This deliberately uses the `31` variables for **both panels**:

- Panel 28: Round 3 interview, occurring in 2024;
- Panel 29: Round 1 interview, occurring in 2024.

It does **not** use a generic “latest valid `53`” rule. AHRQ documents that the two digits in round-specific variable names refer to Panel 28 / Panel 29 rounds respectively. For the 2024 PUF, Panel 29 Round 3 is a cross-year round whose interview occurs in **2025**, whereas Panel 28 Round 5 is the 2024 terminal round. Therefore `COVSYMNOW53` is not a common 2024 point-in-time measure across panels and cannot overwrite `COVSYMNOW31` in the primary 2024 cohort.

A panel-specific Panel-28-`53` / Panel-29-`31` rule was considered and rejected for the primary estimand because it would mix a later/end-of-year status for Panel 28 with an earlier Round-1 status for Panel 29. That is a different, panel-heterogeneous temporal estimand rather than a common interview-time anchor.

The `53` COVID/Long-COVID fields remain available only for diagnostics or future explicitly defined secondary analyses. They never determine primary cohort membership.

Authoritative AHRQ sources:

- HC-256 variable naming and Long-COVID documentation:
  https://meps.ahrq.gov/data_stats/download_data/pufs/h256/h256doc.shtml
- 2024 Priority Conditions Enumeration questionnaire:
  https://meps.ahrq.gov/survey_comp/hc_survey/2024/PE_2024.htm

### Age anchor

The age eligibility variable is **`AGE31X`**, not `AGE24X`.

AHRQ documents that `AGE31X` is age relevant to Panel 28 Round 3 / Panel 29 Round 1 and is calculated from date of birth relative to the interview date (or otherwise edited/imputed). That aligns the 18–64 age restriction with the same interview at which `COVSYMNOW31` is interpreted.

`AGE24X` instead represents age as of December 31, 2024. Using it for a Round-3/1 point-in-time cohort could incorrectly include people who were still 17 at the status interview but turned 18 later in 2024; AHRQ also notes that Long-COVID responses for children under 18 are coded Inapplicable on the public-use file for confidentiality. The primary cohort therefore requires `18 <= AGE31X <= 64`.

### Age-transition diagnostic cleanup

The primary age anchor remains `AGE31X`; only the audit diagnostic was cleaned. Review of the real HC-256 file found 414 records with different 18–64 eligibility under `AGE31X` versus `AGE24X`. After treating only 0–85 as valid diagnostic ages and excluding negative reserved codes from genuine-age labels, the differences partition as:

- 211: valid `AGE31X` 18–64 → valid `AGE24X` 65+;
- 148: valid `AGE31X` under 18 → valid `AGE24X` 18–64;
- 49: valid `AGE31X` 18–64 → `AGE24X` reserved/missing;
- 6: `AGE31X` reserved/missing → valid `AGE24X` 18–64.

The categories reconcile exactly to 414. Negative reserved age codes are never labeled as genuine under-18 ages.

### Reviewed source-code contract

Before any routing logic runs, the pipeline validates the observed HC-256 codes for the three primary Round-3/1 variables against the reviewed 2024 codebook sets:

- `COVIDEVER31`: -8, -7, -1, 1, 2;
- `LCEVER31`: -8, -7, -1, 1, 2;
- `COVSYMNOW31`: -8, -1, 1, 2.

Any NA or unreviewed numeric code is a fail-fast source-contract error. The pipeline does **not** silently recode a new value. Diagnostics record the reviewed allowable codes, observed codes, and observed counts for each variable.

### Route-aware COVID / Long-COVID classification

The 2024 PE instrument routes the COVID sequence as follows:

1. If both COVID-19 and Long COVID are already on the PE medical-conditions roster, route directly to `COVSYMNOW` (PE364).
2. If COVID-19 is already on the roster but Long COVID is not, route to `LCEVER` (PE362).
3. Otherwise ask `COVIDEVER` (PE350).
4. `COVIDEVER = Yes` routes to `LCEVER`.
5. `COVIDEVER = No / Refused / Don't Know` exits the Long-COVID sequence.
6. `LCEVER = Yes` routes to `COVSYMNOW`.
7. `LCEVER = No / Refused / Don't Know` exits that portion of the sequence.
8. `COVSYMNOW` is therefore applicable only after Long-COVID history has been established in the current or a prior round.

AHRQ further documents that prior **Yes** values for `COVIDEVER` and `LCEVER` are preserved for respondents who remain eligible.

The primary Round-3/1 classifier therefore interprets public-use `-1 Inapplicable` **in routing context** rather than globally:

- `COVIDEVER31 = 2` with structurally inapplicable downstream `LCEVER31/COVSYMNOW31` is a **known noncase**, not missing Long-COVID history.
- `COVIDEVER31 = -7/-8` with no downstream answer is **unresolved antecedent status**, not a noncase.
- `LCEVER31 = 2` is a **known Long-COVID-history noncase**.
- `LCEVER31 = -7/-8` is **unresolved Long-COVID history**.
- A substantive `COVSYMNOW31` response implies the respondent reached the current-status question and therefore had established Long-COVID history through current/prior routing; routing contradictions are flagged rather than silently coerced.
- For established Long-COVID history, `COVSYMNOW31 = 1` is an operational current case and `2` is known non-current.
- For established Long-COVID history, `COVSYMNOW31 = -7/-8` or an unexpected `-1` is **genuine unresolved current status**.
- For people with known no Long-COVID history, `COVSYMNOW31 = -1` is an expected structural skip and is **not** counted as current-status item nonresponse.
- Negative reserved values are never globally converted to No; their interpretation depends on the PE route.

The primary cohort is:

1. positive `PERWT24F`;
2. `AGE31X` 18–64;
3. route-aware established Long-COVID history at Round 3/1; and
4. `COVSYMNOW31 = 1`.

**Wording caveat:** `COVSYMNOW31` asks whether the person has COVID-19 or Long COVID-19 symptoms “now.” The project therefore describes this as an **operational current-Long-COVID cohort at the Round 3/1 2024 interview**, conditional on established Long-COVID history. It is not a claim that `COVSYMNOW31` alone uniquely diagnoses Long COVID.

`COVREDABIL31/53` remains mapped for future severity work but is not used in the primary cohort.

## Survey design

AHRQ identifies `VARSTR` and `VARPSU` for Taylor-series variance estimation and says a with-replacement design yields appropriate MEPS standard errors. R's `survey` package is used with:

- strata: `VARSTR`
- PSU: `VARPSU`
- person outcomes: `PERWT24F`
- ESAQ outcomes: `ESAQWT24F`, with `ESAQELIG=1`
- PSAQ outcomes: `SAQWT24F`, with `SAQELIG=1`
- joint PSAQ+ESAQ weight: `PESAQWT24F` **only** for a future analysis that actually combines the two questionnaire families; it is not used here.

The full weight-specific design is constructed before cohort domain estimation. Raw rows are not pre-filtered to cases.

Software policy: `survey.lonely.psu="adjust"` remains explicit for any actual lonely PSU in a full weight-specific design, while `survey.adjust.domain.lonely=FALSE` uses ordinary full-design domain variance without the additional domain-singleton heuristic. The full design is always constructed before domain restriction.

For confidence intervals, the point estimate and Taylor-linearized standard error come from the correct analytical domain, but the t critical value uses the degrees of freedom from the relevant **full weight-specific design**: PERSON/`PERWT24F`, ESAQ/`ESAQWT24F`, or PSAQ/`SAQWT24F`. The df is computed at runtime and is never hard-coded. Zero, negative, or nonfinite reference-design df cause analytical failure.

For binary proportions, the current implementation uses a Taylor-linearized t interval and post-hoc bounds it to [0,1]. This is retained for this correction pass to avoid bundling an unrelated interval-method change. It is a documented follow-up limitation for later methods review.

## Variance-policy adjudication

Before changing the domain-singleton policy, a review-only real HC-256 run (GitHub Actions run `35730539778`) compared the existing additional domain adjustment with ordinary full-design domain variance while holding the cohort, weights, Taylor estimator, and `subset(survey.design, domain)` path fixed.

All three full weight-specific designs had the same variance topology:

- 105 variance strata;
- 264 unique `VARSTR`/`VARPSU` combinations;
- minimum 2 and maximum 5 PSUs per stratum;
- PSU distribution: 64 strata with 2 PSUs, 30 with 3, 9 with 4, and 2 with 5;
- **zero true singleton full-design strata**;
- `survey::degf() = 159`.

The current-case domains were much smaller and consequently had one-PSU **representation within the domain** in 33 PERSON strata, 42 ESAQ strata, and 40 PSAQ strata. These are not true full-design singleton strata.

Sensitivity analysis across all 21 candidate estimates found identical point estimates under `survey.adjust.domain.lonely=TRUE` versus `FALSE` (maximum relative point-estimate difference 0). Under ordinary domain variance, standard errors changed by 0% to approximately -13% relative to the extra adjusted-domain heuristic. The 1,454 repeated domain-singleton warnings produced with the heuristic enabled disappeared when it was disabled. Warning disappearance is an observed software consequence, **not** the methodological justification.

The primary policy is therefore:

- retain `survey.lonely.psu="adjust"` for a genuine full-design lonely-PSU situation;
- use `survey.adjust.domain.lonely=FALSE` for this MEPS domain analysis;
- continue estimating domains from the full survey design, never from raw-prefiltered records.

This decision follows AHRQ's domain-analysis guidance to retain the full MEPS design and the R `survey` package distinction between actual lonely PSUs and one-PSU representation inside a domain. The package's additional domain-lonely adjustment is a separate heuristic rather than the ordinary domain variance calculation.

**Freeze note for the final metadata/provenance hardening pass:** this variance sensitivity and primary policy are preserved exactly. The hardening pass does not change cohort membership, routing, weights, VARSTR/VARPSU, Taylor linearization, `survey.adjust.domain.lonely=FALSE`, full-design CI df selection, estimators, thresholds, or the bounded t-based proportion CI implementation.

## Tier 1 estimands

### Represented population
Survey-weighted total number of **status-classifiable** adults 18–64 meeting the operational current-Long-COVID definition. Respondents whose current-Long-COVID status remains unresolved after the reviewed routing rules are excluded from this represented-population estimator and are **not imputed** as either cases or noncases.

### Gross all-cause spending
These are **calendar-year 2024** expenditures among adults who met the operational current-Long-COVID definition at their Round 3/1 interview in 2024. The point-in-time classification does not imply symptoms persisted throughout 2024, and annual expenditures may occur before or after the status interview.

Using `TOTEXP24` with `PERWT24F`:

- total annual all-cause health-care expenditure;
- mean annual all-cause health-care expenditure/person.

Using `TOTSLF24`:

- total and mean amount paid by self/family.

`TOTSLF24` is a **source-of-payment component** of total expenditure and is never added back to `TOTEXP24`. All spending is labeled gross/all-cause, not attributable, preventable, diagnostic-delay cost, or savings.

### Utilization
These are **calendar-year 2024** all-cause utilization measures among adults classified operational-current at the Round 3/1 2024 interview. They do not imply that Long COVID persisted throughout the year or caused any visit.

HC-256 annual person-level fields are sufficient for the first pass; event PUFs are not required:

- `OBTOTV24`: office-based provider visits;
- `OPTOTV24`: outpatient department provider visits;
- `ERTOT24`: emergency-room visits;
- `IPDIS24`: hospital discharges.

For each, report the survey-weighted annual mean count and the proportion with at least one event.

## Tier 2 — ESAQ healthcare-work / administrative burden

Use `ESAQWT24F` among `ESAQELIG=1`, then estimate the domain of respondents who had been classified operational-current at the **earlier Round 3/1 2024 interview**. AHRQ fielded the ESAQ later, in **Panel 28 Round 5 / Panel 29 Round 3**. The later ESAQ response therefore does not demonstrate that current Long COVID persisted through supplement administration.

The edited `EQMVAM53`, `EQMBAM53`, and `EQPPAM53` fields are AHRQ **annualized hours-per-year measures** derived from respondents' original reporting periods. They should not be described as necessarily observed hours during calendar year 2024.

Report separately:

- `EQMVAM53`: annualized hours on own visits/filling prescriptions; AHRQ top-code 2,080 hours.
- `EQMBAM53`: annualized hours managing medical bills/insurance; top-code 720 hours.
- `EQPPAM53`: annualized hours on paperwork/finding doctors/plan information/approvals; top-code 520 hours.

These are **not summed**. AHRQ also notes substantial paper-survey item nonresponse for the time questions; that limitation is carried into artifacts.

For `EQDENY53`, the initial proportion denominator is deliberately narrow: current-Long-COVID ESAQ respondents age 18–64 with a substantive Yes/No response (codes 1 or 2). Codes 3 (never insured) and 4 (not applicable/haven't used services), plus reserved codes, are excluded. The label must name this response universe.

## Tier 3 — PSAQ mental/human burden

Use `SAQWT24F` among `SAQELIG=1` for respondents previously classified operational-current at the **earlier Round 3/1 2024 anchor**. Later PSAQ distress/screening outcomes do not demonstrate continued current Long COVID at supplement administration and are not interpreted causally.

- `K6SUM42`: official constructed K6 score, range 0–24. Report mean score and serious nonspecific psychological distress prevalence at >=13, following AHRQ's published classification.
- `PHQ242`: official constructed PHQ-2 score, range 0–6. Report mean score and screen-positive prevalence at >=3; HC-256 documentation describes 3 as a screening cut point.

K6 is nonspecific psychological distress, not a psychiatric diagnosis. PHQ-2 is a depressive-symptom screen, not a depression diagnosis. Neither is monetized, and neither is interpreted as caused by Long COVID or diagnostic delay.

## Missingness

Constructed nonnegative spending/utilization values retain zero as a real value. Negative MEPS reserved values are converted to `NA` only for the measure whose codebook identifies them as non-substantive/reserved. Questionnaire missingness is not turned into zero.

Every measure reports the valid-response unweighted N and weighted analytic denominator. Candidate review must inspect missingness before release.

## Corrected candidate diagnostics and observability

The next real-data candidate is intended for independent methods review, not release. Its `diagnostics.json` records enough information to reconstruct the primary cohort routing and identify unstable computational behavior without exposing respondent-level records.

### Cohort diagnostics

Counts are reported within the primary target scope (`AGE31X` 18–64 with positive `PERWT24F`) unless explicitly stated otherwise:

- total HC-256 rows;
- target age-eligible unweighted N and weighted population;
- discrepancies between `AGE31X` eligibility and calendar-year-end `AGE24X` eligibility;
- `COVIDEVER31` Yes / No / Refused / Don't Know / structural-Inapplicable counts;
- `LCEVER31` Yes / No / Refused / Don't Know / structural-Inapplicable counts;
- known no-COVID and no-Long-COVID routing counts;
- true unresolved Long-COVID-history count and routing-conflict count;
- `COVSYMNOW31` Yes / No / Refused / Don't Know / Inapplicable counts;
- expected structural current-status skips among people without established Long-COVID history;
- true unresolved current status among people with established Long-COVID history;
- valid Round-31/Round-53 current-status disagreements as a temporal diagnostic only;
- classifiable, unresolved, and current-case N;
- Panel 28 and Panel 29 current-case N and weighted totals;
- ESAQ and PSAQ current-case unweighted and weighted totals.

The Round-53 diagnostic fields are never used to change primary cohort membership.

### Warning observability

Each major estimation stage is wrapped by a warning observer:

- represented population;
- spending;
- utilization;
- ESAQ;
- PSAQ.

Warnings are **not suppressed** and are not globally converted to errors. The original warning remains visible in GitHub Actions, while `diagnostics.json` also stores each unique warning's analytical stage, condition class, message, and repetition count. This is specifically intended to diagnose the repeated warning summaries observed in the previous preliminary candidate run.

### Survey design degrees of freedom

The pipeline records design degrees of freedom for:

- the full person design;
- the represented-population classifiable domain;
- the current-case person domain;
- the ESAQ current-case domain;
- the PSAQ current-case domain.

Only finite positive design degrees of freedom are accepted. The pipeline no longer replaces zero, negative, or nonfinite values with an artificial df of 1; such a condition causes explicit analytical failure before candidate generation completes.

### Prior candidate baseline

Workflow run `35705520659` / artifact `10683963312` is retained only as a preliminary comparison baseline. It must not be promoted, overwritten, or selected by the runtime. A corrected candidate must be generated as a new workflow artifact tied to the corrected commit and then independently reviewed.

## Candidate hardening and review provenance

Future candidates record aggregate survey-design construction exclusions under `diagnostics.json -> design -> row_filtering`, separately for PERSON/`PERWT24F`, ESAQ/`ESAQWT24F`, and PSAQ/`SAQWT24F`. The diagnostics report retained and excluded row counts, criterion counts for eligibility/weight/`VARSTR`/`VARPSU` failures, and counts by exact exclusion-reason combination. Criterion counts can overlap; they are not summed to infer excluded N. Each design instead enforces the direct reconciliation `retained_n + excluded_any_n == total_input_n`. These are aggregate counts only and do not expose respondent-level records.

Candidate serialization is fail-closed for headline numeric estimates. `value`, `standard_error`, `interval_low`, and `interval_high` must each be one finite numeric value; standard errors cannot be negative; confidence-interval endpoints must be ordered; and the point estimate must lie inside its interval. Validation errors identify the offending `estimate_id` and condition before `bundle.json` is written.

Focused regressions now pin the reviewed analytical semantics for the EQDENY53 substantive Yes/No universe, ESAQ annualized-time ranges/top-code boundaries (2,080 / 720 / 520), K6 score range 0–24 with serious-distress threshold >=13, and PHQ-2 range 0–6 with screen-positive threshold >=3. These tests preserve the reviewed transformations; they do not introduce clamping or reinterpret questionnaire screens as diagnoses.

The historical variance-policy sensitivity executable is archived in `analysis/r/review/meps_variance_policy_review.R`, with provenance in `analysis/r/review/README.md`. It records the historical `methods-variance-review` source commit and reviewed workflow run while retaining the current production policy (`survey.lonely.psu="adjust"`, `survey.adjust.domain.lonely=FALSE`) unchanged.

## Release semantics

A successful run produces `display_status="analytical_artifact"` but `release_status="preliminary"`. Script execution is not scientific approval. The candidate must pass the review checklist before any status is changed to `reviewed_released`.

## Authoritative references

- HC-256 detail page: https://meps.ahrq.gov/data_stats/download_data_files_detail.jsp?cboPufNumber=HC-256
- HC-256 documentation: https://meps.ahrq.gov/data_stats/download_data/pufs/h256/h256doc.shtml
- HC-256 HTML codebook: https://meps.ahrq.gov/mepsweb/data_stats/download_data_files_codebook.jsp?PUFId=H256
- AHRQ example K6 classification: https://meps.ahrq.gov/data_files/publications/st570/stat570.shtml


## Promotion-readiness provenance hardening

The reviewed HC-256 source bytes are pinned by SHA-256 in `analysis/r/config/meps_hc256_source_integrity.json`, based on the successful third-candidate source metadata from workflow run `35745589631` / artifact `10702872683`:

- official HC-256 Stata ZIP: `653891861ec18574b07f576915e6f9e423263fc947610dc34e1bd176feff7b40`;
- extracted `h256.dta`: `b4bde859b39f626345561c05570292bb7264dd92eb76ce0c1a14d6b89076aed5`.

A hash mismatch is a review event, not an invitation to update the expected value automatically. Candidate generation fails until the changed official source is reviewed.

In GitHub Actions, the checked-out commit must equal `GITHUB_SHA`. The R runner independently checks its `git rev-parse HEAD` value against the same environment SHA and records the result in diagnostics/review metadata.

Each candidate preserves SHA-256 checksums for `bundle.json` and `diagnostics.json` in the review manifest and writes an aggregate-only `SHA256SUMS` file for the candidate package.
