# Diagnostic Odyssey

Diagnostic Odyssey is a statistically grounded planning platform for making hidden diagnostic-odyssey burden visible and turning reviewed evidence into a defensible planning artifact.

It is designed for teams planning services around conditions such as Long COVID and ME/CFS. The application separates observed burden, local context, reviewed evidence, and planning assumptions so that a useful pilot plan does not imply stronger evidence than the data support.

The full product workflow is:

**Overview → Burden → Local Context → Pilot Planner → Evidence / Data Requests → Planning Brief**

The first working vertical slice is:

**Burden → Pilot Planner → Planning Brief**

## Quick start

### Run the web app

Requirements: Node.js 22 or newer. From the repository root:

```bash
npm install
npm run dev
```

Open the local URL printed by Vite, usually `http://localhost:5173`. The app starts with the checked-in illustrative fixture so the planning workflow can be explored without downloading research data.

### Run the checks

```bash
npm run typecheck
npm test
npm run lint
npm run build
```

These commands cover the TypeScript packages, web integration tests, linting, and the production build. Run them from the repository root after installing dependencies.

### Run the analytical pipeline

The MEPS pipeline is separate from the web app and requires R. It downloads or reads the official AHRQ HC-256 public-use file and writes a preliminary candidate artifact locally:

```bash
Rscript analysis/r/install_dependencies.R
Rscript analysis/r/meps/run_meps_2024.R --download
```

See [Data and analytical inputs](#data-and-analytical-inputs) before running this workflow. Raw microdata and generated candidates are intentionally not committed.

## What is implemented

### Working now

- Reviewed national 2024 MEPS HC-256 Long COVID artifact with **21 `reviewed_released` estimates**, loaded by the web runtime from `artifacts/reviewed/meps-2024-long-covid-candidate-20260923T020607Z/`.
- Survey-aware MEPS analytical pipeline with reviewed variable map, cohort construction, weight-specific survey designs, burden domains, candidate generation, methods review, and explicit promotion gates.
- Hardened HRSA + 2024 ACS 5-year local-context candidate pipeline with frozen source contracts, fail-closed validation, provenance, diagnostics, and independent candidate/release gates. No real HRSA/ACS candidate has been reviewed or runtime-integrated yet.

- React + TypeScript + Vite application shell and all major product routes.
- Versioned fixture artifact loading with runtime validation and explicit loading/error behavior.
- Typed scientific contracts and status vocabulary.
- Deterministic TypeScript scenario engine with reach, capacity, person-month exposure, and program-resource calculations.
- Interactive Burden → Pilot Planner → Planning Brief vertical slice.
- JSON planning-brief companion export and browser print/HTML path.
- Export filtering that prevents illustrative/unreleased estimates from appearing as released burden findings.
- Deterministic evidence admissibility gates.
- Long COVID reference condition adapter and ME/CFS compatibility skeleton.
- Figma-derived design tokens and coarse responsive presentation.
- Dataset source manifest, raw-data placement policy, and fail-closed R pipeline entry points.
- GitHub Actions CI for install, strict typecheck, unit tests, lint, and production build.

### Scaffolded / intentionally incomplete

- Reviewed HRSA/ACS local-context artifact and runtime integration. The acquisition/validation pipeline is implemented and hardened, but the real-data local-context candidate has not yet been run and independently reviewed.
- PLACES/CMS local-context ingestion.
- Reviewed external literature ledger and source extraction workflow.
- Evidence-backed bounded scenario parameters.
- Rich provenance drawer/interactions.
- Sensitivity UI (the engine API exists).
- Real analytical-artifact release workflow.
- ME/CFS analytical estimates.
- Rich HTML/PDF/Markdown export formatting.
- Pixel-level Figma parity, chart polish, and full accessibility QA.
- Optional grounded AI. The core product does not require AI.

The checked-in artifact under `artifacts/examples/fixture-2026-09-v1/` is **illustrative development/test data only**. It is deliberately barred from analytical export by the release/display gates. The released national MEPS artifact is separate and runtime-loaded; the fixture remains only for development and test coverage.

## How to use the prototype

1. Open **Burden** to inspect the available burden domains and their release state.
2. Open **Pilot Planner** to set planning assumptions such as reach, capacity, and duration.
3. Review the deterministic scenario calculations, keeping program-resource requirements separate from savings or ROI.
4. Open **Planning Brief** to review the assembled planning artifact and use the JSON or browser print/HTML export path.

The remaining routes are present to show the intended product boundary: **Overview**, **Local Context**, **Evidence**, and **Data Requests** are available even where the underlying data or review workflow is still scaffolded.

## Scientific boundaries

The application preserves these distinctions:

- gross burden ≠ attributable burden;
- national burden evidence ≠ state/local implementation context;
- missing/suppressed ≠ zero;
- scenario assumptions ≠ observed effects;
- program-resource requirement ≠ savings or ROI;
- PHQ-2/K6 screens ≠ psychiatric diagnoses;
- unreleased/suppressed values cannot enter exports;
- bounded effects can modify only the pathway step/mechanism they support.

See [Scientific guardrails](docs/scientific-guardrails.md) for the detailed rules.

## Repository structure

```text
apps/
  web/                       React/Vite product shell and routes

packages/
  contracts/                 canonical types + runtime validators
  scenario-engine/           pure deterministic scenario calculations
  evidence-core/             reviewer/admissibility gates
  brief-core/                planning brief assembly + export filtering
  condition-adapters/        condition reuse boundary
  ui/                        design tokens

analysis/
  r/                         offline survey-analysis entry points
  local_context/             HRSA + ACS candidate pipeline/config/tests

pipelines/
  data/                      source acquisition helpers/boundaries
  evidence/                  evidence ingestion/review foundation

conditions/
  long-covid/                reference implementation notes
  mecfs/                     compatibility proof notes

data/
  manifests/                 checked-in source inventory
  raw/                       local only; gitignored
  intermediate/              local only; gitignored
  derived/                   local only; gitignored

artifacts/
  examples/                  small versioned illustrative fixtures

docs/
  architecture.md
  implementation-plan.md
  scientific-guardrails.md
  testing.md

.github/
  workflows/
    ci.yml
    meps-candidate.yml
    local-context-candidate.yml
```

## Development

Requires Node 22+ for the application and contracts. R is required only for the offline analytical pipeline.

### First real MEPS candidate

Preferred reproducible execution is the manual GitHub Actions workflow:

`Actions → MEPS 2024 Long COVID Candidate → Run workflow`

Select `main` (or an explicitly reviewed commit/ref). The workflow has no custom inputs. It downloads HC-256 from the official AHRQ source, reruns TypeScript and synthetic R checks, generates a **preliminary** candidate, and uploads aggregate review files only. It does not commit the candidate or change runtime artifact selection.

For local execution, the second command uses the official AHRQ HC-256 Stata download when the raw file is absent. If automatic download is unavailable in your environment, manually place the official HC-256 Stata ZIP at `data/raw/meps/2024/meps_hc256_2024_stata.zip` and run the command without `--download`.

Generated candidates are written under `artifacts/generated/meps-2024-long-covid-candidate/` and remain gitignored and `release_status=preliminary` until explicit methods review.

Quality checks:

```bash
npm run typecheck
npm test
npm run lint
npm run build
```

## Data and analytical inputs

Do not commit raw public-use microdata, large intermediate files, or large generated analytical outputs.

See [data/README.md](data/README.md) and [data/manifests/sources.json](data/manifests/sources.json) for:

- required/manual downloads;
- canonical local filenames;
- official source pages;
- approximate sizes where verified;
- registration/API-key requirements;
- downstream script entry points.

The repository contains the reviewed aggregate national MEPS artifact with 21 `reviewed_released` estimates. Raw MEPS and HRSA source files remain excluded. HRSA/ACS local-context values are not runtime-visible until a real candidate is generated, independently reviewed, promoted, and integrated. The illustrative fixture remains development/test-only and is not a substitute for reviewed evidence.

## Documentation

- [Architecture](docs/architecture.md): package boundaries and runtime flow.
- [Implementation plan](docs/implementation-plan.md): planned product and analytical work.
- [Scientific guardrails](docs/scientific-guardrails.md): interpretation and release constraints.
- [Testing](docs/testing.md): test strategy and validation boundaries.
- [MEPS Long COVID methods](docs/methods/meps-2024-long-covid.md): analytical method notes.

## AI boundary

AI may later assist with reviewed evidence extraction, applicability flags, or language drafting. It may not calculate burden estimates, change scenario arithmetic, assign final release/admissibility status, or bypass deterministic export gates.
