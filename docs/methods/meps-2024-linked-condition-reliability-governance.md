# MEPS 2024 linked-condition reliability and precision governance

## Status

This document freezes the governed sampling-precision and statistical-reportability specification for Issue #57.

It is **methods/governance documentation only**. It does not change candidate estimates, estimator definitions, survey-design/domain semantics, source pins, Issue #20 linkage/reconciliation semantics, runtime/UI, reviewed/released artifacts, or product release state.

This document is a companion to:

- [MEPS 2024 linked-condition candidate methods contract](./meps-2024-linked-condition-candidate-contract.md)
- [MEPS 2024 linked-condition candidate estimator implementation](./meps-2024-linked-condition-candidate-implementation.md)

Reviewed evidence object:

- workflow run: `36521347390`
- exact analytical SHA: `7726a580b551dd35a27530beaf9ac847bbff9ace`
- artifact ID: `11012682354`
- artifact digest: `sha256:7793d7bfb1d6717758ef26795eb45782ff4d8384395840552674dbaecfd59230`

Governed rule version for later implementation:

`meps_hc_precision_v1`

The controlling sampling-precision/reportability standard is the AHRQ **Precision Standards Guidelines for Reporting MEPS-HC Descriptive Statistics**. AHRQ MEPS event/domain methodology governs the survey-design interpretation. NCHS guidance is retained only as secondary methodological context where MEPS is silent and does not override a directly applicable MEPS-HC rule.

## Governance concepts

Four concepts remain separate.

### A. `computationally_valid`

Whether the governed estimator successfully computed using the intended person-level estimand, full PERSON survey design, target-domain estimation, required provenance, required reconciliation gates, and candidate artifact contract.

Computational validity does not establish sampling precision and does not authorize product release.

### B. `precision_status`

Allowed values:

- `meps_precise`
- `meps_questionable_precision`
- `meps_low_percentage_exception`
- `meps_unstable_precision`
- `insufficient_sample`
- `unsupported_zero`
- `review_required`

This field represents governed sampling-precision/methods adjudication.

### C. `precision_reporting_status`

Allowed values:

- `reportable`
- `reportable_with_caution`
- `suppress_precision`
- `suppress_insufficient_sample`
- `suppress_unsupported_zero`
- `suppress_pending_review`

This field describes statistical reportability under the governed precision rule. It is **not** a Diagnostic Odyssey runtime/product release decision.

### D. `product_release_eligible`

This is a separate project-level gate.

Passing the MEPS-HC precision rule is necessary statistical evidence but is **not sufficient** for Diagnostic Odyssey runtime or product release.

At this stage, for all six Issue #57 candidates:

`product_release_eligible = false`

## Controlling AHRQ MEPS-HC precision standard

### Continuous estimates

For means, totals, or ratios:

1. governed subgroup `n >= 60`;
2. for a nonzero estimate with defined RSE:
   - `RSE < 0.30` -> `meps_precise`;
   - `0.30 <= RSE <= 0.50` -> `meps_questionable_precision`;
   - `RSE > 0.50` -> `meps_unstable_precision`.

Corresponding precision-reporting states:

- `meps_precise` -> `reportable`;
- `meps_questionable_precision` -> `reportable_with_caution`;
- `meps_unstable_precision` -> `suppress_precision`.

These thresholds are AHRQ/MEPS-HC rules, not project-created thresholds.

### Percentage estimates

For percentages:

1. `n` is the unweighted denominator sample size;
2. denominator `n >= 60`;
3. for defined RSE:
   - `RSE < 0.30` -> `meps_precise`;
   - `0.30 <= RSE <= 0.50` -> `meps_questionable_precision`;
   - `RSE > 0.50` and the upper 95% CI bound is `<= 0.10` -> `meps_low_percentage_exception`;
   - otherwise, `RSE > 0.50` -> `meps_unstable_precision`.

Corresponding precision-reporting states:

- `meps_precise` -> `reportable`;
- `meps_questionable_precision` -> `reportable_with_caution`;
- `meps_low_percentage_exception` -> `reportable_with_caution`;
- `meps_unstable_precision` -> `suppress_precision`.

The low-percentage exception is an AHRQ/MEPS-HC reporting rule, not a project-created exception.

## Issue #57 sample-size semantics

The sampled/statistical unit for Candidates A-C is the **person**.

### Candidate A

`u09_linked_service_use_person_share` is a percentage/proportion.

Its MEPS percentage denominator sample size is:

`n = 380`

The 22 target persons with at least one qualifying exact-U09-linked encounter are the numerator/nonzero-person diagnostic. They are not substituted for the MEPS denominator sample-size rule.

### Candidates B/C

Candidate B and all Candidate C family estimates are survey-weighted annual encounter-count means **per governed target person**.

Target persons with no qualifying encounter remain in the estimand with explicit zero.

Therefore the governed MEPS subgroup sample size is:

`n = 380`

The positive-person counts:

- all encounters: 22
- office: 17
- outpatient: 7
- emergency: 2
- inpatient: 0

are nonzero-support diagnostics and are **not** substituted for the `n >= 60` rule.

Observed encounter counts are reconciliation/support diagnostics, not independent survey observations.

## Domain and variance governance

The full HC-256 PERSON survey design is constructed **before** target-domain estimation.

For the reviewed artifact:

- governed target n: `380`
- weighted target denominator: `6,831,165.107549`
- target represented strata: `99`
- target represented stratum x PSU pairs: `185`
- full PERSON design degrees of freedom: `159`
- true full-design singleton strata: `0`

AHRQ MEPS Methodology Report 26 provides the governing rationale for full-design/domain variance estimation.

Target-domain or nonzero-support strata that contain one represented PSU are not reclassified as true singleton strata in the full sampling design.

No project-created numeric threshold is introduced for:

- target represented strata;
- target represented PSU support;
- nonzero represented strata;
- nonzero represented PSU support;
- represented-singleton diagnostics.

Nonzero support is not treated as a separate survey design.

## Project-specific zero-support policy

MEPS-HC does not provide an explicit rule for the all-zero/undefined-RSE state used here.

Diagnostic Odyssey therefore adopts the following intentionally conservative **PROJECT-SPECIFIC** status:

`unsupported_zero`

Apply it when all are true:

- `estimate == 0`
- `standard_error == 0`
- `relative_standard_error == null`
- `unweighted_nonzero_person_n == 0`
- `observed_qualifying_event_n == 0`

Then:

- `precision_status = unsupported_zero`
- `precision_reporting_status = suppress_unsupported_zero`

Meaning:

- retain the computational result in methods/review artifacts;
- do not interpret the numerical zero as a known population zero;
- suppress population numeric product display;
- do not impute RSE as zero, infinity, or another sentinel.

This policy is project-specific and must not be represented as an AHRQ threshold.

## Future-proof precision reason codes

Reliability problems need not be mutually exclusive.

A later deterministic implementation should preserve machine-readable reason codes in addition to the primary precision status.

Suggested field:

`precision_reason_codes`

Initial governed reason-code vocabulary:

- `sample_n_below_60`
- `rse_30_to_50`
- `rse_above_50`
- `low_percentage_exception`
- `zero_positive_support`
- `precision_input_invalid`

This preserves information in a future case that may, for example, have both `n < 60` and zero positive support.

These reason codes do not introduce any new numeric threshold and do not change the frozen six Issue #57 classifications.

## Insufficient-sample and unresolved states

If the applicable governed MEPS subgroup/denominator sample size is below 60:

- `precision_status = insufficient_sample`
- `precision_reporting_status = suppress_insufficient_sample`
- include reason code `sample_n_below_60`.

If a nonzero estimate has missing, nonfinite, or internally inconsistent precision inputs that prevent application of this specification:

- `precision_status = review_required`
- `precision_reporting_status = suppress_pending_review`
- include reason code `precision_input_invalid`.

These states are fail-closed.

## Frozen six candidate outcomes

The following precision classifications are frozen against the successful candidate artifact from workflow run `36521347390`.

| Candidate | Governing precision basis | `precision_status` | `precision_reporting_status` | `product_release_eligible` |
| --- | --- | --- | --- | --- |
| `u09_linked_service_use_person_share` | n=380; RSE=0.2378791541 | `meps_precise` | `reportable` | `false` |
| `u09_linked_service_use_encounters_mean` | n=380; RSE=0.3405836420 | `meps_questionable_precision` | `reportable_with_caution` | `false` |
| `u09_linked_service_use_office_encounters_mean` | n=380; RSE=0.3529287009 | `meps_questionable_precision` | `reportable_with_caution` | `false` |
| `u09_linked_service_use_outpatient_encounters_mean` | n=380; RSE=0.5677337040 | `meps_unstable_precision` | `suppress_precision` | `false` |
| `u09_linked_service_use_emergency_encounters_mean` | n=380; RSE=0.8145904811 | `meps_unstable_precision` | `suppress_precision` | `false` |
| `u09_linked_service_use_inpatient_encounters_mean` | estimate=0; SE=0; RSE=null; nonzero persons=0; events=0 | `unsupported_zero` | `suppress_unsupported_zero` | `false` |

All six candidate computations are valid under the reviewed analytical workflow.

Statistical reportability does not alter their construct interpretation or authorize product release.

## Negative-confidence-interval policy

Retain the original symmetric design-based confidence intervals in methods/review artifacts.

For Candidate B/C count means:

- do not silently truncate negative lower confidence limits;
- a negative lower limit is not itself a computational failure;
- no new negative-CI suppression threshold is introduced;
- outpatient and emergency already fail the controlling MEPS RSE rule;
- any future interval-method or product-presentation change requires separate methods review.

## Precision status does not authorize product release

AHRQ MEPS-HC precision/reportability is a statistical quality standard.

It does not itself determine whether Diagnostic Odyssey should expose an estimate in runtime or UI.

Therefore even:

- `meps_precise`
- `meps_questionable_precision`
- `meps_low_percentage_exception`

must not automatically set:

`product_release_eligible = true`

At this stage:

`product_release_eligible = false`

for all six candidates.

## Construct and product-release gates that remain unresolved

A later product/runtime decision must separately preserve and review all of the following.

### Construct identity

- exact U09 is not equivalent to the governed operational-current Long-COVID target;
- absence of exact U09 does not imply absence of Long COVID;
- absence of a qualifying U09-linked encounter does not imply absence of healthcare.

### Temporal alignment

The governed current-status target is anchored at the Round 3/1 point-in-time assessment.

The linked D/E/F/G encounters span calendar year 2024 and may occur before or after that anchor.

The candidates therefore do not establish a temporally ordered recognition, diagnosis, referral, or treatment pathway.

### Attribution

A qualifying U09-linked encounter is not necessarily caused by Long COVID.

The reviewed linkage evidence found `116 / 259` qualifying U09-linked events also carrying at least one non-U09 condition link.

Therefore no candidate may be interpreted as attributable utilization or spending.

### Prohibited downstream inference

Precision status does not authorize inference about:

- Long-COVID prevalence;
- recognition;
- referral;
- diagnostic delay;
- attributable utilization;
- attributable spending;
- causal effect;
- treatment effectiveness;
- savings;
- return on investment.

### Product comprehension

Any later runtime/UI decision must independently review:

- user-facing terminology and labeling;
- precision-warning presentation;
- construct disclaimers;
- risk of interpreting U09-linked utilization as disease-attributable utilization;
- risk of interpreting statistical precision as construct validity.

Precision does not establish construct validity.

## Secondary NCHS context

NCHS guidance is retained only as secondary/sensitivity context and does not override directly applicable AHRQ MEPS-HC guidance.

In particular:

- do not replace the MEPS 30-50% flagged-reporting rule for means with NCHS terminology that labels RSE >=30% unreliable;
- do not import NCHS rate/count `n >= 10` thresholds into these person-level MEPS means;
- do not import the NCHS 160%-relative-CI-width threshold into these means;
- an NCHS-style effective-sample-size/Korn-Graubard sensitivity analysis for Candidate A remains optional future work.

No NCHS-derived threshold is part of `meps_hc_precision_v1`.

## Rule precedence for later implementation

A future implementation should apply this rule deterministically while preserving all applicable `precision_reason_codes`.

1. Validate computational/design/provenance state.
   - If invalid or required precision inputs are inconsistent:
     - `computationally_valid = false`
     - `precision_status = review_required`
     - `precision_reporting_status = suppress_pending_review`
     - add `precision_input_invalid`.

2. Identify zero-positive support.
   - If estimate=0, SE=0, RSE=null, nonzero persons=0, and event count=0:
     - `precision_status = unsupported_zero`
     - `precision_reporting_status = suppress_unsupported_zero`
     - add `zero_positive_support`.
   - Continue retaining any other applicable reason codes rather than assuming failure reasons are mutually exclusive.

3. Evaluate the MEPS sample-size requirement.
   - If applicable governed subgroup/denominator `n < 60`:
     - add `sample_n_below_60`;
     - if no higher-priority unsupported/invalid state applies, use:
       - `precision_status = insufficient_sample`
       - `precision_reporting_status = suppress_insufficient_sample`.

4. For percentages, apply the frozen MEPS-HC categorical RSE/CI rule.
   - add `rse_30_to_50`, `rse_above_50`, or `low_percentage_exception` as applicable.

5. For means/totals/ratios, apply the frozen MEPS-HC continuous RSE rule.
   - add `rse_30_to_50` or `rse_above_50` as applicable.

6. Leave `product_release_eligible = false` unless and until a separate Diagnostic Odyssey product/release review explicitly changes it.

The rule must be applied uniformly and must not be tuned candidate by candidate.

## Sources

### Primary controlling sources

AHRQ, Medical Expenditure Panel Survey:

- Precision Standards Guidelines for Reporting MEPS-HC Descriptive Statistics:  
  https://meps.ahrq.gov/survey_comp/precision_guidelines.shtml
- Methodology Report No. 26, Variance Estimation from MEPS Event Files:  
  https://meps.ahrq.gov/data_files/publications/mr26/mr26.shtml

### Secondary context

National Center for Health Statistics:

- Statistical reliability of estimates:  
  https://www.cdc.gov/nchs/hus/sources-definitions/statistical-reliability.htm
- NHANES tutorial, Reliability of Estimates:  
  https://wwwn.cdc.gov/nchs/nhanes/tutorials/reliabilityofestimates.aspx

## Governance conclusion

The Issue #57 sampling-precision rule is now specified as `meps_hc_precision_v1` for later deterministic implementation.

Frozen statistical outcomes:

- Candidate A: `meps_precise` / `reportable`
- Candidate B: `meps_questionable_precision` / `reportable_with_caution`
- Office: `meps_questionable_precision` / `reportable_with_caution`
- Outpatient: `meps_unstable_precision` / `suppress_precision`
- Emergency: `meps_unstable_precision` / `suppress_precision`
- Inpatient: `unsupported_zero` / `suppress_unsupported_zero`

For all six:

`product_release_eligible = false`

This specification freezes statistical precision governance only. It does not authorize runtime admission, UI display, reviewed/released ArtifactBundle promotion, specialty/provider interpretation, spending attribution, causal interpretation, savings, or ROI inference.
