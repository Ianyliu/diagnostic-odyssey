# Testing and validation strategy

## Automated now

### Contracts
- suppressed/not-released numeric leakage checks;
- scenario reach validation;
- export eligibility gates.

### Scenario engine
- golden reach/capacity arithmetic;
- capacity-constrained behavior;
- person-month exposure and horizon handling;
- invalid recognition windows;
- target pathway-step/mechanism isolation;
- one-way sensitivity behavior.

### Brief
- illustrative and suppressed estimates are excluded from export.

### Evidence
- human review + admissibility + pathway/mechanism checks gate scenario parameter use.

### Design, brand, contrast, and security
- `wcag-contrast.test.ts`: enforces `>=4.5:1` text contrast and `>=3.0:1` UI border, focus, and chart contrast across light and dark palettes in `packages/ui/src/styles.css`.
- `strategic-atlas-consolidation.test.ts`, `foundation-platform-ux.test.ts`, `lovable-visual-grammar.test.ts`, `opening-motion.test.ts`, `theme.test.ts`: enforce landing chapter order, Strategy Sandbox deterministic transfer, navigation stage labels, zero inline `style={{}}`, non-color/semantic role cues, and first-paint theme bootstrap.
- `overview-inventory-claims.test.ts` & `social-preview.test.ts`: enforce exact reviewed inventory counts, no county/work-loss overclaims, and non-numeric deterministic `og-image.png` rendering.
- `capacity-threshold-curve.test.ts` & `scenario-comparison.test.ts`: verify Strategy Lab's capacity sufficiency threshold geometry and deterministic multi-scenario comparison rows.
- `security-headers.test.ts`, `ai-guidance.test.ts`, `ai-preview.test.ts`: enforce strict CSP headers in `apps/web/vercel.json`, Preview-only `/api/ai-guidance` validation/rate-limit/replay guards, and permanent `404` retirement of `/api/ai-preview`.

### Equivalence, artifacts and tooling

- `tests/characterization` (`npm run test:characterization`): ~3,650 deterministic cases over real reviewed artifacts and boundary inputs, a type-level public API snapshot of every package, and 387 cases for the Preview-only `/api/ai-guidance` handler. Compared exactly with goldens generated from pre-refactor code ([ADR 0001](adr/0001-behavior-preserving-changes-need-exact-equivalence-evidence.md)).
- `npm run verify:artifacts`: reviewed artifacts against `scripts/verify/reviewed-artifacts.inventory.json`; fails on any missing or extra directory, manifest or file.
- `npm run test:tools`: tests of that verifier and of the documentation link checker (`npm run verify:docs`).
- `apps/web/test/api-self-contained.test.ts` and `scripts/verify/vercel-function-build.sh`: Vercel functions stay self-contained and load when built by the real builder ([ADR 0003](adr/0003-vercel-api-functions-stay-self-contained.md)).

### CI
Each push/PR runs the `CI` workflow (typecheck, unit tests, tooling tests, characterization, Python validators, reviewed-artifact inventory, ESLint, build, repeated-build byte stability, and informational coverage; plus a separate R job). Path-filtered browser, accessibility and security workflows run for relevant pull requests. See the [workflow matrix](operations/ci-workflows.md).

## Still required before analytical release

- MEPS/NHIS variable coding and universe tests;
- weighted/unweighted denominator checks;
- survey-design preservation;
- tail/extreme review;
- nested-spending reconciliation;
- reliability/suppression rules;
- external plausibility benchmarks;
- provenance completeness for every released headline result;
- accessibility/keyboard/contrast QA;
- end-to-end tests for partial/suppressed/error states;
- deterministic export leakage tests against real candidate artifacts;
- optional AI extraction benchmark if/when AI is enabled.

Passing software CI does **not** constitute scientific release approval.

## Reproduce the application checks

Use Node 22.23.3 (`.nvmrc`) and Python 3 with the pinned test dependency installed in the active environment (`python3 -m pip install -r requirements-test.txt`; `python3` must resolve to that environment). Tests never install packages. From the repository root:

```bash
npm ci
npm run check        # typecheck, lint, test, test:tools, test:characterization, verify:artifacts, verify:docs, build
npm run check:full   # plus test:py, test:r, verify:build
```

The individual steps are `npm run typecheck`, `npm run lint`, `npm test` and `npm run build`. `npm run test:offline` repeats `npm test` with outbound networking denied, which is the proof that tests are hermetic. `npm run test:coverage` writes `coverage/lcov.info` and prints a table; it is informational, with no thresholds.

R synthetic tests (`npm run test:r`) need R with `haven`, `jsonlite`, `survey` and `testthat`. CI installs the latest public binaries (unpinned); the set used for local qualification was haven 2.5.5, jsonlite 2.0.0, survey 4.5, testthat 3.3.2 on R 4.5.2.

`scripts/testing/run-python-json.ts` runs the actual Python validators with a regular-file stdin, a 15-second timeout and a 16 MiB output bound. The file descriptor avoids a reproduced sandbox pipe-EOF stall; it does not change the validator or its assertions. Missing executables/dependencies, nonzero exits, timeouts and malformed JSON fail with diagnostics. Temporary input is private and removed after execution.

## Browser acceptance

Keep browser tooling outside the production dependency tree:

```bash
npm install --prefix /tmp/odyssey-browser --save-exact playwright@1.64.0 axe-core@4.11.1
export PLAYWRIGHT_RUNNER=/tmp/odyssey-browser/package.json
# Uses installed Chrome by default. To use another Chromium executable:
# export QA_CHROME=/absolute/path/to/chromium
export QA_BASE_URL=http://127.0.0.1:4186
./node_modules/.bin/vite preview apps/web --host 127.0.0.1 --port 4186 --strictPort
```

In another terminal with the same exported variables, run suites individually to avoid resource contention during screenshot capture:

```bash
QA_OUTPUT=/tmp/odyssey-acceptance node tests/browser/acceptance.mjs
QA_OUTPUT=/tmp/odyssey-a11y node tests/browser/gate0-accessibility.mjs
QA_OUTPUT=/tmp/odyssey-continuity node tests/browser/workspace-continuity.mjs
QA_OUTPUT=/tmp/odyssey-visual node tests/browser/visual-quality.mjs
QA_OUTPUT=/tmp/odyssey-motion node tests/browser/motion.mjs
```

The continuity suite verifies an unfinished numeric draft survives route navigation while exports retain the last valid scenario, and that a failed JSON download can recover. The visual suite checks intact number/unit tokens, rendered burden topic groups, and no overflow at 320/390/768/1440px in both themes, plus keyboard menu closure and focus restoration. The motion suite checks a fresh opening, interruption, session replay suppression, deep links, reduced motion and layout stability.

Additional Strategic Atlas browser suites (run individually with the same `PLAYWRIGHT_RUNNER` and `QA_BASE_URL` exports; see also `.github/workflows/opening-circuit-qa.yml`):

```bash
QA_OUTPUT=/tmp/odyssey-opening-circuit node tests/browser/opening-circuit.mjs
QA_OUTPUT=/tmp/odyssey-landing-evidence node tests/browser/landing-evidence.mjs
QA_OUTPUT=/tmp/odyssey-guided node tests/browser/guided-workspace.mjs
python3 tests/browser/verify-guided-pdf.py /tmp/odyssey-guided
QA_OUTPUT=/tmp/odyssey-handoff-142 node tests/browser/planning-request-handoff.mjs
QA_OUTPUT=/tmp/odyssey-exports-142 node tests/browser/planning-request-exports.mjs
QA_OUTPUT=/tmp/odyssey-security node tests/browser/security-headers.mjs
QA_OUTPUT=/tmp/odyssey-workstream-h node tests/browser/workstream-h-qa.mjs
```

- `opening-circuit.mjs` & `landing-evidence.mjs`: verify Chapter I *Care Horizon*, Chapter IV *From data to action* sweeping pathway geometry and reduced-motion/interruption semantics across viewports, plus live bundle fixture integrity on the landing strata.
- `guided-workspace.mjs` & `verify-guided-pdf.py`: exercise `01 Burden`, `02 Local context`, `03 Strategy Lab`, `04 Planning Brief`, `Data requests`, `EditionDrawer`, Focus/Overview disclosures, `og-image.png` metadata, and Brief print pagination.
- `security-headers.mjs` (behind `csp-preview-proxy.mjs` locally or against an immutable Vercel Preview URL): validates CSP, MIME types, `/theme-init.js`, and absence of external network egress.
- `planning-request-handoff.mjs`, `planning-request-exports.mjs`, and `workstream-h-qa.mjs`: verify sensitivity-to-request handoff, exact JSON/PDF export parity, and fail-closed 4-mode PDF/JSON acceptance.

For Strategy AI Studio (`/advisor` and `/concept/future-ai`) and AI handoff tests, also start the isolated fixture:

```bash
./node_modules/.bin/vite --config tests/browser/ai-handoff-fixture/vite.config.mjs
# In the browser-test terminal:
QA_OUTPUT=/tmp/odyssey-handoff node tests/browser/ai-handoff.mjs
QA_OUTPUT=/tmp/odyssey-concept node tests/browser/future-ai-experience.mjs
QA_OUTPUT=/tmp/odyssey-insights node tests/browser/planning-insights.mjs
python3 -m pip install pdfplumber==0.11.7
python3 tests/browser/verify-insights-pdfs.py /tmp/odyssey-insights
```

Run all four `on`/`off` combinations of `VITE_PLANNING_INSIGHTS_PREVIEW` and `VITE_FUTURE_AI_EXPERIENCE_DEMO`; rebuild before starting each preview. Pass the corresponding `QA_INSIGHTS_MODE` and `QA_CONCEPT_MODE` to `planning-intelligence-integration.mjs`. For the concept-disabled suite, set `QA_BUILD=off` and `QA_DIST` to the exact built directory. The existing [integration workflow](../.github/workflows/planning-intelligence-integration.yml) records these combinations. Its case named `default` explicitly disables both flags; an unconfigured local build enables both.

Browser PDF generation and text/geometry checks do not certify tagged PDFs or native print dialogs. Chromium automation and axe also do not replace assistive-technology testing on real devices.

## Scientific comparison

Use separate baseline and candidate checkouts. Never write comparison output into `artifacts/reviewed`.

```bash
node --experimental-strip-types scripts/maintenance/capture-governed-regression.mjs /path/to/baseline /tmp/before.json
node --experimental-strip-types scripts/maintenance/capture-governed-regression.mjs /path/to/candidate /tmp/after.json
node scripts/maintenance/compare-governed-regression.mjs /tmp/before.json /tmp/after.json /tmp/scientific-comparison.json
node tests/browser/compare-results.mjs /tmp/before-browser/qa-results.json /tmp/after-browser/qa-results.json /tmp/browser-comparison.json
```

The governed comparison checks reviewed-file hashes, manifest entries, scenario and sensitivity snapshots, and fixed-time Brief exports. The browser comparison ignores only the Brief's top-level execution timestamp; provenance dates, selected records, requests and calculations remain compared.


## MEPS analytical synthetic tests

GitHub Actions also runs an R job that installs the declared offline-analysis dependencies and executes synthetic MEPS tests. These do **not** require or download HC-256.

Current R coverage includes:
- Long COVID round-resolution and reserved-code behavior;
- person vs ESAQ vs PSAQ weight separation;
- weighted totals, means, proportions, and interval serialization;
- weighted/unweighted denominator propagation;
- out-of-pocket component metadata to prevent double counting;
- prohibition on a combined administrative-time burden score;
- required analytical provenance before a candidate artifact can validate.

Real-data plausibility and methods review remain separate from software CI.
