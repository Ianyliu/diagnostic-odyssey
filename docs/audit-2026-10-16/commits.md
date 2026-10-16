# Atomic commit inventory

Baseline: `0ad2c55db55d23c1f1b35b5e57db89f5fc0ba886`. Each commit is reviewable independently; none rewrites existing history.

This file lists implementation and documentation commits. The PR description also lists the final evidence commit and its exact files, avoiding a self-referential commit SHA in this file.

## `ac4d7b24b6d919c27c132493eeb40e3cf9315ee1`

test: bound Python schema validation and support explicit Chromium runners

- `packages/narrative-references/test/python-runner.test.ts`
- `packages/narrative-references/test/schema-agreement.test.ts`
- `packages/planning-guidance/test/contracts.test.ts`
- `scripts/testing/run-python-json.ts`
- `tests/browser/acceptance.mjs`
- `tests/browser/acquisition-hints.mjs`
- `tests/browser/ai-handoff.mjs`
- `tests/browser/gate0-accessibility.mjs`
- `tests/browser/planning-insights.mjs`
- `tests/browser/planning-intelligence-integration.mjs`

## `7dcc8ad3c7e551a9b6b2983b63e2ec381b16f4a5`

fix: retain unfinished Pilot drafts and recover failed JSON downloads

- `apps/web/src/data/ArtifactContext.tsx`
- `apps/web/src/pages/BriefPage.tsx`
- `apps/web/src/pages/PilotPage.tsx`
- `tests/browser/workspace-continuity.mjs`

## `38f1710d5fdcf730e288c36830bc9cd68c3b0b8d`

fix(a11y): keep numeric labels intact and enlarge disclosure targets

- `apps/web/src/components/IntervalWhiskerPlot.tsx`
- `apps/web/src/components/PilotDecisionVisuals.css`
- `apps/web/src/workspace.css`
- `tests/browser/visual-quality.mjs`

## `1249f71fbd57e26e4a5fe1db98367c2190f9dd66`

test: retain export filename assertion after download recovery repair

- `apps/web/test/phase-a-hardening.test.ts`

## `e096fc70d1a064a0708075cf70806d6a63639ae3`

design: refine landing hierarchy and workspace visual consistency

- `apps/web/src/pages/OverviewPage.css`
- `apps/web/src/pages/OverviewPage.tsx`
- `apps/web/src/workspace.css`
- `packages/ui/src/styles.css`

## `1d536533118e3eb0557f2332c797d6b920eea5c0`

feat: coordinate opening and interaction motion with accessible interruption

- `apps/web/src/components/AppShell.tsx`
- `apps/web/src/main.tsx`
- `apps/web/src/motion.css`
- `apps/web/src/pages/OpeningProvenance.tsx`
- `apps/web/src/pages/OverviewPage.tsx`
- `apps/web/test/phase-a-hardening.test.ts`
- `tests/browser/motion.mjs`

## `b724a1025f71dd082b3921ad411768bd990169bb`

fix: isolate export feedback to preserve canonical Brief timestamps

- `apps/web/src/pages/BriefPage.tsx`

## `9a13350a3243948b6f9ef02338fafc57fdeea2b5`

design: honor dark appearance throughout the workflow section

- `apps/web/src/pages/OverviewPage.css`

## `7a7e6738767ef5f8301203460dba02590296177e`

ci: retain draft export responsive and motion regression coverage

- `.github/workflows/workspace-interactions.yml`

## `8b5fb952ef921a2e0257f721271e23932473db85`

test: expect theme-aware workflow surfaces

- `apps/web/test/redesign-review.test.ts`

## `24da6f69321755fce8e4ad0d379ca3741abfbe87`

fix(a11y): retain workflow-link contrast during dark-mode interaction

- `apps/web/src/pages/OverviewPage.css`

## `8b7d04e377de498057e09bfb2495bff2ec7958f5`

docs: modernize the project guide with current features and local previews

- `README.md`
- `docs/audit-2026-10-16/screenshots/after-brief.png`
- `docs/audit-2026-10-16/screenshots/after-navigation.png`
- `docs/audit-2026-10-16/screenshots/after-overview-dark-full.png`
- `docs/audit-2026-10-16/screenshots/after-overview-dark.png`
- `docs/audit-2026-10-16/screenshots/after-overview-light.png`
- `docs/audit-2026-10-16/screenshots/after-pilot.png`
- `docs/audit-2026-10-16/screenshots/before-brief.png`
- `docs/audit-2026-10-16/screenshots/before-navigation.png`
- `docs/audit-2026-10-16/screenshots/before-overview-dark.png`
- `docs/audit-2026-10-16/screenshots/before-overview-light.png`
- `docs/audit-2026-10-16/screenshots/before-pilot.png`
- `docs/design-and-motion.md`
- `docs/testing.md`

## `ba76799091f7be79a5537ba29d917cdce670935c`

docs: replace the unavailable historical QA link with current evidence

- `README.md`
