# MEPS 2024 linked-condition candidate estimator implementation

## Status

Issue #57 implements **candidate-only** survey-weighted U09-linked service-use estimators A–C. This implementation does not release estimates, define a reliability cutoff, create an ordinary `ArtifactBundle`, alter runtime/UI, or modify reviewed artifacts.

The governing scientific definitions remain:

- `docs/methods/meps-2024-linked-condition-feasibility-review.md`
- `docs/methods/meps-2024-linked-condition-candidate-contract.md`

The reviewed Phase-A linkage/reconciliation functions remain the source of truth. Candidate-specific code consumes `footprint$unique_u09_events` after exact-U09 selection, condition/person/event/family reconciliation, and distinct-encounter de-duplication.

## Person-level construction

`analysis/r/meps/linked_condition_service_use.R` adds candidate variables to the already collapsed HC-256 person frame:

- `do_u09_linked_event_n`
- `do_has_u09_linked_event`
- `do_u09_linked_office_event_n`
- `do_u09_linked_outpatient_event_n`
- `do_u09_linked_emergency_event_n`
- `do_u09_linked_inpatient_event_n`

The candidate helper preserves all original HC-256 columns and row order, uses explicit integer zero for persons without qualifying encounters, and requires person-by-person reconciliation of total counts to the four supported D/E/F/G family counts.

Event rows are never independent analytical observations.

## Survey estimation

The analytical sequence is:

```text
HC-256
→ governed operational-current Long-COVID construction
→ reviewed exact-U09 linkage/reconciliation
→ candidate person-level service-use attachment
→ full PERSON/PERWT24F design
→ governed target domain
→ Candidates A–C
```

The PERSON design retains the existing MEPS settings:

- PSU: `VARPSU`
- stratum: `VARSTR`
- weight: `PERWT24F`
- `nest=TRUE`
- `survey.lonely.psu="adjust"`
- `survey.adjust.domain.lonely=FALSE`

The full PERSON design supplies confidence-interval degrees of freedom. Candidate generation fails closed if governed target members would be silently excluded by missing design variables or if post-design target membership differs from `build_linked_condition_target()`.

### Candidate A

`u09_linked_service_use_person_share` is a survey-weighted proportion of governed target persons with at least one distinct reconciled exact-U09-linked D/E/F/G encounter.

The unweighted nonzero-person count is diagnostic support, not the survey estimate.

### Candidate B

`u09_linked_service_use_encounters_mean` is the survey-weighted mean number of qualifying annual encounters per governed target person.

All governed target persons without qualifying encounters remain explicit zeros. The denominator is not conditioned on U09 presence or event presence.

### Candidate C

Four family-specific person-level annual means are implemented:

- `u09_linked_service_use_office_encounters_mean`
- `u09_linked_service_use_outpatient_encounters_mean`
- `u09_linked_service_use_emergency_encounters_mean`
- `u09_linked_service_use_inpatient_encounters_mean`

All four use the same governed target denominator as Candidate B.

## Confidence intervals and support

Candidate A uses the existing bounded proportion-CI semantics. Candidates B/C retain the repository's ordinary symmetric t-CI convention for means; negative lower limits are not silently truncated.

Each candidate reports separately:

- target-person N and weighted denominator;
- nonzero-person N;
- observed qualifying event count;
- standard error and CI;
- full-design CI df/source;
- target represented strata/PSU support;
- nonzero-person represented strata/PSU support.

Nonzero support is a representation diagnostic only. No new survey design is constructed from the nonzero subset.

For an all-zero family such as the reviewed inpatient footprint, numerical output may be 0 with SE 0 and CI [0,0]. This is not evidence that the population quantity is known to be zero. Undefined RSE is serialized as `null`.

The emergency and inpatient candidates remain non-substantive pending later methods/reliability review.

## Precision governance state

Future candidate artifacts use candidate schema `2.0` and implement the independently reviewed rule `meps_hc_precision_v1` from [MEPS 2024 linked-condition reliability and precision governance](./meps-2024-linked-condition-reliability-governance.md).

Precision adjudication is applied only after the survey estimate and its design-based diagnostics are computed. Candidate records now separate:

- `computationally_valid`;
- `precision_status`;
- `precision_reason_codes`;
- `precision_reporting_status`;
- `precision_rule_version`;
- `product_release_eligible`.

The candidate manifest records `precision_rule_version="meps_hc_precision_v1"` and `precision_rule_reviewed=true`.

Statistical reportability does not authorize Diagnostic Odyssey product/runtime release. For all six candidates, `product_release_eligible=false` remains mandatory until a separate product/release review explicitly changes it.

The successful workflow-run `36521347390` artifact `11012682354` remains historical schema-`1.0` evidence produced by analytical SHA `7726a580b551dd35a27530beaf9ac847bbff9ace`; it is not rewritten or reinterpreted as schema `2.0`. After this implementation is merged, a new manually dispatched real-data candidate run on the new exact `main` SHA will be required to generate schema-`2.0` output for independent review.

Issue #57 therefore remains open pending merge/post-merge verification, a new schema-`2.0` real-data run, and independent review of that new artifact.

## Real-data reconciliation gates

The candidate runner fails closed unless the pinned-source calculation reproduces the reviewed Issue #20 findings:

- target n = 380;
- target persons with qualifying encounters = 22;
- target persons without qualifying encounters = 358;
- target unique qualifying encounters = 109;
- office/outpatient/emergency/inpatient events = 86/21/2/0;
- overall qualifying U09-linked events = 259;
- qualifying U09-linked events with at least one non-U09 condition link = 116;
- target represented strata = 99;
- target represented stratum×PSU pairs = 185;
- weighted target denominator reconciles to 6,831,165.1075 within an explicit 0.001 tolerance.

These are provenance/integrity regression gates, not release thresholds.

## Candidate-only artifact family

The real-data runner writes only aggregate review outputs:

- `linked-condition-candidate-estimates.json`
- `diagnostics.json`
- `candidate-manifest.json`
- `hc256-source-metadata.json`
- `linked-condition-source-metadata.json`

GitHub Actions adds:

- `github-actions-run-manifest.json`
- `SHA256SUMS`

A dedicated TypeScript validator checks candidate semantics. The ordinary runtime `ArtifactBundle` validator is not broadened, and no `bundle.json` is generated.

The manual workflow rejects raw/data-like output files and scans JSON for respondent/event identifier keys.

## Interpretation boundaries

Candidates A–C describe documented exact-U09-linked service-use footprints only.

They must not be interpreted as:

- Long-COVID prevalence;
- diagnostic recognition;
- referral;
- diagnostic delay;
- attributable utilization;
- spending attributable to Long COVID;
- causal treatment effects.

The governed current-Long-COVID status is anchored at the Round 3/1 point-in-time assessment, while D/E/F/G encounters span calendar year 2024 and may occur before or after that anchor. U09 is not equivalent to the governed target, no U09 does not imply no Long COVID, and no qualifying linked encounter does not imply no healthcare.

The reviewed multiplicity finding (116 of 259 qualifying U09-linked events also carry at least one non-U09 condition link) remains a central attribution guardrail.
