# Diagnostic Odyssey

Diagnostic Odyssey is a statistically grounded planning platform for making hidden diagnostic-odyssey burden visible and turning reviewed evidence into a defensible planning artifact.

The full product workflow is:

**Overview → Burden → Local Context → Pilot Planner → Evidence / Data Requests → Planning Brief**

The first working vertical slice is:

**Burden → Pilot Planner → Planning Brief**

## First-pass implementation status

### Working now

- Reviewed national 2024 MEPS HC-256 Long COVID analytical artifact with 21 reviewed_released estimates, loaded at runtime from `artifacts/reviewed/meps-2024-long-covid-candidate-20260923T020607Z/`.
- Survey-aware MEPS analytical pipeline and explicit candidate → methods review → promotion gates.
- Separate HRSA + 2024 ACS 5-year local-context candidate pipeline for implementation/access evidence; candidate output is not runtime-loaded before independent review and promotion.

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

- Reviewed HRSA/ACS local-context artifact and runtime integration; the current implementation stops at a preliminary, independently reviewable candidate.
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

The checked-in artifact under `artifacts/examples/fixture-2026-09-v1/` is **illustrative development data only**. It is deliberately barred from analytical export by the release/display gates.

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
  local_context/             HRSA + ACS local-context candidate pipeline/config/tests

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

Requires Node 22+ for the application/contracts and R for the offline analytical pipeline.

### First real MEPS candidate

Preferred reproducible execution is the manual GitHub Actions workflow:

`Actions → MEPS 2024 Long COVID Candidate → Run workflow`

Select `main` (or an explicitly reviewed commit/ref). The workflow has no custom inputs. It downloads HC-256 from the official AHRQ source, reruns TypeScript and synthetic R checks, generates a **preliminary** candidate, and uploads aggregate review files only. It does not commit the candidate or change runtime artifact selection.

For local execution instead, from the repository root:

```bash
Rscript analysis/r/install_dependencies.R
Rscript analysis/r/meps/run_meps_2024.R --download
```

The second command uses the official AHRQ HC-256 Stata download when the raw file is absent. If automatic download is unavailable in your environment, manually place the official HC-256 Stata ZIP at `data/raw/meps/2024/meps_hc256_2024_stata.zip` and run the command without `--download`.

Generated candidates are written under `artifacts/generated/meps-2024-long-covid-candidate/` and remain gitignored and `release_status=preliminary` until explicit methods review.

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

Do not commit raw public-use microdata, large intermediate files, or large generated analytical outputs.

See `data/README.md` and `data/manifests/sources.json` for:

- required/manual downloads;
- canonical local filenames;
- official source pages;
- approximate sizes where verified;
- registration/API-key requirements;
- downstream script entry points.

The repository contains the reviewed aggregate MEPS national artifact. Raw MEPS/HRSA files remain excluded. HRSA/ACS local-context values are generated only by the manual candidate workflow and are not runtime-visible until independently reviewed and promoted.

## AI boundary

AI may later assist with reviewed evidence extraction, applicability flags, or language drafting. It may not calculate burden estimates, change scenario arithmetic, assign final release/admissibility status, or bypass deterministic export gates.
