# Diagnostic Odyssey

Diagnostic Odyssey is a statistically grounded planning platform for making hidden diagnostic-odyssey burden visible and turning reviewed evidence into a defensible planning artifact.

It is designed for teams planning services around conditions such as Long COVID and ME/CFS. The application separates observed burden, local context, reviewed evidence, and planning assumptions so that a useful pilot plan does not imply stronger evidence than the data support.

> **Project status:** working decision-workspace foundation with reviewed national 2024 MEPS Long COVID burden runtime-loaded as one evidence layer and reviewed West Virginia **state-level** HRSA + ACS context runtime-loaded separately as implementation context. The 21 national `reviewed_released` estimates remain unchanged; WV context does not rescale or mutate them. Analysts may explicitly include reviewed WV records in the Planning Brief and may separately attach one eligible reviewed record as the active Pilot planning context. Pilot attachment is contextual only: it does not auto-change numeric assumptions or rescale national burden. County-level reviewed context and the Implementation Decision Map remain future work.

The full product workflow is:

**Overview → Burden → Local Context → Pilot Planner → Evidence / Data Requests → Planning Brief**

The first working vertical slice is:

**Burden → Pilot Planner → Planning Brief**

Within that slice, the Pilot Planner now includes deterministic decision visuals and one-way sensitivity testing. Sensitivity findings can be converted into structured operational data requests, which require explicit analyst opt-in before they enter the Planning Brief.

## Start here

| Goal | Recommended path | Requirements |
| --- | --- | --- |
| Explore the web app | [Run locally](#run-locally) | Node.js 22+ |
| Use a reproducible environment | [Open the dev container](#use-the-dev-container) | Docker and the Dev Containers extension |
| Run the MEPS analysis | [Run the analytical pipeline](#run-the-analytical-pipeline) | R and internet access |

## Quick start

### Run locally

Requirements: Node.js 22 or newer. From the repository root:

```bash
npm ci
npm run dev
```

Open the local URL printed by Vite, usually `http://localhost:5173`. The app loads the promoted reviewed national MEPS artifact and, as a separate runtime layer, the promoted reviewed West Virginia state-level HRSA/ACS implementation-context artifact. The checked-in illustrative fixture remains available only for development/test coverage and is not a runtime evidence source.

### Use the dev container

The repository includes an optional VS Code dev container with Node 22, R, the analytical system libraries, recommended extensions, and port `5173` forwarding.

1. Install Docker and the [Dev Containers extension](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers).
2. Open this repository in VS Code.
3. Run **Dev Containers: Reopen in Container** from the Command Palette.
4. After setup completes, run `npm run dev` in the container terminal.

The container is a convenience for consistent tooling, not a requirement. Raw research data remains local and is never included in the image or committed to Git.

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

## Product map

The intended workflow is:

**Overview → Burden → Local Context → Pilot Planner → Evidence / Data Requests → Planning Brief**

The working vertical slice is:

**Burden → Pilot Planner → Planning Brief**

Use the application in that order:

1. **Burden:** inspect burden domains, native units, release state, and comparable reviewed confidence intervals where units and universe permit.
2. **Pilot Planner:** set planning assumptions, inspect deterministic decision visuals, and run one-way sensitivity for reach, capacity, or the planning recognition window.
3. **Data Requests:** optionally turn sensitivity uncertainty into a structured operational request; explicit analyst opt-in is required before a current request enters the Planning Brief.
4. **Planning Brief:** review the assembled artifact and use the JSON companion export or browser print / save-PDF path.

The other routes show the intended product boundary. Some are deliberately scaffolded while their source data or review workflow is being built.

## Implementation status

### Working now

- Reviewed national 2024 MEPS HC-256 Long COVID artifact with **21 `reviewed_released` estimates**, loaded by the web runtime from `artifacts/reviewed/meps-2024-long-covid-candidate-20260926T011343Z/`.
- Survey-aware MEPS analytical pipeline with reviewed variable map, cohort construction, weight-specific survey designs, burden domains, candidate generation, methods review, and explicit promotion gates.
- Reviewed West Virginia **state-level** HRSA + 2024 ACS 5-year local context, runtime-loaded from `artifacts/reviewed/local-context-wv-hrsa-acs-candidate-20260924T052332Z/` as a separate implementation-context layer with fail-closed runtime validation. Analysts can explicitly select eligible reviewed records into the Planning Brief; selection does not rescale national burden or alter Pilot Planner assumptions.

- React + TypeScript + Vite application shell and all major product routes.
- Versioned fixture artifact loading with runtime validation and explicit loading/error behavior.
- Typed scientific contracts and status vocabulary.
- Deterministic TypeScript scenario engine with reach, capacity, person-month exposure, and program-resource calculations.
- Pilot decision visuals for capacity coverage/gap, recognition-window comparison, and fixed versus participant-dependent program-resource composition.
- Deterministic one-way sensitivity explorer for intended reach, program capacity, and the planning recognition window, with an accessible table alternative. Sensitivity is assumption testing, not evidence-derived effect estimation, and scenario outputs are not forecasts.
- Sensitivity → structured operational data-request handoff with explicit analyst opt-in before a request enters the Planning Brief; stale or invalid sensitivity-derived requests fail closed from Brief/JSON until valid, current, and explicitly refreshed. Data requests are planning artifacts, not observed evidence.
- Decision-state rail plus comparable reviewed confidence-interval visualization where units and universe permit, and reviewed HRSA rural-status composition visualization.
- Interactive Burden → Pilot Planner → Data Requests → Planning Brief workflow.
- JSON planning-brief companion export and browser print / save-PDF path.
- Export filtering that prevents illustrative/unreleased estimates from appearing as released burden findings.
- Deterministic evidence admissibility gates.
- Long COVID reference condition adapter and ME/CFS compatibility skeleton.
- Figma-derived design tokens and coarse responsive presentation.
- Dataset source manifest, raw-data placement policy, and fail-closed R pipeline entry points.
- GitHub Actions CI for install, strict typecheck, unit tests, lint, and production build.

### Scaffolded / intentionally incomplete

- Reviewed county-level local context does not exist yet; county HRSA/ACS aggregation, topology, and the Implementation Decision Map remain future work. The state-level Local Context → Pilot Planner handoff is implemented as an explicit single-record analyst choice without automatic numeric calibration.
- PLACES/CMS local-context ingestion.
- Reviewed external literature ledger and source extraction workflow.
- Evidence-backed bounded scenario parameters.
- Rich provenance drawer/interactions.
- Real analytical-artifact release workflow.
- ME/CFS analytical estimates.
- Rich HTML/PDF/Markdown export formatting.
- Pixel-level Figma parity, chart polish, and full accessibility QA.
- Optional grounded AI. The core product does not require AI.

The checked-in artifact under `artifacts/examples/fixture-2026-09-v1/` is **illustrative development/test data only**. It is deliberately barred from analytical export by the release/display gates. The released national MEPS artifact is separate and runtime-loaded; the fixture remains only for development and test coverage.

## Scientific boundaries

The application preserves these distinctions:

- gross burden ≠ attributable burden;
- national burden evidence ≠ state/local implementation context;
- missing/suppressed ≠ zero;
- scenario assumptions ≠ observed effects;
- deterministic sensitivity testing ≠ evidence-derived effect estimation;
- scenario outputs ≠ forecasts;
- program-resource requirement ≠ savings or ROI;
- data requests are planning artifacts, not observed evidence;
- state/local implementation context does not rescale national MEPS burden;
- reviewed county-level context and the Implementation Decision Map remain future work;
- PHQ-2/K6 screens ≠ psychiatric diagnoses;
- unreleased/suppressed values cannot enter exports;
- bounded effects can modify only the pathway step/mechanism they support.

See [Scientific guardrails](docs/scientific-guardrails.md) for the detailed rules.

## Repository map

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
  reviewed/                  promoted aggregate analytical artifacts used by runtime
  examples/                  illustrative development/test fixtures only

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

### MEPS candidate maintenance / regeneration

The reviewed MEPS artifact is already promoted and runtime-loaded. The manual GitHub Actions workflow remains the reproducible path for maintenance or future regeneration:

`Actions → MEPS 2024 Long COVID Candidate → Run workflow`

Select `main` (or an explicitly reviewed commit/ref). The workflow has no custom inputs. It downloads HC-256 from the official AHRQ source, reruns TypeScript and synthetic R checks, generates a **preliminary** candidate, and uploads aggregate review files only. It does not commit the candidate or change runtime artifact selection.

For local execution, the pipeline uses the official AHRQ HC-256 Stata download when the raw file is absent. If automatic download is unavailable in your environment, manually place the official HC-256 Stata ZIP at `data/raw/meps/2024/meps_hc256_2024_stata.zip` and run the command without `--download`.

Generated candidates are written under `artifacts/generated/meps-2024-long-covid-candidate/` and remain gitignored and `release_status=preliminary` until explicit methods review and promotion. Running the candidate workflow does not overwrite the reviewed runtime artifact.

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

The repository contains the reviewed aggregate national MEPS artifact with 21 `reviewed_released` estimates and a separately runtime-loaded reviewed West Virginia state-level HRSA/ACS implementation-context artifact. Raw MEPS and HRSA source files remain excluded. State local context does not rescale or mutate national burden. Eligible reviewed state records may be explicitly selected into the Planning Brief, and one eligible reviewed state record may separately be attached for Pilot planning. That attachment is an analyst context handoff only and does not change Pilot numeric assumptions or national burden. No reviewed county-level local context exists yet; the Implementation Decision Map remains future work. The illustrative fixture remains development/test-only and is not a substitute for reviewed evidence.

## Working agreements

- Keep raw microdata, intermediate files, and generated candidates out of Git.
- Treat missing, suppressed, and unreleased values as distinct from zero.
- Keep scenario assumptions separate from observed effects.
- Do not interpret program-resource requirements as savings or ROI.
- Run the quality checks before submitting changes.

## Documentation

- [Architecture](docs/architecture.md): package boundaries and runtime flow.
- [Implementation plan](docs/implementation-plan.md): planned product and analytical work.
- [Scientific guardrails](docs/scientific-guardrails.md): interpretation and release constraints.
- [Testing](docs/testing.md): test strategy and validation boundaries.
- [MEPS Long COVID methods](docs/methods/meps-2024-long-covid.md): analytical method notes.

## AI boundary

AI may later assist with reviewed evidence extraction, applicability flags, or language drafting. It may not calculate burden estimates, change scenario arithmetic, assign final release/admissibility status, or bypass deterministic export gates.
