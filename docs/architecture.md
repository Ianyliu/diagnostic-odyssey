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
React/TypeScript/Vite shell. It owns routing, screen composition, browser state, accessible interactions, and artifact-backed presentation. It must not contain statistical estimation logic. Large pages are composed of focused modules: the Strategy Lab (`src/pages/PilotPage.tsx`) keeps all state and effects and renders stateless sections from `src/pages/pilot/` (`AssumptionsForm`, `ResultsPanel`, `DecisionInspector`, `CompareStrategiesPanel`, `QuantitiesPanel`, `ContextPanel`, `PathwayBoundaryDrawer`). It is type-checked as three projects (browser `src`, server `api`/`build`/`src/server`/`vite.config.ts`, and tests); see [ADR 0002](adr/0002-split-typescript-projects-and-keep-tests-hermetic.md).

### `packages/contracts`
Canonical TypeScript contracts and JSON-Schema-like runtime validators for artifacts and domain objects. Scientific status vocabulary lives here so it cannot drift between UI modules. `src/index.ts` is an explicit barrel over `constants`, `types`, per-domain `validate-*` modules and `gates`; internal guard helpers are not exported. The public API is pinned by `packages/contracts/test/public-api.test.ts` and the characterization suite.

### `packages/scenario-engine`
Pure deterministic TypeScript functions. It accepts a validated `Scenario` and returns a `ScenarioResult`. It cannot access network services, AI, analytics code, or local-context multipliers.

### `packages/evidence-core`
Deterministic admissibility/release rules. Optional model extraction may propose evidence fields later, but this package controls which reviewed records can be used and how.

### `packages/brief-core`
Builds a planning brief from released estimates, validated scenario outputs, evidence records, local context, and data requests. Export filtering occurs here as a second line of defense.

### `packages/condition-adapters`
Condition-specific cohort labels, domain availability, pathway definitions, and source compatibility. Generic contracts remain condition-neutral.

### `packages/ui`
Strategic Atlas design tokens (`packages/ui/src/styles.css`): light, dark, and print cool-neutral palettes, 7-role semantic tokens, self-hosted typography variables, and shell/motion constants. It contains visual semantics, not scientific domain calculations.

### `packages/acquisition-hints`
Fail-closed acquisition-guidance contracts and resolver boundaries; production release allowlists remain empty.

### `packages/planning-guidance`
Offline deterministic input/egress/candidate/output contracts and Draft 2020-12 schemas for bounded planning-guidance workflows.

### `packages/narrative-references`
Isolated contracts and validation rules for reviewed narrative intervention references; production narrative release remains unpopulated.

### `apps/web/api`
Vercel serverless endpoints for isolated Preview-only Gemini operator testing (`POST /api/ai-guidance`, disabled `404` in public production) and permanently retired `404` `/api/ai-preview`. Paired with strict CSP headers in `apps/web/vercel.json` and parser-blocking `/theme-init.js`. Every file in `apps/web/api` is a public function and must be self-contained (Node built-ins only): the Vercel builder does not trace local `.ts` modules into the deployed function ([ADR 0003](adr/0003-vercel-api-functions-stay-self-contained.md)); this is enforced by `apps/web/test/api-self-contained.test.ts` and checked end to end by `scripts/verify/vercel-function-build.sh`.

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
/                    Overview (six-chapter Atlas Unfolded landing + Strategy Sandbox)
/burden              01 Burden overview (Focus/Overview ledgers + provenance inspector)
/burden/medical      Economic/healthcare burden (plus specialized linked-condition Candidate A)
/burden/work         Work/function (explicitly unavailable)
/burden/admin        Healthcare-work/administrative burden
/burden/human        Mental-health/human burden
/local-context       02 Local context (34-indicator WV constraint matrix + Use in Strategy Lab)
/pilot               03 Strategy Lab (presets, sliders, visuals, Decision Inspector, Compare Strategies, sensitivity)
/brief               04 Planning Brief (Known·Assumed·Unknown memo, Insights, JSON/PDF, Analyze with AI)
/data-requests       Data requests (optional companion; Known/Assumed/Unknown strip, opt-in Brief selection)
/evidence            Intervention evidence & limits (supporting route)
/advisor             Strategy AI Studio (Prompt Studio, Illustrative exploration, Preview-gated Gemini)
/concept/future-ai   Strategy AI Studio alias (redirects to /brief when VITE_FUTURE_AI_EXPERIENCE_DEMO=off or hidden)
```

The header also exposes the **Edition 01** `EditionDrawer` (Coverage & Roadmap) without navigating away from the current task. The working vertical slice is `01 Burden → 02 Local context → 03 Strategy Lab → 04 Planning Brief` (with optional `Data requests`).

## Data boundaries

National disease-burden artifacts, local implementation-context records, and specialized linked-condition evidence are independently versioned artifact families composed only after review; local indicators never rescale or mutate national estimates, and `Candidate A` secondary evidence stays isolated on `/burden/medical` outside the generic `PlanningBrief`.

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

The core quantitative path remains fully usable with AI unavailable. Public production builds execute zero live AI calls (*Prompt Studio* and *Illustrative exploration* in Strategy AI Studio run strictly locally); authenticated `/api/ai-guidance` testing runs only on protected Vercel Preview deployments when explicitly enabled.
