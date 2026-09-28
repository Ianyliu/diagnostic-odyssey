# MEPS 2024 linked-condition candidate methods contract

## Status

This document defines **candidate methods estimands for a later implementation task** based on the reviewed real-data feasibility artifact from workflow run `36374722748`.

It does **not** implement an estimator, create a candidate `ArtifactBundle`, change runtime, add UI, change source pins, alter the governed HC-256 cohort, or grant release approval.

The supporting feasibility review is documented in [MEPS 2024 linked-condition feasibility — real-data methods review](./meps-2024-linked-condition-feasibility-review.md).

## Shared universe and survey-design contract

All candidate estimands below use the existing unchanged HC-256 operational-current Long-COVID target:

- age 18–64 using the governed Round 3/1 age anchor;
- positive `PERWT24F`;
- the existing unchanged current-Long-COVID definition.

The full governed HC-256 person survey design must be constructed before treating the target as a domain.

Candidate person-level linked-event variables must be derived from distinct reconciled exact-U09-linked HC-254D/E/F/G encounters and then attached to the HC-256 person frame.

Target persons with no qualifying linked encounter remain in the universe with value **0**.

Encounter rows must not be treated as independent sampled observations.

## Temporal alignment

The governed HC-256 target classification is anchored to the **Round 3/1 point-in-time current-Long-COVID assessment**. Candidates A–C summarize reconciled exact-U09-linked HC-254D/E/F/G encounters observed across the **2024 annual event files**.

Those annual encounters can occur **before or after** the Round 3/1 current-status anchor. Candidates A–C therefore represent annual documented U09-linked service-use footprints among persons classified in the governed target at that anchor.

They must **not** be interpreted as utilization occurring specifically:

- after Long-COVID recognition;
- after diagnosis;
- after referral;
- while current Long COVID was contemporaneously present;
- or as a temporally ordered disease/treatment pathway.

## Candidate A — person share with documented U09-linked service use

Working name:

`u09_linked_service_use_person_share`

### Person-level variable

Indicator equal to:

- **1** if the target person has at least one **distinct reconciled exact-U09-linked** HC-254D/E/F/G encounter during 2024;
- **0** otherwise.

### Candidate estimate

Survey-weighted proportion using the **full governed HC-256 person survey design**, with the target treated as a domain.

### Interpretation

Proportion of the governed target population with a documented U09-linked D/E/F/G service-use footprint.

### Explicitly not

This candidate is not:

- Long-COVID prevalence;
- diagnostic recognition rate;
- diagnostic rate;
- referral rate;
- attributable utilization;
- treatment effect.

## Candidate B — mean documented U09-linked encounters per target person

Working name:

`u09_linked_service_use_encounters_mean`

### Person-level variable

Number of **distinct reconciled exact-U09-linked HC-254D/E/F/G encounters during 2024** for each target person.

Target persons with no qualifying encounter must remain in the target universe with value **0**.

### Candidate estimate

Survey-weighted mean number of qualifying encounters per target person using the full governed HC-256 person survey design and target domain.

The denominator must **not** be conditioned on having U09 or having an event.

### Interpretation

Annual documented U09-linked encounter intensity in the governed target population.

This remains descriptive and is **not attributable utilization**.

## Candidate C — family-specific mean documented U09-linked encounters

Working family:

`u09_linked_service_use_<family>_encounters_mean`

Families:

- `office`
- `outpatient`
- `emergency`
- `inpatient`

### Person-level variables

For each target person, construct the annual count of **distinct reconciled exact-U09-linked encounters** in each family, including explicit zeros.

### Candidate estimates

Survey-weighted mean family-specific encounter counts per target person using the full governed HC-256 person survey design and target domain.

Do not treat encounter rows as independent sampled observations.

Raw event-family shares may be retained only as secondary descriptive diagnostics.

### Sparse-family warning from the feasibility artifact

The reviewed real-data diagnostics contain:

- office: **86** target qualifying encounters;
- outpatient: **21**;
- emergency: **2**;
- inpatient: **0**.

Emergency and inpatient are therefore explicitly flagged as sparse in the current artifact and are **not currently appropriate for substantive interpretation**. This statement is a methods-review caution, not a new release cutoff.

## Specialty/provider composition is deferred

Do **not** promote `MEDPTYPE_M18` or `DRSPLTY_M18` composition to a release-candidate estimand in the next implementation task.

Reasons:

- only **86** target office and **21** target outpatient qualifying encounters are present;
- many cells are sparse;
- current diagnostics expose numeric public-use codes rather than a sufficiently reviewed human-readable code-label contract;
- encounter-level specialty composition is clustered within only **22** target persons with qualifying events;
- U09 linkage does not establish referral or diagnostic recognition.

A future pathway-composition task would require:

- reviewed official code-label mapping;
- explicit person-level/survey-design semantics;
- pre-specified sparse-cell/reliability handling;
- explicit non-referral/non-recognition interpretation.

The current numeric code counts remain feasibility diagnostics only.

## Multiplicity and attribution contract

The reviewed artifact shows:

- **259** qualifying U09-linked events overall;
- **116** of those qualifying events also carry at least one non-U09 condition link.

Therefore:

- a U09-linked event cannot be treated as uniquely caused by Long COVID;
- expenditure must not be assigned to U09 merely because the condition-event link exists;
- no raw linked-spending estimator should be introduced.

This is a major reason to keep Candidates A–C descriptive.

## Required pre-release statistical contract

Any later implementation of Candidates A–C must report, as applicable:

- unweighted target n;
- unweighted numerator/nonzero-person n;
- weighted denominator;
- estimate;
- standard error;
- confidence interval;
- survey degrees of freedom/design support as appropriate;
- represented strata/PSU support for relevant target domains and nonzero observations;
- a pre-specified reliability/stability status.

The existing repository does **not** yet define a governed reliability/suppression threshold for these candidates. `docs/testing.md` lists reliability/suppression rules as still required before analytical release.

Therefore:

- no arbitrary minimum-n cutoff is introduced here;
- a reliability rule must be specified and reviewed before any candidate can be admitted to release/runtime;
- ordinary software CI does not constitute scientific release approval.

## Guardrails for later implementation

A later implementation task must preserve all current Phase-A scientific boundaries:

- exact `ICD10CDX == "U09"` condition selection;
- no U07 substitution;
- unchanged HC-256 Round 3/1 operational-current Long-COVID cohort;
- U09 is not equivalent to the governed HC-256 operational-current Long-COVID definition;
- absence of exact U09 is not evidence of absence of Long COVID;
- absence of a qualifying U09-linked encounter is not evidence of absence of healthcare;
- annual D/E/F/G encounters may occur before or after the Round 3/1 current-status anchor and must not be interpreted as a temporally ordered recognition/diagnosis/referral/treatment pathway;
- full-design-before-domain survey semantics;
- exact condition/person/event/family reconciliation;
- distinct-person/distinct-encounter de-duplication;
- zeros retained for target persons without qualifying encounters;
- home health and prescriptions excluded from the initial D/E/F/G encounter family;
- no spending attribution;
- no prevalence inference from U09 frequency;
- no referral/recognition/diagnostic-delay/causal interpretation.

## Implementation gate

This contract authorizes **no implementation by itself**.

Before any later candidate estimator is considered for release or runtime admission:

1. implement the candidate in a separate reviewed PR;
2. retain the full person survey-design/domain semantics above;
3. emit the required statistical/reliability diagnostics;
4. perform independent methods review;
5. explicitly adjudicate reliability/stability and interpretation;
6. keep release status preliminary until scientific review approves otherwise.

Issue #20 remains open until its governance/status work is handled separately.
