# Architecture

## Principles

Diagnostic Odyssey is a static-first, artifact-driven planning application. Statistical estimation happens offline; runtime code validates and presents versioned artifacts and performs transparent deterministic scenario arithmetic.

The architecture intentionally avoids a premature backend, authentication, patient data storage, live model fitting, and AI-dependent calculations.

## Runtime flow

```text
Public-use federal data + reviewed literature + approved qualitative evidence
                                   |
                                   v
                  Offline R / evidence pipelines
                                   |
                                   v
             Versioned, reviewed analytical artifacts
                                   |
                     JSON/CSV + provenance manifest
                                   |
                                   v
                    Artifact validation layer
                                   |
             +---------------------+----------------------+
             |                                            |
             v                                            v
       React application                         Evidence/admissibility
             |                                    deterministic gates
             v                                            |
       Scenario engine <----------------------------------+
             |
             v
       Brief assembler
             |
             v
 Accessible HTML + JSON export
```

## Monorepo boundaries

### `apps/web`
React/TypeScript/Vite shell. It owns routing, screen composition, browser state, accessible interactions, and artifact-backed presentation. It must not contain statistical estimation logic.

### `packages/contracts`
Canonical TypeScript contracts and JSON-Schema-like runtime validators for artifacts and domain objects. Scientific status vocabulary lives here so it cannot drift between UI modules.

### `packages/scenario-engine`
Pure deterministic TypeScript functions. It accepts a validated `Scenario` and returns a `ScenarioResult`. It cannot access network services, AI, analytics code, or local-context multipliers.

### `packages/evidence-core`
Deterministic admissibility/release rules. Optional model extraction may propose evidence fields later, but this package controls which reviewed records can be used and how.

### `packages/brief-core`
Builds a planning brief from released estimates, validated scenario outputs, evidence records, local context, and data requests. Export filtering occurs here as a second line of defense.

### `packages/condition-adapters`
Condition-specific cohort labels, domain availability, pathway definitions, and source compatibility. Generic contracts remain condition-neutral.

### `packages/ui`
Design tokens and reusable accessible primitives aligned with current Figma. It contains visual semantics, not scientific domain calculations.

### `analysis/r`
Offline survey-aware analysis entry points for MEPS/NHIS and related validation. Large source data and generated analytical outputs remain outside Git.

### `analysis/local_context`
Fail-closed acquisition, source-contract verification, aggregation, and diagnostics for the separate HRSA + ACS implementation-context artifact family. It does not import, rescale, or mutate national MEPS burden estimates.

### `pipelines/evidence`
Literature/source ingestion and structured evidence-review helpers. Any future LLM-assisted extraction is optional and human-reviewed.

### `pipelines/data`
Reproducible download/ingestion helpers for sources that permit scripted retrieval.

## Full product routing

```text
/                    Overview
/burden              Burden overview
/burden/medical      Economic/healthcare burden
/burden/work         Work/function
/burden/admin        Healthcare-work/administrative burden
/burden/human        Mental-health/human burden
/local-context       Local implementation context
/pilot               Pilot Planner
/evidence            Evidence/admissibility
/data-requests       Structured data requests
/brief               Planning Brief
```

The early vertical slice is `/burden → /pilot → /brief`.

## Data boundaries

National disease-burden artifacts and local implementation-context records are different object types. The reviewed national MEPS artifact and any future reviewed local-context artifact are independently versioned and are composed only after review; local indicators are never used to rescale or mutate national estimates.

All numeric analytical claims carry:
- denominator/universe;
- system boundary;
- evidence type;
- release status;
- display status;
- source reference;
- artifact version.

Any step-specific parameter additionally carries the pathway step/mechanism it supports.

## Artifact lifecycle

1. Raw source data are acquired outside Git.
2. Offline analysis produces candidate artifacts.
3. Methods review assigns release status and limitations.
4. A versioned artifact folder is promoted for runtime use.
5. The web app validates every artifact on load.
6. Unreleased/suppressed values are excluded from display/export logic.
7. Exports include artifact version, assumptions, evidence scope, warnings, and generation metadata.

## AI boundary

AI may eventually:
- extract candidate evidence fields from allowlisted sources;
- flag applicability mismatches;
- draft source-grounded language from already released structured inputs.

AI may never:
- compute statistical burden estimates;
- change scenario arithmetic;
- invent or override evidence/release status;
- bypass reviewer-controlled admissibility;
- introduce new quantitative values in a brief.

The core quantitative path remains fully usable with AI unavailable.
