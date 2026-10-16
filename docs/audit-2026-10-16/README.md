# Comprehensive audit · 16 October 2026

**Scope:** reliability, scientific boundaries, accessibility, product design, motion and documentation. This is a software audit, not a new scientific admission or production-release approval.

- [Verification matrix](verification.md)
- [Scientific invariance](scientific-invariance.md)
- [Atomic commit inventory](commits.md)
- [Design decisions and research](../design-and-motion.md)
- [Machine-readable evidence](evidence/)

## Baseline and integration

The audited and branch-creation baseline is `main@0ad2c55db55d23c1f1b35b5e57db89f5fc0ba886`. Remote main was rechecked during verification and remained at that SHA. Work is isolated on `audit/reliability-ui-motion-20261016`; existing histories were not rewritten. The original local implementation branch is retained; this publication branch copies its atomic patches with Codex’s public no-reply identity after GitHub rejected the workspace’s private-email identity.

| Related PR | Reconciliation |
| --- | --- |
| [#110](https://github.com/Ianyliu/diagnostic-odyssey/pull/110) | Integrated at `d141256d6f77d854bd0dce8f66aba2c39e03153a`, an ancestor of the baseline. Three-tool integration and reversible concept controls retained. |
| [#112](https://github.com/Ianyliu/diagnostic-odyssey/pull/112) | Integrated at the baseline. All-six-goal canonical JSON/complete Markdown parity and stale regeneration retained and rerun in all four build combinations. |
| [#113](https://github.com/Ianyliu/diagnostic-odyssey/pull/113) | Inspected head `9cc5a2115f72037038b943a1a49d10a0314f7158`. No edits to its concept implementation, literature content, concept test, Future AI browser runner or preview documentation. Compatibility is checked in a disposable checkout; this does not merge the PR. Demonstrations remain illustrative and scientifically unadmitted. |
| [#94](https://github.com/Ianyliu/diagnostic-odyssey/pull/94) | Inspected older head `a77e2ff03971c32e3f268408e41061d6b9e9f9ad`. Current main already independently contains overflow/finite-value protections, browser-media fallbacks, theme-color synchronization, chart semantics and print repairs. Those fixes were not blindly cherry-picked. Numeric display fragmentation remained reproducible. |
| #102, #103, #106 | Open CI-verdict/security, release-readiness and concept-spec work was inspected for overlap. This branch does not alter their files, production hosting or release behavior. |

## Confirmed defects and repairs

Severity describes impact; P0/P1/P2 is the requested execution priority, not an assertion that every issue is a critical incident.

| ID · priority · severity | Reproduction / evidence | Repair and verification |
| --- | --- | --- |
| T01 · P0 · high for test reliability | Both Python agreement suites used unbounded synchronous subprocesses. A minimal stdin-reading Python child stalled under the restricted execution sandbox even for empty input; ordinary-file stdin completed. Python/schema dependencies and standalone schema execution worked. The interrupted baseline run was not counted as passing. | Shared real-Python harness uses private temporary-file stdin, 15 s timeout, SIGKILL, bounded output and actionable exit/stderr/JSON diagnostics. Tests exercise missing executable/dependency, malformed output, large Unicode input and a real timeout. Full unit suite passes without skipping assertions. |
| F01 · P0 · medium | Apply capacity `2400`, leave an unfinished `2e` draft, visit Brief and return. Baseline loses `2e`; the last valid scenario remains `2400`. Both states matter to the analyst. | Draft state now lives in the existing workspace provider. Navigation preserves the draft while calculations/exports continue to use the last valid scenario. Baseline continuity test fails; repaired test passes and repair to `1800` applies normally. No new persistence of analyst data. |
| F02 · P0 · medium | Force `URL.createObjectURL` to throw and click Export JSON. Baseline has an unhandled page error and no recovery feedback. | Download control catches failures, announces recovery, keeps the Brief intact, attaches/removes its anchor and defers object-URL revocation. Browser test restores the API and successfully downloads afterward. |
| U01 · P1 · medium | Default Pilot displays `$1,200,000` across two lines at 768px and 1440px; `6 mo` splits at 1440px, in both themes. DOM Range geometry proves fragmentation. | Flexible card headings give whole tokens their own line when necessary. Numeric labels and time/CI units remain together. All eight 320/390/768/1440px × light/dark rows pass with no page overflow. |
| U02 · P1 · low | Small disclosure and mobile-menu targets make touch interaction unnecessarily precise; some focus styling excludes textareas. | Key controls/disclosures use 44px targets, visible focus includes textareas, and the mobile brand remains identifiable. Keyboard activation, Escape, focus restoration and disclosure content retention pass. |
| D01 · P2 · medium | README omits integrated Insights/handoff/concept behavior, Python test prerequisites and precise build-flag semantics, and presents historical QA as current. | README now distinguishes implemented tools from previews, documents Node/Python/R, build modes and release boundaries, and links revision-specific evidence and repository-local screenshots. |

The full handoff regression caught a timestamp drift introduced by the first download-feedback implementation. Feedback is now isolated inside the export control so it cannot recompose the canonical Brief. Existing strict parity assertions were retained and the complete suite rerun; timestamp drift was not normalized away to pass that test.

## Enhancement opportunities implemented

- **Hierarchy:** clearer landing-page typography, restrained editorial emphasis, coordinated spacing and an obvious primary workflow. Evidence counts and provenance remain visible.
- **Consistency:** shared surfaces, stronger secondary-control hierarchy, readable metric captions and intact numerical labels. Dark mode now covers the workflow section and hover text as well as the hero.
- **Motion:** staggered opening, workspace reveal, navigation-heading and dialog feedback, hover/press transitions. Input cancels the opening immediately; reduced motion, deep links and session replay suppression are preserved. No additional production package or remote font.
- **Maintainability:** the new browser regressions have a dedicated read-only CI workflow. Scientific and concept code is not broadly refactored.

## Security findings and residual risks

`npm audit --json` still reports **two moderate package entries**, `react-router` and `react-router-dom`, originating in two upstream router advisories:

| Advisory | Reachability assessment | Disposition |
| --- | --- | --- |
| [GHSA-wrjc-x8rr-h8h6](https://github.com/advisories/GHSA-wrjc-x8rr-h8h6) · backslash open redirect | Requires an untrusted destination reaching Link/useNavigate. Current application routing uses developer-defined internal paths; no user-controlled redirect target was found. | Potential dependency risk, not a reproduced app exploit. Monitor the supported fix path. |
| [GHSA-337j-9hxr-rhxg](https://github.com/advisories/GHSA-337j-9hxr-rhxg) · SSR error deserialization | Current app is client-rendered with BrowserRouter/createRoot, not SSR hydration. The affected server/hydration path is absent. | Potential dependency risk; reconsider if SSR is introduced. |

The installed router is 6.30.6; the audit reports `fixAvailable: false` and advisory ranges extending below 7.18.0. A forced major migration is not a minimal supported patch. Manifests and lockfile are unchanged, audit warnings are retained, and an isolated `npm ci` reproduces the dependency tree. No separate security-change PR is created because there is no dependency/security-architecture patch to review.

Source review and browser request monitoring found no live provider API calls or model-token use. Source links are explicit, exports remain local Blob downloads, and hostile handoff text remains inert. Future AI content cannot become reviewed evidence or automatically select/change analyst requests. No production hosting, feature defaults, scientific artifacts, framework or live-AI availability is changed.

The default main JS chunk remains above Vite's 500 kB advisory threshold (about 571 kB minified / 138 kB gzip). This is a performance opportunity, not a measured production Core Web Vitals failure. Broad code splitting was deferred to avoid an unjustified architectural change in this repair pass.

## Before / after

Captured from the pinned baseline and the repaired production build with the same browser, viewport and appearance. Screenshots contain reviewed aggregate evidence and default analyst assumptions, not patient data.

| Surface | Before | After |
| --- | --- | --- |
| Landing · light · 1440px | [Baseline](screenshots/before-overview-light.png) | [Revised](screenshots/after-overview-light.png) |
| Landing · dark · 1440px | [Baseline](screenshots/before-overview-dark.png) | [Revised](screenshots/after-overview-dark.png) |
| Pilot planner | [Baseline](screenshots/before-pilot.png) | [Revised](screenshots/after-pilot.png) |
| Planning Brief | [Baseline](screenshots/before-brief.png) | [Revised](screenshots/after-brief.png) |
| Responsive navigation · dark · 390px | [Baseline](screenshots/before-navigation.png) | [Revised](screenshots/after-navigation.png) |

![Revised landing](screenshots/after-overview-light.png)

## Review recommendation

**CONDITIONAL GO** for the scoped audit PR: review the recorded checks and ensure required remote CI is green on the exact PR head. The remaining moderate dependency advisories are disclosed with the reachability assessment above. Real-device assistive technology, non-Chromium engines, native print dialogs and production field performance are not certified by these checks.

This recommendation authorizes neither merge nor deployment. Both remain subject to the owner's separate approval. PR #113's literature admission and scientific review remain outside this presentation/reliability change.
