# Diagnostic Odyssey

Diagnostic Odyssey is a statistically grounded planning platform for making hidden diagnostic-odyssey burden visible and turning reviewed evidence into a defensible planning artifact.

The product is organized around the full workflow:

**Overview → Burden → Local Context → Pilot Planner → Evidence / Data Requests → Planning Brief**

The early vertical slice remains:

**Burden → Pilot Planner → Planning Brief**

## Status

This repository is under active implementation for the TOPx HHS Tech Sprint. The architectural contract is broader than the current implemented feature set.

- Long COVID is the reference condition.
- ME/CFS is the first compatibility proof.
- Quantitative estimates are produced offline and loaded as versioned artifacts.
- Runtime scenario calculations are deterministic and do not depend on AI.
- AI, when added, is restricted to evidence extraction/applicability support and grounded language generation behind release/admissibility gates.
- Prototype fixture values are illustrative and are **not analytical findings**.

## Scientific boundaries

The application must preserve these distinctions:

- gross burden ≠ attributable burden;
- national burden evidence ≠ state/local implementation context;
- missing/suppressed ≠ zero;
- scenario assumptions ≠ observed effects;
- program-resource requirement ≠ savings or ROI;
- PHQ-2/K6 screens ≠ psychiatric diagnoses;
- unreleased/suppressed values must never enter exports;
- evidence-supported effects may modify only the named pathway step/mechanism they support.

See `docs/scientific-guardrails.md` once the implementation foundation is committed.

## Planned repository shape

```text
apps/web/                     React + TypeScript + Vite application
packages/contracts/           Zod schemas and typed scientific contracts
packages/scenario-engine/     deterministic scenario calculations
packages/evidence-core/       evidence/release/admissibility logic
packages/brief-core/          planning-brief assembly and export filtering
packages/condition-adapters/  reusable condition interface + Long COVID/ME-CFS
packages/ui/                  design tokens and reusable accessible primitives
analysis/r/                   offline survey-analysis entry points
pipelines/evidence/           structured evidence ingestion/review helpers
pipelines/data/               reproducible source ingestion helpers
conditions/                   condition-specific metadata/configuration
data/                         source manifests and raw-data instructions
artifacts/examples/           validated synthetic/illustrative development artifacts
docs/                         architecture, guardrails, implementation notes
```

## Development

The workspace uses npm workspaces. Detailed commands will be added with the application scaffold.

## Data policy

Large raw/intermediate datasets are never committed. Public-use source files belong under ignored local paths documented in `data/README.md`. Small fixture artifacts are explicitly labeled illustrative/synthetic.
