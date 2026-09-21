# Testing and validation strategy

## Automated now

### Contracts
- suppressed/not-released numeric leakage checks;
- scenario reach validation;
- export eligibility gates.

### Scenario engine
- golden reach/capacity arithmetic;
- capacity-constrained behavior;
- person-month exposure and horizon handling;
- invalid recognition windows;
- target pathway-step/mechanism isolation;
- one-way sensitivity behavior.

### Brief
- illustrative and suppressed estimates are excluded from export.

### Evidence
- human review + admissibility + pathway/mechanism checks gate scenario parameter use.

### CI
Each push/PR runs TypeScript checks, unit tests, ESLint, and the Vite production build.

## Still required before analytical release

- MEPS/NHIS variable coding and universe tests;
- weighted/unweighted denominator checks;
- survey-design preservation;
- tail/extreme review;
- nested-spending reconciliation;
- reliability/suppression rules;
- external plausibility benchmarks;
- provenance completeness for every released headline result;
- accessibility/keyboard/contrast QA;
- end-to-end tests for partial/suppressed/error states;
- deterministic export leakage tests against real candidate artifacts;
- optional AI extraction benchmark if/when AI is enabled.

Passing software CI does **not** constitute scientific release approval.


## MEPS analytical synthetic tests

GitHub Actions also runs an R job that installs the declared offline-analysis dependencies and executes synthetic MEPS tests. These do **not** require or download HC-256.

Current R coverage includes:
- Long COVID round-resolution and reserved-code behavior;
- person vs ESAQ vs PSAQ weight separation;
- weighted totals, means, proportions, and interval serialization;
- weighted/unweighted denominator propagation;
- out-of-pocket component metadata to prevent double counting;
- prohibition on a combined administrative-time burden score;
- required analytical provenance before a candidate artifact can validate.

Real-data plausibility and methods review remain separate from software CI.
