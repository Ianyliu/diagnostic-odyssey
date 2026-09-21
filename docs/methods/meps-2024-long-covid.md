# MEPS 2024 Long COVID national burden methods

## Frozen analytical scope

The first real national burden pipeline uses **MEPS HC-256 (2024 Full Year Consolidated PUF) alone**. NHIS, HRSA/ACS, PLACES, CMS, and MEPS event files are not prerequisites.

Target population: the U.S. civilian noninstitutionalized population represented by MEPS 2024. Reference analytic cohort: adults age 18–64 meeting the operational current-Long-COVID definition below.

The machine-readable source of truth is `analysis/r/config/meps_2024_variable_map.json`. Variable names must not be introduced ad hoc in estimator scripts.

## Cohort definition

AHRQ states that `LCEVER31` and `LCEVER53` identify symptoms lasting at least three months that were not present before COVID-19, and that prior **Yes** responses are preserved for respondents who remain eligible. AHRQ asks `COVSYMNOW31/53` when Long COVID was reported in the current or an earlier round.

The operational cohort is therefore:

1. `AGE24X` is 18 through 64.
2. Long COVID history is positive if **either** valid `LCEVER31` or `LCEVER53` is 1 (Yes).
3. Among history-positive adults, current symptoms are taken from the **latest valid assessment**: use `COVSYMNOW53` when it is 1/2; otherwise fall back to `COVSYMNOW31` when it is 1/2.
4. A current case requires positive Long COVID history **and** latest valid current-symptom response = 1.
5. A history-positive respondent with latest valid current-symptom response = 2 is classified non-current.
6. A respondent with no Long COVID-history Yes cannot enter solely because `COVSYMNOW` is Yes. If valid history responses are only No, classify noncase; if history is unresolved because only reserved/missing codes are available, classify unknown.
7. Negative reserved values (including Don't Know, Refused, Inapplicable, Cannot Be Computed) are missing/unknown, never No.
8. A logically inconsistent earlier-Yes/later-No history remains history-positive and is flagged for diagnostic review because the HC-256 documentation says prior Yes values are preserved.

**Wording caveat:** `COVSYMNOW` is labeled “Has COVID-19 or Long COVID-19 symptoms now.” Therefore “current Long COVID” in this project is shorthand for this operational combination, not a claim that the current-symptom item alone uniquely identifies Long COVID.

`COVREDABIL31/53` is retained in the reviewed variable map for future severity work but is not used to define the primary cohort.

## Survey design

AHRQ identifies `VARSTR` and `VARPSU` for Taylor-series variance estimation and says a with-replacement design yields appropriate MEPS standard errors. R's `survey` package is used with:

- strata: `VARSTR`
- PSU: `VARPSU`
- person outcomes: `PERWT24F`
- ESAQ outcomes: `ESAQWT24F`, with `ESAQELIG=1`
- PSAQ outcomes: `SAQWT24F`, with `SAQELIG=1`
- joint PSAQ+ESAQ weight: `PESAQWT24F` **only** for a future analysis that actually combines the two questionnaire families; it is not used here.

The full weight-specific design is constructed before cohort domain estimation. Raw rows are not pre-filtered to cases.

Software policy: `survey.lonely.psu="adjust"` and `survey.adjust.domain.lonely=TRUE`. Candidate artifacts record this choice. Intervals are 95% t intervals using survey design degrees of freedom.

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
