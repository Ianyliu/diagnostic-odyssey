# Diagnostic Odyssey

Diagnostic Odyssey is a statistically grounded planning platform for making hidden diagnostic-odyssey burden visible and turning reviewed evidence into a defensible planning artifact.

The full product workflow is:

**Overview → Burden → Local Context → Pilot Planner → Evidence / Data Requests → Planning Brief**

The current presentation-ready vertical slice is:

**Burden → Pilot Planner → Planning Brief**

## Implementation status

### Working now

- Reviewed 2024 AHRQ MEPS HC-256 Long COVID analytical artifact, stored under `artifacts/reviewed/` and loaded directly by the web runtime with contract validation.
- **21 `reviewed_released` national analytical estimates** spanning represented population, spending, healthcare utilization, ESAQ administrative burden, K6, and PHQ-2 outputs.
- Completed **candidate → methods review → explicit promotion/release** workflow. Candidate generation remains preliminary until an explicit review decision promotes approved estimates.
- React + TypeScript + Vite application shell and the major product routes.
- Interactive **Burden → Pilot Planner → Planning Brief** flow using the reviewed national artifact.
- Deterministic scenario assumptions and arithmetic kept explicitly separate from observed evidence.
- Scenario outputs for reach, capacity, person-month exposure, and program-resource requirements, with guardrails against interpreting planning quantities as savings or ROI.
- Planning Brief with reviewed burden findings, scenario assumptions, local-context/evidence empty states, JSON companion export, and browser print / save-PDF support.
- Explicit scientific status vocabulary, runtime validation, release/display gates, and export filtering.
- Long COVID reference condition adapter and ME/CFS compatibility skeleton.
- Dataset source manifest, raw-data placement policy, and fail-closed analytical entry points.
- GitHub Actions CI for install, strict typecheck, unit tests, lint, production build, and synthetic R analysis tests.

### In progress

- **HRSA + ACS local-context candidate:** implementation/hardening is complete on its review branch, but the real-data workflow has **not** been run or reviewed and is not promoted into runtime.
- Reviewed local-context promotion and runtime integration.
- Intervention-effect evidence suitable for bounded scenario parameters.
- External evidence ledger and source-extraction/review workflow.
- Richer sensitivity and provenance UI.
- ME/CFS analytical estimates.

The illustrative fixture under `artifacts/examples/fixture-2026-09-v1/` is retained for development and test purposes only. It is **not** the runtime analytical source and remains barred from analytical export by the release/display gates.

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

See `docs/scientific-guardrails.md`.

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
  examples/                  retained illustrative development/test fixtures

docs/
  analytical-release-workflow.md
  architecture.md
  implementation-plan.md
  scientific-guardrails.md
  testing.md

.github/
  workflows/
    ci.yml
    meps-candidate.yml
```

## Development

Requires Node 22+ for the application/contracts and R for the offline analytical pipeline.

### MEPS candidate maintenance / regeneration

The reviewed analytical pipeline is already released to runtime. The manual candidate workflow is retained for reproducible maintenance and future regeneration:

`Actions → MEPS 2024 Long COVID Candidate → Run workflow`

Select `main` (or an explicitly reviewed commit/ref). The workflow has no custom inputs. It downloads HC-256 from the official AHRQ source, reruns TypeScript and synthetic R checks, generates a **preliminary** candidate, and uploads aggregate review files only.

Running the candidate workflow does **not** overwrite the reviewed runtime artifact and does **not** promote estimates automatically. A regenerated candidate must pass methods review and explicit promotion before it can become `reviewed_released`.

For local regeneration instead, from the repository root:

```bash
Rscript analysis/r/install_dependencies.R
Rscript analysis/r/meps/run_meps_2024.R --download
```

The second command uses the official AHRQ HC-256 Stata download when the raw file is absent. If automatic download is unavailable in your environment, manually place the official HC-256 Stata ZIP at `data/raw/meps/2024/meps_hc256_2024_stata.zip` and run the command without `--download`.

Generated candidates are written under `artifacts/generated/meps-2024-long-covid-candidate/` and remain gitignored and `release_status=preliminary` until explicit methods review and promotion.

See `docs/analytical-release-workflow.md` for the release contract.

### Web development

Requires Node 22+.

```bash
npm install
npm run dev
```

Quality checks:

```bash
npm run typecheck
npm test
npm run lint
npm run build
```

## Data policy

Do not commit raw public-use microdata, large intermediate files, or unreviewed generated analytical outputs.

The repository **does contain a reviewed aggregate MEPS analytical artifact** under `artifacts/reviewed/` for runtime use. It does not contain the underlying HC-256 respondent-level microdata.

See `data/README.md` and `data/manifests/sources.json` for:

- required/manual downloads;
- canonical local filenames;
- official source pages;
- approximate sizes where verified;
- registration/API-key requirements;
- downstream script entry points.

No reviewed HRSA/ACS local-context artifact is currently promoted into runtime.

## AI boundary

AI may later assist with reviewed evidence extraction, applicability flags, or language drafting. It may not calculate burden estimates, change scenario arithmetic, assign final release/admissibility status, or bypass deterministic export gates.
