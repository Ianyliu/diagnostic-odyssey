# MEPS 2024 linked-condition product policy v1

## Status

This document records the reviewed product-governance decision for the separate
MEPS 2024 exact-U09-linked service-use evidence family.

Product policy version:

`linked_condition_product_policy_v1`

Reviewed artifact version:

`meps-2024-linked-condition-service-use-reviewed-20260929-v1`

This is **PR 1 governance/reviewed-artifact scope only**. Runtime selection
remains inactive. No UI, Planning Brief, Pilot, Evidence-page, Overview, route,
navigation, or DecisionStateRail behavior is changed here.

## Upstream reviewed candidate

The reviewed package is derived without statistical recomputation from:

- workflow: `MEPS 2024 Linked-Condition Candidate`;
- run: `36609436930`;
- artifact ID: `11053325408`;
- artifact digest:
  `sha256:48aadea0db4e1c0bb6a2191286f0481dd256279f5ee020037aa15d2a2909296a`;
- analytical SHA:
  `2a0309d1d29e623aac0d285fe49cf99717a3c777`;
- candidate schema: `2.0`;
- precision rule: `meps_hc_precision_v1`.

The historical candidate records retain `product_release_eligible=false`.
Product-policy admission is a separate reviewed decision and does not rewrite
that historical field.

## Separate reviewed artifact family

The durable package lives at:

`artifacts/reviewed/meps-2024-linked-condition-service-use-reviewed-20260929-v1/`

It is intentionally separate from the ordinary national burden
`ArtifactBundle` and from local-context artifacts.

The package contains only aggregate reviewed material:

- `linked-condition-candidate-estimates.json`;
- `candidate-manifest.json`;
- `reviewed-diagnostics.json`;
- `source-metadata.json`;
- `github-actions-run-manifest.json`;
- `review-manifest.json`;
- `product-policy.json`;
- `SHA256SUMS`.

The reviewed candidate records are a semantic JSON reserialization of the
reviewed schema-v2 candidate values. Automated invariance tests freeze every
governed numerical/precision field against run `36609436930`. Promotion does
not rerun the estimator or generate new statistics.

`promotion_commit` is deliberately `null` inside the checksummed review
manifest because a file cannot safely contain the SHA of the commit that
contains and hashes that same file. The containing Git commit is the external
immutable promotion provenance; the manifest records that convention
explicitly.

## Product-policy states

The frozen v1 assignments are:

| Candidate | Product-policy state |
| --- | --- |
| `u09_linked_service_use_person_share` | `admitted_secondary_descriptive` |
| `u09_linked_service_use_encounters_mean` | `reviewed_not_product_admitted` |
| `u09_linked_service_use_office_encounters_mean` | `reviewed_not_product_admitted` |
| `u09_linked_service_use_outpatient_encounters_mean` | `suppressed_precision` |
| `u09_linked_service_use_emergency_encounters_mean` | `suppressed_precision` |
| `u09_linked_service_use_inpatient_encounters_mean` | `suppressed_unsupported_zero` |

These product states do not replace or reinterpret `precision_status`,
`precision_reporting_status`, or historical candidate
`product_release_eligible=false`.

Candidate B and Office remain review/methods evidence and are not authorized for
numeric runtime display in product v1. Outpatient, Emergency, and Inpatient
remain explicitly suppressed rather than being deleted from the reviewed
scientific record.

## Candidate A product metadata

Candidate A is approved at the product-policy layer only as secondary
descriptive documentation-linked evidence.

Section heading:

`Documented U09-linked service-use footprint`

Measure label:

`Share with at least one 2024 encounter linked in MEPS to an exact U09 condition record`

Always-visible explanation:

`This is not the share diagnosed or recognized with Long COVID and does not measure Long-COVID-attributable healthcare use.`

The product policy also freezes the technical limitations that exact U09 is not
the governed operational-current Long COVID definition, absence of U09 is not
absence of Long COVID, absence of a qualifying linked encounter is not absence
of healthcare, calendar-year events may precede or follow the Round 3/1 status
anchor, condition-event linkage is not causation, and 116 of 259 qualifying
U09-linked events also carried at least one non-U09 condition link.

Candidate A is **not** an ordinary national burden `Estimate` and is not added
to `burden_domains`, `Estimate[]`, `canExportEstimate`, the active
`ArtifactProvider`, or Planning Brief inputs.

## Runtime remains inactive

Both `review-manifest.json` and `product-policy.json` require
`runtime_selected=false`.

The fail-closed contracts reject:

- unknown reviewed artifact or product-policy versions;
- unknown precision rule versions;
- missing, duplicate, unknown, or extra governed candidates;
- policy-state changes, including admission of B/Office or unsuppression of the
  three suppressed candidates;
- Candidate A wording drift;
- candidate numerical or precision drift;
- Issue #20 reconciliation drift;
- source-checksum drift;
- missing reviewed provenance;
- forbidden respondent/event identifiers;
- arbitrary row-level object arrays;
- runtime selection in this PR-1 package.

CI also verifies the package `SHA256SUMS`.

## Runtime/UI follow-up

A separate PR 2 is required before any active runtime selection or user-facing
rendering. PR 2 may consume this reviewed package only through a specialized
linked-condition loader and product-policy gate.

The intended future location for Candidate A is a secondary section on
`/burden/medical`, but PR 1 does not implement that component.

Candidate A remains excluded from:

- Planning Brief export;
- Overview;
- DecisionStateRail;
- Pilot/scenario integration;
- the intervention Evidence workflow.

## Scientific non-goals

This policy does not authorize Long-COVID prevalence, diagnosis/recognition or
referral rates, diagnostic-delay inference, disease-attributable utilization,
U09-linked spending attribution, provider/specialty composition, causal
effects, treatment effectiveness, savings, ROI, local/state extrapolation,
scenario calibration, complete care-setting decomposition, or new estimator
methodology.
