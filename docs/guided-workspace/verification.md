# Guided workspace verification

## Baseline and environment

Pinned baseline: `4a86284a8791235423c92fc9608e74dbcf24e2e0`. Its Linux main CI passed (run `39086314047`). Local checks use macOS arm64, Node 22.23.3 and isolated browser/Python tooling outside the repository.

On this case-insensitive filesystem, both baseline typecheck and production build fail: the extensionless `./DemoLiterature` component import resolves to `demoLiterature.ts` before `DemoLiterature.tsx`. TypeScript reports TS1149/TS1261; Rollup reports `DemoLiteratureNotice` is not exported by the data module. This is a reproduced local portability issue, not a claim that main CI fails.

The separate portability commit renames only the component to `DemoLiteratureComponents.tsx` and updates its four consumers and source-inventory test. Afterward typecheck, production build and the concept-literature tests pass. The data module, content and behavior are unchanged.

For baseline screenshots/browser comparison, the archived pinned source uses a temporary external Vite config with an exact `./DemoLiterature` → `DemoLiterature.tsx` alias. This resolves the same local filename ambiguity without editing baseline sources. Governed snapshots use the original pinned sources. No workaround is needed in the candidate.

## Verification results

Implementation source revision: `a236354fb99b463d2af339893778da7c8c8137b2`. The final evidence commit adds this report, captured artifacts and screenshots; the draft PR records its exact final HEAD. Main was checked again before review and still points to the pinned baseline.

Local environment: macOS 26.7 arm64, Node 22.23.3, Chrome 155.0.8059.84, Playwright 1.64.0, axe-core 4.11.1, Python 3.14.7, jsonschema 4.26.0 and pdfplumber 0.11.7. Browser tooling and Python packages were installed outside production dependencies.

## Final design and deviations

- Four labeled stages orient the workspace: **Reviewed evidence** → **Local context** → **Pilot** → **Brief**. Reviewed evidence maps to `/burden`. Supporting navigation retains Overview, **Intervention evidence & limits** (`/evidence`), Data Requests and appearance settings. Pilot and Brief also link directly to intervention limits and unresolved data needs.
- The Overview retains its branded hero, evidence counts and existing opening animation. A quieter four-step progression replaces repeated orientation panels. No animation controller, replay, interruption or reduced-motion rule changed.
- Burden and local-context categories disclose detail progressively. Category summaries retain selection counts and Pilot attachment. Each expanded indicator row exposes both independent actions; provenance remains separate from selection.
- Pilot keeps all eight inputs, immediate valid calculations, last-valid results and scenario restrictions. Applied-value summaries remain visible in collapsed input groups; invalid groups open and cannot conceal errors. Four headline quantities and a small capacity-sensitivity preview precede the input form on mobile. Wide screens keep the form alongside the summary. All three original decision visuals, the full sensitivity explorer, tables, accessible alternatives and data-request actions remain available.
- The Brief reuses the deterministic PlanningInsights projection. Its three reviewed highlights, scenario interpretation, evidence readiness and next investigation action remain prominent. Extended prompts and source detail are disclosed progressively. Both AI entry points are near the heading, with distinct descriptions of manual handoff and illustrative demo; no live AI is enabled. Build flags, visitor toggle, six goals, payload fidelity, stale/regeneration behavior and print exclusions remain intact.
- The complete report stays mounted under **Read full brief**. Deep links open ancestor disclosures before focus/scroll. Print opens the entire report and restores exact disclosure choices. Testing also justified a print-scroll fix: begin at the top to retain Chromium's repeated footer, then restore the prior position after screen media returns. Printed Insights remain explicitly opt-in.
- Data-request freshness, inclusion and refresh remain visible. Collection specifications and removal sit in a per-request disclosure. Current and stale requests retain their original export rules.

Compared with the proposed direction, the first stage explicitly uses national burden, the Pilot retains four quantities and immediately visible sensitivity, and Brief summaries reuse the existing projection. The mobile navigation switches below `63.99rem` (1024px with the default font size), based on fitting all complete labels at 1024px and using compact labeled destinations at 768px and below. This replaces the proposed unverified 960px threshold. A final responsive commit fixes enlarged headings, long pathway terms and numeric displays at 320px/200% text size.

There is no material scientific or compatibility conflict. The separate case-disambiguation rename is a local portability cleanup, supported by reproduction; it does not describe main CI as failing. No reviewed artifacts, formulas, source eligibility, release gates, canonical fields, production configuration or external AI connections changed.

## Atomic commits

| SHA | Change |
|---|---|
| `809254aa838f0760bce549c0e0abc571f83f38ac` | docs: record revised guided workspace implementation plan |
| `0a0646ba192a1ca9f5450e867cc18346d3cbd718` | fix(web): disambiguate demo literature component imports |
| `98462ea3e851ea5f1f1d9d414afc7a3f8693c523` | feat(ui): orient the workspace around four accessible stages |
| `ca5a83b3c35a401c5383ee511cf53fbb53672d8d` | feat(ui): focus the branded overview on one planning journey |
| `b260f3e491219f6c86566c1bee723795c05ae6ff` | feat(ui): organize evidence categories without hiding selection actions |
| `18a5cf699fe86f1ad432b908f14acaf4b48a4782` | feat(ui): surface pilot outcomes and sensitivity with compact input groups |
| `19cededac3864ba8d3d53165055125bbef828aed` | feat(ui): lead the brief with deterministic insights and distinct AI tools |
| `bd7d5f242406ae61fcc95449e2286b9963a05624` | feat(ui): keep request decisions visible and disclose collection details |
| `9687ce9e1d48e6a91377a77cc3f69e838ed22f9d` | test(ui): verify guided layouts, collapsed printing and review captures |
| `a236354fb99b463d2af339893778da7c8c8137b2` | fix(ui): keep enlarged planning content within narrow screens |

The final evidence-only commit follows these implementation commits. Its SHA and the complete commit list are recorded in the draft PR, avoiding a self-referential commit hash in this file.

## Verification matrix

The [core results](evidence/core-results.json), [browser results](evidence/browser-results.json), [flag matrix](evidence/flag-matrix.json) and [atomic-commit results](evidence/atomic-results.json) retain machine-readable evidence. All listed checks passed on the final implementation.

| Check | Result / coverage |
|---|---|
| `npm run typecheck` | All workspaces pass |
| `npm run lint` | Exact command passes in clean checkout, zero warnings |
| `npm test` | 420 tests pass across eight packages/workspaces |
| `npm run build` | Production build passes; existing >500 kB chunk advisory remains |
| Independent atomic code commits | Every code commit passes typecheck, all unit tests and production build |
| Guided workspace | 15 groups: five widths × two themes, four stages, collapsed selections, invalid inputs, sensitivity/request loop, deep links, modal focus, collapsed PDF, exact disclosure/scroll restoration, keyboard-height simulation, 200% text enlargement, MAX_VALUE at 320px |
| Acceptance | 26 groups: direct routes, keyboard, history, selections, sensitivity, real JSON exports, stale requests, extreme finite values, invalid drafts, print restoration, loading/failure fallbacks and motion |
| Accessibility | 14 gate-0 groups, plus acceptance/Insights/concept axe checks; no reported WCAG violations |
| Workflow continuity | 2 groups: retained drafts, downloads and route continuity |
| Visual quality | 20 checks: 320, 390, 768, 1024 and 1440px × light/dark × reduced/full motion |
| Motion | 4 groups: opening, interruption, preference changes and session replay |
| AI handoff | 24 groups: six goals, copy/download, source staleness/regeneration, dialogs/focus, unavailable/invalid cases and no provider calls |
| Future AI experience | 10 enabled-build groups; disabled builds separately check routes/assets and accessibility |
| Planning Insights | 14 groups plus actual PDF inspection; repeated for the deterministic-only flag combination |
| Planning Intelligence integration | 5 groups in each of four flag combinations |
| Acquisition/data requests | 12 groups: current/stale, explicit inclusion, refresh, removal, synthetic guidance, JSON and actual PDF |
| Browser-export scientific comparison | Seven baseline/final snapshots match; only top-level execution timestamps are normalized |
| Handoff payload comparison | 39 real browser Brief exports × all six goals; canonical payload and warnings unchanged |

| Insights flag | Future concept flag | Production build | Integration | Additional checks |
|---|---|---|---|---|
| on | on | Pass | 5/5 | Full browser suite and Insights PDFs |
| off | off | Pass | 5/5 | Disabled concept route, asset exclusion, accessibility |
| on | off | Pass | 5/5 | Disabled concept checks; 14 Insights groups and PDFs |
| off | on | Pass | 5/5 | Concept availability and canonical export continuity |

The enabled/disabled combinations use the existing build-time controls. Their defaults and production settings are unchanged. Software keyboard behavior was simulated by reducing the viewport height while an input was focused; physical mobile keyboards were not available.

### Actual print/PDF evidence

The [collapsed A4 report](evidence/collapsed-report.pdf) contains all seven report sections, reviewed values, assumptions, limitations and provenance across seven pages. Its minimum measured body/footer clearance is 12.70pt. All seven pages were rendered and visually inspected for clipping, table pagination and readable hierarchy. The report starts collapsed, the optional Insights summary is absent, AI controls are excluded, and original disclosure/scroll states are restored afterward.

The existing Letter-size PDF checks pass for Insights off (7 pages), on (8), all selected local context (24), and extreme values (9). Each PDF includes a repeated footer with at least 24.70pt measured clearance. Opting into the summary does not change canonical JSON, does not include unaccepted prompts, and survives hiding the screen preview. See [PDF checks](evidence/insights-pdf-verification.json) and [collapsed-report checks](evidence/collapsed-pdf-verification.json).

### Failures found and resolved

| Finding | Resolution |
|---|---|
| Pinned baseline component/data import collision on case-insensitive macOS | Behavior-preserving component rename; separate commit; main Linux CI remains acknowledged as passing |
| Local lint scanned pre-existing ignored `.maintenance-local` generated JavaScript | Ran the exact required lint command in an isolated clean checkout; no lint configuration exemption added |
| An unconfigured Python interpreter lacked the pinned schema validator | Used an isolated Python environment with jsonschema 4.26.0; all schema-agreement tests pass |
| Existing tests assumed seven top-level links and permanently visible controls | Updated navigation helpers to use supporting navigation and open new disclosures through UI controls; a separate suite tests the default collapsed experience |
| Invalid input groups could momentarily close; native AI dialog was missed by the navigation selector | Prevent closing invalid groups and recognize native `dialog[open]`; regression checks pass |
| Early headline measurements sampled an updated off-screen value before browser rendering settled | Bring the actual headline into view before checking full-precision token containment; dedicated scientific-value styling and 320px/MAX_VALUE coverage retain every digit |
| Summary-first Pilot invalidated a source-order test, whose first match was an unrelated unavailable-input message | Match the actual assumption heading and verify the intended summary-first order |
| Scrolled print could omit the repeated footer; early afterprint could restore scroll before screen layout returned | Print from the top, retain the original scroll snapshot until screen media returns, and verify actual PDF content and exact restoration |
| 200% text at 320px exposed intrinsic grid sizing and long pathway terms | Allow Pilot grid items to shrink, wrap descriptive text and scale headline quantities within the available width; all ten width/theme text-enlargement cases pass |

The full legacy analytical suites intentionally expand new workspace disclosures before exercising their existing analytical assertions. Default visibility, required actions, deep-link opening and print from a collapsed report are independently exercised by `guided-workspace.mjs`.

## Scientific invariance

The existing governed capture/comparison scripts report **unchanged** for every section. See [governed comparison](evidence/scientific-invariance.json), [Typical Ranges](evidence/typical-ranges.json) and the [browser comparison](evidence/browser-invariance.json).

- 21 reviewed national MEPS estimates and 34 reviewed WV indicators are unchanged.
- Both reviewed Typical Ranges are unchanged: gross all-cause spending mean and healthcare-paperwork time mean.
- All 27 reviewed files and 23 manifest entries retain their hashes.
- Eleven scenario fixtures and all their reach/capacity/window sensitivity points match exactly.
- Three fixed-clock canonical Brief snapshots match exactly, including explicitly selected context/current requests and exclusion of stale requests.
- Four real browser-exported Brief states and three sensitivity tables also match, normalizing only the Brief execution timestamp. Reviewed provenance remains compared.

National burden remains national, gross costs remain non-attributable, person-month differences remain planning quantities, resources remain requirements rather than savings/ROI, missing/suppressed/unreleased values remain unavailable rather than being converted to zero, and illustrative literature remains outside admitted reviewed evidence.

## Screenshots and usability review

See the [before/after inventory](screenshots.md) for Overview, reviewed evidence, local context, Pilot, Data Requests and Brief, plus a selected-request example. Each view has desktop (1440px) and mobile (390px), both themes, full-page and initial-viewport captures.

Review focuses on a single clear progression, visible evidence roles, retained selection controls, discoverable sensitivity/data needs, distinct AI actions and typography. Disclosures add one deliberate action for secondary categories, extended provenance, report reading or export options; they do not add a disclosure step to either local selection control, the sensitivity explorer or request freshness/inclusion. The first evidence category remains open. All eight applied assumptions remain readable in group summaries. The full report remains available to anchors, printing and export.

## Reproducing the checks

Use Node 22 and a clean checkout for `npm ci`, `npm run typecheck`, `npm run lint`, `npm test` and `npm run build`. The [browser runner instructions](../../tests/browser/README.md) describe isolated Playwright/axe setup and the local production preview. The [workspace CI workflow](../../.github/workflows/workspace-interactions.yml) runs continuity, layout, motion, the new guided-workspace suite and collapsed-PDF validation. The existing AI, Insights, acquisition and feature-flag workflows retain their fixture and build setup.

For the governed comparison, create separate baseline and candidate checkouts and capture both with the existing script:

```sh
node --experimental-strip-types scripts/maintenance/capture-governed-regression.mjs BASELINE_CHECKOUT /tmp/governed-before.json
node --experimental-strip-types scripts/maintenance/capture-governed-regression.mjs CANDIDATE_CHECKOUT /tmp/governed-after.json
node scripts/maintenance/compare-governed-regression.mjs /tmp/governed-before.json /tmp/governed-after.json /tmp/governed-comparison.json
```

`tests/browser/workspace-screenshots.mjs` uses the same `PLAYWRIGHT_RUNNER`, `QA_BASE_URL` and `QA_OUTPUT` variables as the browser suites. Run it against each built revision into separate output directories. `verify-guided-pdf.py` and `verify-insights-pdfs.py` validate the resulting PDF content using pdfplumber 0.11.7. Committed JSON reports retain their original temporary output paths as execution provenance; the copied reports, screenshots and PDFs are the portable review artifacts.

## Remaining limitations and recommendation

No known regression remains in the exercised scientific or interaction contracts. Verification uses Chromium on macOS, not physical phones, Safari/Firefox or a human screen-reader study. Safe-area CSS, focus, touch target dimensions, keyboard-height simulation and 200% text reflow are covered, but real iOS/Android keyboard and assistive-technology smoke checks remain useful independent-review work. The existing large-chunk build advisory remains; this refactor does not introduce a new production dependency.

**Engineering recommendation: accept the implementation for independent review in a draft PR.** The local acceptance matrix and scientific-invariance gates pass. The screenshots support the intended calmer hierarchy while retaining analytical depth; this is an engineering/design assessment, not a user-study finding. No merge, deployment, production configuration change or public submission-site change was performed.
