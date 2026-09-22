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

Software policy: `survey.lonely.psu="adjust"` and `survey.adjust.domain.lonely=TRUE`. Candidate artifacts record this choice. Intervals are 95% t intervals using finite positive survey-design degrees of freedom; zero, negative, or nonfinite design degrees of freedom are an analytical failure rather than being replaced with an artificial value.

For binary proportions, the current implementation uses a Taylor-linearized t interval and post-hoc bounds it to [0,1]. This is retained for this correction pass to avoid bundling an unrelated interval-method change. It is a documented follow-up limitation for later methods review.

## Tier 1 estimands

### Represented population
Survey-weighted total number of adults 18–64 meeting the operational current-Long-COVID definition.

### Gross all-cause spending
Using `TOTEXP24` with `PERWT24F`:

- total annual all-cause health-care expenditure;
- mean annual all-cause health-care expenditure/person.

Using `TOTSLF24`:

- total and mean amount paid by self/family.

`TOTSLF24` is a **source-of-payment component** of total expenditure and is never added back to `TOTEXP24`. All spending is labeled gross/all-cause, not attributable, preventable, diagnostic-delay cost, or savings.

### Utilization
HC-256 annual person-level fields are sufficient for the first pass; event PUFs are not required:

- `OBTOTV24`: office-based provider visits;
- `OPTOTV24`: outpatient department provider visits;
- `ERTOT24`: emergency-room visits;
- `IPDIS24`: hospital discharges.

For each, report the survey-weighted annual mean count and the proportion with at least one event.

## Tier 2 — ESAQ healthcare-work / administrative burden

Use `ESAQWT24F` among `ESAQELIG=1`, then estimate the Long COVID domain.

Report separately:

- `EQMVAM53`: annualized hours on own visits/filling prescriptions; AHRQ top-code 2,080 hours.
- `EQMBAM53`: annualized hours managing medical bills/insurance; top-code 720 hours.
- `EQPPAM53`: annualized hours on paperwork/finding doctors/plan information/approvals; top-code 520 hours.

These are **not summed**. AHRQ also notes substantial paper-survey item nonresponse for the time questions; that limitation is carried into artifacts.

For `EQDENY53`, the initial proportion denominator is deliberately narrow: current-Long-COVID ESAQ respondents age 18–64 with a substantive Yes/No response (codes 1 or 2). Codes 3 (never insured) and 4 (not applicable/haven't used services), plus reserved codes, are excluded. The label must name this response universe.

## Tier 3 — PSAQ mental/human burden

Use `SAQWT24F` among `SAQELIG=1`.

- `K6SUM42`: official constructed K6 score, range 0–24. Report mean score and serious nonspecific psychological distress prevalence at >=13, following AHRQ's published classification.
- `PHQ242`: official constructed PHQ-2 score, range 0–6. Report mean score and screen-positive prevalence at >=3; HC-256 documentation describes 3 as a screening cut point.

K6 is nonspecific psychological distress, not a psychiatric diagnosis. PHQ-2 is a depressive-symptom screen, not a depression diagnosis. Neither is monetized, and neither is interpreted as caused by Long COVID or diagnostic delay.

## Missingness

Constructed nonnegative spending/utilization values retain zero as a real value. Negative MEPS reserved values are converted to `NA` only for the measure whose codebook identifies them as non-substantive/reserved. Questionnaire missingness is not turned into zero.

Every measure reports the valid-response unweighted N and weighted analytic denominator. Candidate review must inspect missingness before release.

## Release semantics

A successful run produces `display_status="analytical_artifact"` but `release_status="preliminary"`. Script execution is not scientific approval. The candidate must pass the review checklist before any status is changed to `reviewed_released`.

## Authoritative references

- HC-256 detail page: https://meps.ahrq.gov/data_stats/download_data_files_detail.jsp?cboPufNumber=HC-256
- HC-256 documentation: https://meps.ahrq.gov/data_stats/download_data/pufs/h256/h256doc.shtml
- HC-256 HTML codebook: https://meps.ahrq.gov/mepsweb/data_stats/download_data_files_codebook.jsp?PUFId=H256
- AHRQ example K6 classification: https://meps.ahrq.gov/data_files/publications/st570/stat570.shtml
