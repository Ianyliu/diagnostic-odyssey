# Product and scientific guardrails

These rules are implementation requirements, not optional copy guidance.

## Burden semantics

### Gross burden is not attributable burden
Observed all-cause spending/utilization in a represented population may be shown as gross burden. It must not be relabeled as illness-attributable, diagnostic-delay-caused, preventable, or avoidable without a separately validated design.

### Nested spending is not additive
Out-of-pocket and payer components may be parts of a total. The UI and analysis must not re-add nested components to total spending.

### Native units stay separate
Visit time, paperwork time, bills/insurance time, travel friction, work friction, PHQ-2, K6, spending, and utilization are heterogeneous constructs. They must not be combined into an opaque burden score.

## National versus local

National burden evidence and local implementation context are separate layers. HRSA/ACS/PLACES/CMS context can describe implementation constraints but does not automatically modify national disease burden.

A county/state selector must never imply a local Long COVID prevalence or dollar estimate unless a validated small-area model is explicitly introduced later.

Missing designation is not equivalent to “no shortage.”

## Mental-health/human burden

PHQ-2 and K6 are screening/distress measures, not psychiatric diagnoses. Do not monetize them, combine them into a psychiatric score, or claim diagnostic delay caused observed distress.

Approved qualitative themes may describe recognition/navigation experience but are not prevalence estimates and must not contain invented quotations.

## Scenario semantics

Scenario inputs are planning assumptions unless explicitly source-backed.

The deterministic engine may calculate:
- intended reach;
- reached participants;
- capacity gap;
- baseline and alternative unresolved-recognition person-month exposure;
- difference in person-month exposure;
- fixed and variable program-resource requirement.

These outputs are not:
- savings;
- ROI;
- causal benefit;
- observed improvement;
- guaranteed effect.

Any evidence-informed bounded parameter may affect only the named `target_pathway_step` and `target_mechanism` for which admissibility passed.

## Release and display gates

`release_status` is scientific/methods status.

Allowed values:
- `preliminary`
- `reviewed_released`
- `not_released`
- `suppressed`
- `unavailable`

`display_status` distinguishes:
- `illustrative`
- `analytical_artifact`

Illustrative Figma values are never promoted to analytical truth.

Unreleased/suppressed values must not appear in:
- charts;
- tooltips;
- Planning Brief content;
- JSON/HTML/PDF exports.

Missing/suppressed is never rendered as numeric zero.

## Evidence admissibility

Allowed states:
- `supported`
- `supported_with_bounds`
- `limited_use`
- `insufficient`

External evidence may drive a scenario parameter only when:
1. reviewer status is approved;
2. admissibility allows quantitative use;
3. population/outcome/geography/payer applicability has been considered;
4. the record names the relevant pathway step;
5. the record names the target mechanism.

An LLM can propose fields but cannot assign final reviewer/admissibility status.

## Provenance

Every released headline estimate must be traceable to:
- source;
- locator/year;
- population;
- denominator/universe;
- model or transform;
- system/pathway boundary;
- limitations;
- artifact version/run identifier.

Every export must carry enough metadata that a detached screenshot/file can still be interpreted safely.

## Graceful degradation

Supported data states:
- loading;
- loaded;
- partial;
- empty;
- suppressed;
- error;
- stale_fallback;
- unsupported_combination.

An unavailable domain must not block valid domains or the Planning Brief.

## Privacy and interoperability

The sprint product stores no patient-submitted PHI and needs no authentication for the main read-only policy workflow.

Do not claim HIPAA compliance or FHIR conformance. Future interoperability mapping may reference Condition, Encounter, Observation, Coverage, Claim/ExplanationOfBenefit, and Provenance only as a reuse note.
