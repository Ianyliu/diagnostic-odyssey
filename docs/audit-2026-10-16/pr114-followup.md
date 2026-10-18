# PR #114 · remote CI follow-up

The original published head `24e8246f6d74dac1ef93672cdab8a442e7fe0230` was **not entirely green**. Local verification used a different system font and missed a real 320px overflow. This supplement preserves that failure and subsequent attempts. Final remote status and the substantive review verdict must be read on the exact current [PR head](https://github.com/Ianyliu/diagnostic-odyssey/pull/114); a successful draft-review workflow is not a code-review approval.

## Reconciled revisions

During the follow-up, the owner advanced the PR through `c23104d565d2669c64fc8f541a10b6787777887b` and then `df8bee384c38a2e30040a0f035d474dc09fe7249`, including the integration merge `f7573dc`, the initial layout repair `fa78872`, diagnostics `2442fca`, heading break `0ae4ba5`, and extreme-heading refinement `c23104d`. The latter applies a 13px ledger font. All owner commits are preserved as ancestors. The final repair was created in a new worktree from `df8bee3`; the earlier unpublished local repair remains on its original branch. No published history was rewritten. The final 14–18px responsive scale improves readability over the fixed 13px interim repair.

Main at initial reconciliation: `6f6ced9fd71054fdd4e7576162121f1ca6a025b5`. It includes #113 at `1c885c6` and #115's source footer. That main is an ancestor of the repaired branch, so the full checks exercise the integrated literature concept and source footer directly. The earlier disposable-checkout compatibility evidence remains historical evidence, not the latest integration result.

## Confirmed defects and resolution

| Defect | Reproduction and impact | Resolution |
| --- | --- | --- |
| U03 · P1 · medium: default Pilot overflows at 320px | Original [Workspace run](https://github.com/Ianyliu/diagnostic-odyssey/actions/runs/38902264959) failed both 320px themes. Native Ubuntu 24.04, Chrome 155.0.8059.84 and DejaVu Sans reproduce exactly those two failures; 390/768/1440px pass. The heading's unbroken `recognition/navigation` sets the implicit grid track to 307.156px, beyond the 246px card content area. Its right edge reaches 344.156px and document width is 344px. | Owner's explicit `minmax(0,1fr)` track and `<wbr />` at the slash allow a 246px heading and a 320px document. Text, accessible name and numerical tokens remain intact. No page clipping was added. |
| U04 · P1 · medium: extreme finite currency exceeds its ledger row | At `c23104d`, both [AI Handoff](https://github.com/Ianyliu/diagnostic-odyssey/actions/runs/38938965308) and [Future Experience](https://github.com/Ianyliu/diagnostic-odyssey/actions/runs/38938964963) fail the shared acceptance test. `$1.7976931348623157e+308` measures 297.141px at 18px font size inside a 286px row at 360px viewport width. The concept-specific tests themselves pass. | Scientific-notation ledger text uses `clamp(.875rem, 5cqi, 1.125rem)` against its result card. At 320px, the complete token measures 231.109px inside 246px; no digits are shortened or hidden. |
| U05 · P1 · medium: extreme chart headline overflows narrow columns | Extending the same MAX_VALUE test to the 320px matrix exposed the resource headline's fixed size; a narrow column in the desktop three-column layout is also vulnerable. | Each decision visual establishes inline-size containment; its scientific headline uses the same bounded font scale against its own column. Ordinary metrics retain their existing typography. |

The font difference explains the missed local failure: the original environment resolves `system-ui` to OpenAI Sans; Ubuntu uses wider DejaVu Sans. Reproduction used native Ubuntu font resolution, not injected production CSS. Local isolation probes applied temporary styles only to identify the cause.

The visual runner now covers **320/390/768/1440px × light/dark × reduced/full motion**, including MAX_VALUE Pilot tokens. The overflow assertion remains strict. Failure evidence includes route, viewport/document widths, element and parent bounding boxes, computed grid/min-width/wrapping/font styles, JSON and screenshots. Intentional local table scroll regions are distinguished only in diagnostic reporting, never excluded from the document-width assertion. Mobile navigation opening, Escape and focus restoration are checked in both motion modes.

## PR #114 disposition and follow-up branch

While this session was paused, PR #114 was marked ready, received [Jules `VERDICT: approve`](https://github.com/Ianyliu/diagnostic-odyssey/pull/114#issuecomment-6221362208), and was merged externally. Its final head is `df8bee384c38a2e30040a0f035d474dc09fe7249`; the merge on current main is `917b4712f33db1f9ded4016efc37e1213ca77a8d`. The assistant did not merge or deploy it. The Copilot review was quota-limited and is not counted as a review verdict.

All applicable required CI workflows passed on `df8bee3`; [exact run records](evidence/pr114-followup/merged-head-ci.json) retain the links and head SHAs. [Jules run 38942321887](https://github.com/Ianyliu/diagnostic-odyssey/actions/runs/38942321887) performed the substantive review after readiness. The preceding draft review success was a skip.

The remaining extreme-headline correction and expanded diagnostics are delivered separately on `fix/pilot-extreme-reflow-20261016`, created from `main@917b471`. Its original repair patch was copied with `git cherry-pick` into a new commit; the earlier local branches remain intact. The original #114 verdict does not stand in for review of the follow-up.

## Atomic repair

`5c77bd34d9e4b37360d7743700d37fa3691c05d1` — `fix(ui): fit complete scientific tokens to Pilot columns`

Exact changed files:

- `apps/web/src/pages/PilotPage.css` — scale complete scientific ledger values with result-card width.
- `apps/web/src/components/PilotDecisionVisuals.css` — scale the scientific resource headline within its own column.
- `tests/browser/visual-quality.mjs` — computed-style diagnostics, 16 theme/motion/width cases, full extreme-token checks, mobile menu overflow.

The separate CI commit adds `apps/web/src/**/*.css` to `.github/workflows/ai-handoff-core.yml` triggers. The original follow-up's CSS-only diff would otherwise omit that required workflow even though a stylesheet caused its shared acceptance failure. No assertions, job steps, release behavior or production configuration are changed.

## Evidence and commands

- [Original eight-row reproduction](evidence/pr114-followup/original-head-ubuntu.json): two failures, six passes.
- [Original element geometry](evidence/pr114-followup/original-overflow.json) and [before/after geometry](evidence/pr114-followup/default-layout-geometry.json).
- [Extreme-token isolation](evidence/pr114-followup/extreme-token-probe.json) and [remote failure excerpts](evidence/pr114-followup/remote-c231-failures.txt).
- [Scientific comparison](evidence/pr114-followup/scientific-invariance.json) and [unchanged moderate dependency audit](evidence/pr114-followup/dependency-audit.json).

| 320px Pilot | Before · failed head | After · integrated repair |
| --- | --- | --- |
| Light | [Screenshot](screenshots/pr114-followup/before-pilot-320-light.png) | [Screenshot](screenshots/pr114-followup/after-pilot-320-light.png) |
| Dark | [Screenshot](screenshots/pr114-followup/before-pilot-320-dark.png) | [Screenshot](screenshots/pr114-followup/after-pilot-320-dark.png) |
| Extreme ledger · light | [Before](screenshots/pr114-followup/before-extreme-ledger-320.png) | [After](screenshots/pr114-followup/after-extreme-ledger-320.png) |

Local tooling: Node 22.23.3, Python 3.12.14 with jsonschema 4.26.0 and pdfplumber 0.11.7; Chrome 155.0.8059.84 in Ubuntu 24.04; isolated Playwright 1.64.0 and axe-core 4.11.1. The browser container uses the repository's built assets and the native Ubuntu fonts. The workspace's existing production dependencies and lockfile were retained.

```bash
npm run typecheck
npm run lint
npm test
npm run build
# Against a frozen production preview with QA_BASE_URL and QA_OUTPUT set:
node tests/browser/acceptance.mjs
node tests/browser/workspace-continuity.mjs
node tests/browser/visual-quality.mjs
node tests/browser/motion.mjs
node tests/browser/gate0-accessibility.mjs
# AI handoff additionally serves tests/browser/ai-handoff-fixture/vite.config.mjs:
node tests/browser/ai-handoff.mjs
node tests/browser/future-ai-experience.mjs
node tests/browser/planning-insights.mjs
node --experimental-strip-types tests/browser/verify-ai-handoff-exports.ts "$QA_OUTPUT"
python3 tests/browser/verify-insights-pdfs.py "$INSIGHTS_OUTPUT"
pdftotext -layout "$HANDOFF_OUTPUT/default-closed.pdf" /tmp/closed.txt
pdftotext -layout "$HANDOFF_OUTPUT/default-open.pdf" /tmp/open.txt
cmp /tmp/closed.txt /tmp/open.txt
node --experimental-strip-types scripts/maintenance/capture-governed-regression.mjs . /tmp/governed.json
node scripts/maintenance/compare-governed-regression.mjs \
  docs/audit-2026-10-16/evidence/baseline-governed.json /tmp/governed.json /tmp/invariance.json
```

### Completed local verification

Local browser results below use production assets from a source tree byte-identical to the final repair's `apps/web/src` tree. They were captured before publication, so their candidate metadata must not be represented as exact-head remote CI. TypeScript, lint, unit and build checks were also repeated on the clean repair worktree. Remote verification belongs to the new follow-up head and is reported in its PR.

| Check | Result | Evidence |
| --- | --- | --- |
| Clean lockfile install | PASS | [Log](evidence/pr114-followup/final-clean-install.log); no dependency edits |
| TypeScript / lint / full unit suite / build | PASS | [TypeScript](evidence/pr114-followup/repair-typecheck.log), [lint](evidence/pr114-followup/repair-lint.log), [unit](evidence/pr114-followup/repair-unit.log), [build](evidence/pr114-followup/repair-build.log); existing chunk-size advisory remains |
| Complete browser acceptance | 26 PASS | [Result](evidence/pr114-followup/acceptance.json) |
| Workspace continuity / visual / motion | 2 / 16 / 4 PASS | [Continuity](evidence/pr114-followup/workspace-continuity.json), [visual](evidence/pr114-followup/visual-quality.json), [motion](evidence/pr114-followup/motion.json) |
| Accessibility | 14 PASS | [Result](evidence/pr114-followup/gate0-accessibility.json) |
| AI handoff / Future AI / Planning Insights | 24 / 10 / 14 PASS | [Handoff](evidence/pr114-followup/ai-handoff.json), [concept](evidence/pr114-followup/future-ai-experience.json), [Insights](evidence/pr114-followup/planning-insights.json) |
| Export contract | PASS: six exports × six goals | [Log](evidence/pr114-followup/final-candidate-export.log) |
| Actual PDFs | Four PASS; handoff-open/closed extracted text identical | [PDF geometry/content](evidence/pr114-followup/pdf-verification.json) |
| Governed comparison | Unchanged | [Result](evidence/pr114-followup/scientific-invariance.json) |

The four build combinations are covered by the existing exact-head Planning Intelligence workflow: both flags `on/on`, `on/off`, `off/on`, `off/off`, each independently built and previewed. The AI Handoff workflow reruns the complete workspace suite, browser acceptance, accessibility, all six handoff goals and open/closed PDF text parity. Future Experience checks the integrated #113 content, visitor toggle, both themes, canonical export isolation and zero provider traffic. Workspace executes all three interaction suites. No failed or cancelled job is treated as a pass.

## Scientific invariance

All four governed section hashes still match `0ad2c55`: 21 national MEPS estimates, 34 West Virginia indicators, both Typical Ranges, all 27 reviewed files, 23 manifest entries, 11 scenarios with sensitivity tables and three fixed-time canonical Briefs. See the [hash inventory](scientific-invariance.md#reproducible-hashes) and new machine-readable comparison above. No analytical implementation, serializer, source eligibility rule or reviewed data was changed by these repairs. The source footer from #115 identifies the build revision; it is expected presentation metadata, not a change to scientific outputs.

## Security disposition

`npm audit --json` still exits 1 with two moderate package entries (`react-router` and `react-router-dom`, version 6.30.6), zero high/critical entries and `fixAvailable: false`.

- **GHSA-wrjc-x8rr-h8h6:** no attacker-controlled destination reaches `Link`, `Navigate` or `useNavigate`. AppShell, journey, decision rail and concept explanation destinations are developer-defined routes. `DecisionTrace` callers pass `/pilot#sensitivity` and `/data-requests`. Planning Insights constructs request links with the fixed `/data-requests#request-title-` prefix; the identifier affects only the fragment, not origin/path. No `useNavigate` call or query-driven redirect exists.
- **GHSA-337j-9hxr-rhxg:** `main.tsx` uses `createRoot` and `BrowserRouter`; there is no server rendering, hydration payload or affected error-deserialization path. The source-revision build metadata does not introduce SSR.

Accept the current bounded exposure for this PR, with both advisories still disclosed. Monitor upstream supported patches and reassess before introducing untrusted navigation or SSR. The reported fix begins in a different router major (7.18.0); a forced migration is not a justified minimal repair. No warning suppression or dependency upgrade was performed. Manifests/lockfile are byte-identical to the pinned baseline. Browser monitoring continues to require zero external provider requests; literature examples remain illustrative and excluded from reviewed evidence and canonical exports.

## Failure history and limits

The first host PDF verification could not write into the container-owned output directory; it was rerun against a host-owned copy of the same PDFs and passed. The first clean install used an unwritable default npm cache; the explicit workspace cache completed. Neither failed attempt is counted as a pass.

The original remote 320px failure, the subsequent extreme-ledger failure at `c23104d`, and the expanded test's extreme-headline failure remain recorded. An initial scratch screenshot used an out-of-viewport clip and was retried with an explicit scroll; it was not application evidence. A local scratch script could not obtain a revision from the minimal Ubuntu image because Git was absent; the browser process continued, and candidate evidence is identified by source revision in this report rather than claiming that metadata field as an exact SHA.

Browser automation does not certify screen-reader interaction, Safari/Firefox, real-device touch, tagged-PDF accessibility or production field performance. No merge, deployment, hosting change, live AI activation or scientific admission is performed by this follow-up. The merge recommendation remains conditional until all required remote jobs and a substantive review are green on the same current head.
