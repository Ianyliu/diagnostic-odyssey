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

### CI
Each push/PR runs TypeScript checks, unit tests, ESLint, and the Vite production build.

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

Use Node 22 and Python 3 with `jsonschema==4.26.0` installed in the active environment (`python3` must resolve to that environment). From the repository root:

```bash
npm ci
npm run typecheck
npm run lint
npm test
npm run build
```

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

The continuity suite verifies an unfinished numeric draft survives route navigation while exports retain the last valid scenario, and that a failed JSON download can recover. The visual suite checks intact number/unit tokens and no overflow at 320/390/768/1440px in both themes, plus keyboard menu closure and focus restoration. The motion suite checks a fresh opening, interruption, session replay suppression, deep links, reduced motion and layout stability.

For AI handoff tests, also start the isolated fixture:

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
