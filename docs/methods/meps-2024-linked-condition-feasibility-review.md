# MEPS 2024 linked-condition feasibility — real-data methods review

## Status

This document records the independent methods review of the first successful real-data linked-condition feasibility artifact for Issue #20.

It is **methods documentation only**. It does not implement an estimator, create a product `ArtifactBundle`, alter runtime, add UI, add spending attribution, change cohort definitions, change source pins, or promote any result to reviewed/released status.

The review object is GitHub Actions artifact:

- workflow: `MEPS 2024 Linked-Condition Feasibility`
- workflow run: `36374722748`
- exact code/main SHA: `7c2d6ebe9f6f583ede01d79c4dd7fde73f1dab76`
- artifact ID: `10949619481`
- artifact name: `meps-2024-linked-condition-feasibility-36374722748`
- GitHub artifact digest: `sha256:8a9e4d65e02b6afbe5944bcaa6ea91b857ef730877503716901dabe39a49ebe2`

The artifact contains only:

- `diagnostics.json`
- `feasibility-manifest.json`
- `linked-condition-source-metadata.json`
- `github-actions-run-manifest.json`
- `SHA256SUMS`

No respondent-level or event-level source data are part of the review object.

## Artifact integrity

All four JSON files validate against the supplied `SHA256SUMS`:

| File | SHA-256 |
| --- | --- |
| `diagnostics.json` | `896fa49cf1b8e04fc132dab885bc5f424b91b250f516b1311a17996f608b9628` |
| `feasibility-manifest.json` | `f57f53447c1e42c3ad5ec16e4b84d69cac427a6b79662e8dd5d869004641e58a` |
| `linked-condition-source-metadata.json` | `bedcde0ce81b36c35e4674b3a27ead5e61815e901ef51451fe1131ce7f596b9a` |
| `github-actions-run-manifest.json` | `31eb84d5164c42f63487475a8023defdb549bdb84e1b11a63df6159b378f034e` |

The GitHub Actions provenance records:

- repository: `Ianyliu/diagnostic-odyssey`
- `github_sha`: `7c2d6ebe9f6f583ede01d79c4dd7fde73f1dab76`
- `github_ref`: `refs/heads/main`
- `github_ref_name`: `main`
- workflow: `MEPS 2024 Linked-Condition Feasibility`
- workflow run ID: `36374722748`
- workflow run attempt: `1`
- phase: `feasibility-only`

## Source integrity

Source row counts from the reviewed diagnostics:

| Source | Rows |
| --- | ---: |
| HC-255 | 67,705 |
| HC-254I | 300,962 |
| HC-254G | 145,818 |
| HC-254F | 22,150 |
| HC-254E | 4,351 |
| HC-254D | 1,912 |
| HC-256 | 19,140 |

For all six new linked-condition sources (HC-255, HC-254I, HC-254G, HC-254F, HC-254E, HC-254D):

- archive SHA-256 match: `true`;
- extracted-DTA SHA-256 match: `true`;
- required-variable validation: `passed`.

The public PUF remains **HC-254I** and the governed analytical member is `h254if1.dta`.

## HC-255 / exact U09 diagnostics

- total HC-255 condition records: **67,705**
- exact-U09 condition records: **80**
- unique persons with exact U09: **79**
- duplicate U09-code/person patterns: **1**

These are condition-file diagnostics. They are **not Long-COVID prevalence**.

## HC-256 target-cohort overlap

The unchanged governed target is the HC-256 operational-current Long-COVID age-18–64 domain with positive person weight.

Observed real-data overlap:

- unweighted target n: **380**
- target persons with an exact HC-255 U09 condition: **26**
- target persons without an exact HC-255 U09 condition: **354**
- unique U09 persons overlapping the target: **26**

Absence of U09 is not evidence of absence of Long COVID.

## Condition-event linkage

- exact-U09 condition-event links across all event types: **334**
- Phase-A-supported U09 links: **259**
- reconciled U09 links: **259**
- supported-but-unreconciled U09 links: **0**
- unique qualifying U09-linked encounters overall: **259**
- target-cohort unique qualifying U09-linked encounters: **109**
- target persons with at least one qualifying U09-linked encounter: **22**
- target persons with zero qualifying U09-linked encounters: **358**

The qualifying footprint uses only reconciled exact-U09 links to supported D/E/F/G encounter families.

### Target event families

| Family | Target qualifying encounters |
| --- | ---: |
| Office | 86 |
| Outpatient | 21 |
| Emergency | 2 |
| Inpatient | 0 |

Home health and prescriptions are not included in these Phase-A family counts.

## Link quality

All reviewed link-quality counts are zero:

- unmatched `CONDIDX`: **0**
- `CONDIDX`/person mismatch: **0**
- unmatched `EVNTIDX`: **0**
- event-family mismatch: **0**
- duplicate `CLNKIDX`: **0**
- duplicate condition×event pair: **0**
- `CLNKIDX` composition mismatch: **0**
- unsupported `EVENTYPE`: **0**
- unsupported `EVENTYPE` values: **none**

## Multiplicity

Conditions per event:

- n: **241,174**
- min: **1**
- p25: **1**
- median: **1**
- p75: **1**
- max: **31**

Events per condition:

- n: **67,705**
- min: **1**
- p25: **1**
- median: **2**
- p75: **4**
- max: **320**

Additional multiplicity diagnostics:

- events with multiple condition links: **37,628**
- qualifying U09-linked events with at least one additional non-U09 condition link: **116**

Because **116 of 259** qualifying U09-linked events also carry at least one non-U09 condition link, an event linked to U09 cannot be treated as uniquely caused by Long COVID. Expenditure must not be assigned to U09 merely because the link exists, and no raw linked-spending estimator should be introduced.

## Survey feasibility for the full target domain

- target persons with positive `PERWT24F`: **380**
- target missing `VARSTR`: **0**
- target missing `VARPSU`: **0**
- unweighted target-person n: **380**
- weighted target denominator: **6,831,165.1075**
- represented strata: **99**
- represented stratum×PSU pairs: **185**

The weighted denominator is a design diagnostic from the artifact. This review does not convert any unweighted fraction into a new population estimate.

## Specialty/provider feasibility diagnostics

These numeric public-use code counts are retained as feasibility diagnostics only. They are not referral rates, recognition rates, or release-candidate estimands.

### Office — 86 qualifying target encounters

`MEDPTYPE_M18` counts:

| Code | Count |
| --- | ---: |
| -1 | 56 |
| 10 | 13 |
| 8 | 8 |
| 13 | 3 |
| 15 | 2 |
| 91 | 2 |
| -8 | 1 |
| 11 | 1 |

`DRSPLTY_M18` counts:

| Code | Count |
| --- | ---: |
| -1 | 30 |
| 6 | 20 |
| 28 | 13 |
| 16 | 9 |
| 1 | 3 |
| 91 | 3 |
| 22 | 2 |
| 3 | 2 |
| 8 | 2 |
| 14 | 1 |
| 29 | 1 |

### Outpatient — 21 qualifying target encounters

`MEDPTYPE_M18` counts:

| Code | Count |
| --- | ---: |
| -1 | 8 |
| 10 | 8 |
| 15 | 2 |
| 8 | 2 |
| 13 | 1 |

`DRSPLTY_M18` counts:

| Code | Count |
| --- | ---: |
| -1 | 13 |
| 8 | 4 |
| -8 | 1 |
| 1 | 1 |
| 21 | 1 |
| 28 | 1 |

### Why specialty/provider estimands are deferred

Do not promote specialty/provider composition to a release-candidate estimand yet because:

- there are only **86** target office and **21** target outpatient qualifying encounters;
- many numeric-code cells are sparse;
- the current review artifact exposes public-use codes, not a reviewed human-readable code-label interpretation contract;
- encounter-level composition is clustered within only **22** target persons who have qualifying events;
- linkage does not establish referral or diagnostic recognition.

A future pathway-composition task would require reviewed official code-label mapping, explicit person-level/survey-design semantics, pre-specified sparse-cell/reliability handling, and a clear non-referral/non-recognition interpretation.

## Feasibility manifest

The reviewed manifest states:

- status: `preliminary-feasibility-only`
- automatic release: `false`
- product estimates generated: `false`
- runtime selection changed: `false`
- reviewed artifact modified: `false`
- bundle generated: `false`
- spending estimator present: `false`
- HC-256 cohort definition reused: `true`
- review required: `true`

## Methods conclusions

### A. Technical linkage feasibility

**SUPPORTED.**

Reason:

- official source integrity passed;
- condition↔event linkage reconciles cleanly;
- de-duplication rules work;
- person-level collapse works;
- survey-design variables are present for the target cohort.

### B. Narrow service-use feasibility

**SUPPORTED FOR FURTHER CANDIDATE-ESTIMATOR DEVELOPMENT.**

The linked files provide a defensible descriptive footprint of healthcare encounters that carry an exact U09 condition link. This is useful information beyond HC-256 alone.

This conclusion supports later methods development only; it is not release approval.

### C. Recognition/referral pathway inference

**NOT SUPPORTED BY THE CURRENT DATA/LINKAGE ALONE.**

A U09-linked event does not establish:

- reason for encounter;
- diagnostic recognition sensitivity;
- referral;
- causal treatment pathway;
- diagnostic delay;
- attributable utilization.

## Interpretation boundary

The reviewed real-data structure supports a narrow descriptive service-use footprint. It does **not** support treating U09 linkage as prevalence, attribution, recognition, referral, diagnostic-delay, causal-treatment, savings, or ROI evidence.

Candidate methods estimands for a later implementation task are documented separately in [MEPS 2024 linked-condition candidate contract](./meps-2024-linked-condition-candidate-contract.md).

## Governance

Issue #20 remains open. This documentation does not mark the final feasibility/candidate-contract work complete and does not authorize estimator implementation, candidate-artifact generation, runtime admission, or UI integration.
