# Lovable-informed visual-language experiment (2026-11-11)

**Status:** exploratory UI branch, not accepted for production, scientific approval, or release.

**Branch:** `research/lovable-design-language-20261111`  
**Target base:** `main` at `832f89628f1125a01e049e45cad32c10cbe93e76`  
**Design reference:** [Lovable concept / code](https://github.com/Ianyliu/screenshot-to-pixel-perfect-2257), snapshot `4a0ccb910fef67137827ba1980bc73f7f1a7d292`  
**Main product:** `Ianyliu/diagnostic-odyssey`

## Goal and non-goals

Adopt select **design ideas** rather than transplanting the Lovable app:

1. Editorial typographic hierarchy, retaining the existing readable body font and light/dark theme.
2. A legible **semantic visual grammar** that distinguishes reviewed national findings, reviewed state/local implementation context, analyst-supplied assumptions, and unresolved data needs.
3. Narrative continuity in the existing four-stage workflow, not a replacement with a mandatory six-station wizard.
4. Restrained paper/ruled-surface presentation of the canonical Planning Brief, without altering print output, provenance, or exports.

The original app already has a warm canvas, editorial headings, a provenance circuit, and four-stage navigation. Reuse these. The reference's exact palette, fonts, mock datasets, React/TanStack architecture, and novel business logic are **not** imported.

**Not in scope:** changing scientific values, survey methods, source manifests, scenario arithmetic, data-request opt-in, evidence gating, canonical Brief structure/JSON, experimental AI claims, release features, or any route contracts.

## Initiated on this branch

| File | Change | Risk |
| --- | --- | --- |
| `apps/web/src/pages/OverviewPage.tsx` | Four static, explanatory semantic cards inside the existing evidence-role section | Presentation only; no conditional scientific state or values |
| `apps/web/src/pages/OverviewPage.css` | Four-column desktop layout with existing two-/one-column breakpoints; solid reviewed/context, hatched assumption, dashed unknown; restrained editorial headings | Style-only; responsive QA required |
| `apps/web/src/pages/BriefPage.css` | Screen-only editorial title/section typography, paper-like elevation, and ruled provenance strip | Style-only; confirm print and PDF remain unchanged |
| `apps/web/test/lovable-visual-grammar.test.ts` | Source-level assertions for required distinctions and scoped screen-only brief rules | Not a substitute for browser acceptance |

These cards describe *categories and interpretation rules*, not the actual presence or admissibility of a specific datum. The overview continues to derive its actual reviewed-count displays from the existing validated artifact and release gates.

**No external assets or Lovable files were copied.** No new dependencies, routes, data, backend calls or AI functions were added.

## Scientific invariants

- A national MEPS estimate must not be repurposed as a West Virginia burden estimate.
- Reviewed local HRSA/ACS information describes **implementation context**, not disease prevalence.
- Reviewed/released, preliminary, suppressed, missing and illustrative data states retain their existing admissibility rules; no missing value becomes zero.
- An analyst's scenario input is not observed effectiveness, a forecast, a causal estimate, savings, or ROI.
- Data requests enter the canonical Brief only with the existing explicit opt-in and stale-selection checks.
- Do not modify `packages/contracts`, `packages/scenario-engine`, `packages/evidence-core`, `packages/brief-core`, analysis pipelines, reviewed artifacts, or any scientific interpretation strings outside a separately reviewed change.
- `VITE_FUTURE_AI_EXPERIENCE_DEMO=off` must still exclude the concept and its route.

## Codex implementation and verification handoff

Work **only** on `research/lovable-design-language-20261111`. First inspect the exact branch HEAD and check for concurrent writes; do not reset/force-push or merge. Review the implementation above and the existing browser test contracts.

### Pass 1 — qualification and small repairs

1. Use Node >=22, run `npm ci`, `npm run typecheck`, `npm test`, `npm run lint`, and `npm run build`, recording actual exit codes and failures. Run the repository's existing browser/a11y scripts in `docs/testing.md` as appropriate.
2. Test Overview and Planning Brief in light/dark at **360, 768, 1024, and 1440px**, with reduced motion and keyboard navigation. Check typography, wrapping, contrast, focus, card overflow and that all four role cards remain readable. Check baseline 320px too if feasible.
3. Compare generated HTML and PDF Briefs before/after this visual branch: no missing or duplicated information, no altered print pagination/readability that would compromise existing browser/print acceptance, unchanged canonical JSON and source selection behavior. The new brief rules are `@media screen` only.
4. Check the existing four numbered primary stages and separate Data Requests companion, including desktop/mobile navigation, routes, `aria-current`, focus, keyboard targets, and no collisions. Preserve the accepted navigation regression contract.
5. If styles fail, repair **only** scoped visual rules. Do not paper over failures by relaxing acceptance assertions. Commit each small repair and report exact results.

### Pass 2 — optional guarded design expansion (separate commits, after Pass 1)

- Extend semantic role cues into the Burden, Pilot, Data Requests and Brief screens **only** where state and source identity can be derived from existing authoritative contracts. Never apply a reviewed visual indicator to an unreviewed record.
- Explore step-to-step narrative cues using the *existing* four main routes. Do not add six mandatory stations or hide Data Requests in Pilot.
- Refine screen-side Planning Brief as an editorial document without touching `brief-core`, printing, release restrictions, or export contents.
- Avoid adding new webfonts until network fallback, Cumulative Layout Shift, licenses, bundle size, and a11y have been assessed. The current experiment uses the existing serif fallback.

### Required handoff evidence

Provide: git SHA, exact changed paths, test commands/results, before/after screenshots (light/dark desktop/mobile), contrast findings, keyboard/a11y check, print comparison, any unresolved regressions, and an explicit GO/HOLD recommendation **for design review only**. Do not open a production release or merge into main. Preserve a failing receipt when appropriate rather than presenting unrun tests as passing.

## Ownership and limitations

The initiating assistant used the connected GitHub interface to author/review source and make branch commits. It **did not** run a local build, test runner, Playwright, browser comparison, or PDF visual inspection. Such work needs a code-execution agent/environment like Codex with repository checkout and a real browser, followed by independent human review. Artistic acceptance, accurate branding, final color/typography approval, and production adoption remain owner decisions.

## Suggested evaluation question

Does the visual grammar make the difference between **fact**, **implementation condition**, **assumption**, and **open question** more obvious without reducing trust, legibility, or scientific accuracy? Test with real users; do not infer success solely from screenshot attractiveness.
