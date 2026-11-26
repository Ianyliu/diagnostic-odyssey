# Dependency-ordered implementation plan

> **Current status (Edition 01 · Strategic Atlas):** Phases P0–P7, reviewed 2024 MEPS national burden (21 estimates + 2 Typical Ranges), reviewed statewide West Virginia HRSA + 2024 ACS context (34 indicators), specialized linked-condition `Candidate A`, Planning Insights, Strategy AI Studio, and Strategic Atlas UI consolidation (PR #150) are implemented on `main`. See [README.md](../README.md), [Architecture](architecture.md), and [Design and motion](design-and-motion.md) for current behavior.

## P0 — Architecture and contracts
1. Establish npm workspace, TypeScript baseline, ignore policy, environment template.
2. Encode canonical contracts/status vocabulary and runtime artifact validators.
3. Document scientific/release/export invariants.
4. Add condition-adapter and brief/evidence package boundaries.

## P1 — Deterministic core
1. Implement scenario validation and pure arithmetic.
2. Add golden tests for reach, capacity, person-months, program resource requirement, invalid inputs, and pathway-step isolation.
3. Add brief/release filtering that makes unreleased leakage structurally difficult.
4. Add versioned illustrative artifact bundle.

## P2 — Full shell
1. Build persistent analytical-context/header shell using Strategic Atlas hierarchy and design tokens (`packages/ui/src/styles.css`).
2. Route all product areas even where feature content is scaffold-only.
3. Represent loading/partial/suppressed/error/unsupported states consistently.

## P3 — Working vertical slice
1. Load and validate illustrative burden artifact.
2. Render Burden with explicit status/provenance.
3. Feed scenario inputs into the deterministic engine.
4. Assemble Planning Brief from the exact scenario result and released/display-safe content.
5. Export deterministic JSON companion.

## P4 — Analytical data ingestion

**2024 MEPS HC-256 national Long COVID pipeline and statewide West Virginia HRSA + ACS local-context pipeline: reviewed Edition 01 artifacts promoted and active in runtime (`21` national estimates, `2` Typical Ranges, `34` WV indicators, plus specialized linked-condition `Candidate A`); county-level context and PLACES/CMS remain deferred.**

1. Source manifests and pipeline-specific raw-data requirements are separated.
2. HC-256 acquisition/loader and frozen variable/estimand map are implemented.
3. Survey-aware person/ESAQ/PSAQ designs and Tier 1-3 estimators are implemented.
4. Candidate artifact generation, provenance validation, synthetic tests, and candidate→review→release boundary are implemented.
5. Future updates re-execute offline pipelines, inspect diagnostics/estimates, complete methods review, and explicitly promote approved candidate artifacts.
6. NHIS remains supplementary/compatibility work and is not a dependency for the primary MEPS cohort.

## P5 — Evidence and provenance
1. Structured evidence ledger.
2. Reviewer-controlled admissibility rules.
3. Data-request objects and workflow.
4. Optional grounded extraction/drafting with deterministic fallback.

## P6 — Reuse, sensitivity, export
1. ME/CFS compatibility adapter.
2. One-way sensitivity for reach/capacity/window assumptions.
3. Accessible HTML export and richer provenance audit.
4. Condition/version restore behavior.

## P7 — Visual parity and accessibility
1. Refine responsive behavior across Strategic Atlas breakpoints and light, dark, and print themes.
2. Keyboard/focus/contrast audit.
3. Accessible chart/table equivalents.
4. Final visual polish only after core route and scientific behaviors pass tests.
