# MEPS 2024 linked-condition feasibility — Phase A

## Status

This is a **feasibility-only** methods layer for Issue #20. It produces no product estimate, no `ArtifactBundle`, no spending estimator, no UI, and no runtime change.

The governing question is:

> Within the existing HC-256 operational-current Long-COVID cohort, what reported/coded U09-linked healthcare-event footprint is observable in the 2024 MEPS condition/event files?

It is not a Long COVID prevalence, attributable-utilization, attributable-spending, diagnostic-delay, referral, recognition-sensitivity, or treatment-effect analysis.

## Source graph

Phase A uses:

- HC-256 — 2024 Full Year Consolidated, for the already-governed operational-current Long-COVID cohort and person-level survey design.
- HC-255 — 2024 Medical Conditions.
- HC-254I — 2024 Condition-Event Link.
- HC-254G — office-based visits.
- HC-254F — outpatient visits.
- HC-254E — emergency-room visits.
- HC-254D — inpatient stays.

Home health (HC-254H) and prescribed medicines (HC-254A) are deliberately excluded from the initial encounter denominator because their analytical units/linkage semantics differ.

The linkage graph is:

```
HC-256 person (DUPERSID)
        |
        +---- HC-255 condition (CONDIDX; ICD10CDX)
                    |
                    +---- HC-254I condition-event link
                              | CONDIDX
                              | EVNTIDX
                              | CLNKIDX
                              | EVENTYPE
                              |
                              +---- HC-254D/E/F/G event (DUPERSID + EVNTIDX)
```

## U09 rule

Phase A selects **exactly `ICD10CDX == "U09"`** after validating the public ICD-10-CM field.

- U07 is never substituted or broadened into the definition.
- U09 is a separate reported/coded condition marker.
- U09 does not redefine or replace the HC-256 operational-current Long-COVID cohort.
- The published HC-255 marginal count of U09 records is not the target-cohort overlap and is not prevalence.

## HC-256 cohort reuse

The implementation calls the existing `construct_long_covid_cohort()` and `cohort_definition_text()` functions unchanged. The target cohort therefore remains governed by the current HC-256 Round 3/1 definition.

U09 condition presence and qualifying event presence are derived separately. Exact U09 condition counts are collapsed to one row per `DUPERSID` even when no Phase-A encounter link reconciles. Reconciled linked-event counts are then added to that same person table before it is joined back to HC-256. A person can therefore have `do_has_u09_condition == TRUE` while `do_has_u09_linked_event == FALSE`.

No event row or condition-event row is treated as an independently sampled person.

## Linkage invariants

The reusable validation layer checks:

- one HC-255 record per `CONDIDX`;
- `CONDIDX` person consistency;
- uniqueness of `CLNKIDX`;
- uniqueness of `CONDIDX × EVNTIDX`;
- exact `CLNKIDX = CONDIDX + EVNTIDX` composition;
- event/person reconciliation to HC-254D/E/F/G;
- supported Phase-A `EVENTYPE` values 1–4;
- excluded home-health/prescription types 7 and 8;
- unmatched conditions/events;
- person mismatches;
- event-family mismatches.

A **qualifying U09-linked event** must pass every reconciliation rule: the link resolves to an exact-U09 HC-255 condition; the condition and link have the same `DUPERSID`; `EVENTYPE` is 1–4; the link's `DUPERSID × EVNTIDX` exists in the corresponding D/E/F/G event index; and the event-file family agrees with `EVENTYPE`. Supported links that fail any reconciliation rule remain visible in link-quality diagnostics but cannot enter qualifying event totals, person event counts, event-family counts, or specialty/provider diagnostics.

The 2024 HC-254I EVENTYPE mapping used in Phase A is:

| EVENTYPE | family |
| --- | --- |
| 1 | office |
| 2 | outpatient |
| 3 | emergency |
| 4 | inpatient |

## De-duplication

- A condition-event link is identified by unique `CLNKIDX` / `CONDIDX × EVNTIDX`.
- A healthcare encounter is a unique `DUPERSID × EVNTIDX`.
- A qualifying U09 encounter is counted once only after the U09 condition/person/event/family reconciliation rules pass.
- Multiple exact-U09 condition records may point to the same valid encounter without multiplying the encounter count.
- Additional non-U09 conditions attached to that same event do not increase the U09 encounter count.
- Per-person linked-event count is the number of distinct qualifying `EVNTIDX` values.
- No expenditure is summed across CLNK rows.
- No expenditure is allocated across diagnoses.
- Phase A contains no spending estimator.

## Diagnostics

The eventual manual workflow writes aggregate diagnostics/provenance only. The intended diagnostics include:

- source identities, hashes, required-variable validation, and row counts;
- total HC-255 condition records, U09 condition records, unique U09 persons, and duplicate U09 patterns;
- HC-256 target cohort size and U09 overlap;
- exact-U09 condition-event links across all event types, Phase-A-supported U09 links (EVENTYPE 1–4), successfully reconciled U09 links, supported-but-unreconciled links, unique qualifying events, event-family counts, and target persons with/without qualifying events;
- conditions per event and events per condition;
- events carrying multiple conditions and U09 events carrying additional non-U09 conditions;
- unmatched identifiers, person inconsistencies, unsupported event types, duplicate link IDs, duplicate condition-event pairs, and CLNKIDX composition failures;
- target person-weight / VARSTR / VARPSU completeness and represented strata/PSU support;
- office/outpatient provider/specialty cell counts when the fields are available.

These are internal methods-review diagnostics, not released estimates.

The link-count stages are intentionally distinct:

- **all-event-type U09 links**: HC-254I rows whose `CONDIDX` resolves to exact U09, including excluded Rx/home-health or unsupported event types;
- **supported U09 links**: exact-U09 links whose `EVENTYPE` is one of the initial Phase-A families 1–4, before person/event reconciliation;
- **reconciled U09 links**: supported links that also pass condition-person, event existence/person, and EVENTYPE↔event-family reconciliation;
- **unique U09-linked events**: distinct `DUPERSID × EVNTIDX` encounters derived only from reconciled U09 links.

This separation ensures bad/unmatched links remain visible as feasibility findings without contaminating the qualifying event footprint.

## Source-integrity gate

The new source registry is `analysis/r/config/meps_linked_condition_sources.json`.

The registry contains exact official AHRQ pages, documentation locators, archive URLs, expected filenames, and required-variable contracts. At initial PR construction, this execution environment could not independently retrieve the official archive bytes. Therefore the new archive/data SHA-256 fields are intentionally unpinned rather than guessed.

`assert_linked_condition_source_pins()` fails closed until all exact official archive and extracted-Stata hashes have been independently verified and deliberately pinned. The manual workflow must not be dispatched before that source-pin review is complete.

This is intentional scientific governance: a hash must never be changed merely to make a workflow pass.

## Interpretation boundaries

Phase A encodes these rules:

- HC-255 U09 frequency is not Long COVID prevalence.
- A U09-linked event is not an event caused by Long COVID.
- No U09 link does not mean no Long COVID.
- No U09 link does not mean no healthcare.
- U09 is not equivalent to the HC-256 operational-current Long COVID definition.
- CLNK rows are not encounter counts.
- Linked expenditure cannot be naively summed.
- No diagnostic-delay, referral, or provider-recognition-rate claim is supported.
- Annual events can occur before or after the point-in-time HC-256 current-status anchor.
- Rx and home health are excluded from the initial encounter denominator.
- Event information must collapse to person level before later target-domain survey estimation.

## Phase A decision gate

Phase A itself makes no release decision and invents no minimum-n threshold.

After the source hashes have been independently pinned, the separate manual **MEPS 2024 Linked-Condition Feasibility** workflow may be dispatched for real-data diagnostics. Those diagnostics must receive an independent methods review before any estimator, candidate artifact, runtime integration, or UI work begins.
