# Gate 0 exact-baseline rendered QA

Use Node 22. Install the browser runner outside the repository (no application dependency changes):

```sh
npm install --prefix /tmp/diagnostic-browser-runner --save-exact --no-audit --no-fund @playwright/test@1.64.0 axe-core@4.11.1
npm install --no-audit --no-fund
npm run typecheck
npm test
npm run lint
npm run build
(cd apps/web && ../../node_modules/.bin/vite preview --host 127.0.0.1 --port 4177 --strictPort)
```

In a second terminal, against this production preview:

```sh
PLAYWRIGHT_RUNNER=/tmp/diagnostic-browser-runner/package.json QA_SOURCE_ROOT="$PWD" QA_BASE_URL=http://127.0.0.1:4177 QA_OUTPUT=/tmp/gate0-results node tests/gate0/acceptance.mjs
PLAYWRIGHT_RUNNER=/tmp/diagnostic-browser-runner/package.json QA_SOURCE_ROOT="$PWD" QA_BASE_URL=http://127.0.0.1:4177 QA_OUTPUT=/tmp/gate0-results node tests/gate0/supplemental.mjs
```

For the immutable baseline, run these scripts from a separate QA checkout and set `QA_SOURCE_ROOT` to the baseline checkout. Never substitute a deployment or another source revision. This baseline has no committed lockfile: retain the resolved lock and dependency tree with the execution evidence, then install the corrections with that same lock for comparison.

The 108-row route matrix covers the nine requested routes at 1440, 768 and 390 px in explicit light/dark and System with both OS color preferences. Each row saves a full-page screenshot and checks normal/reduced-motion overflow. Functional checks use actual UI-generated JSON downloads, exact sensitivity values, stale request exclusion/refresh, keyboard-only controls, error states and Chromium print PDFs. Axe runs all nine routes in both themes, with expanded disclosures at tablet/mobile widths. Incomplete axe checks and PDF page images require human inspection. Accessible names and DOM announcements are tested; this does not certify VoiceOver/NVDA speech or native print-dialog interaction.

Fault injection changes only a known version marker in a disposable browser JavaScript response, asserting that replacement occurred and the real error UI fails closed. It never edits reviewed artifacts or supplies invented estimates. The theme bootstrap test intentionally aborts application JS. Those expected failures remain in the console/network evidence and must be distinguished from ordinary navigation failures. Context closure can also cancel in-flight requests.

`QA_FILTER` is for debugging only; omit it in a final run. Compare baseline and corrected normal-workflow exports, ignoring only the generated timestamp:

```sh
node tests/gate0/compare-results.mjs /tmp/gate0-baseline/qa-results.json /tmp/gate0-results/qa-results.json /tmp/gate0-governed-comparison.json
```

The primary acceptance runner was adapted from the existing workspace runner at `e27403af8d878327d28ead2b6f7aeb00657c5239`. Application execution and scientific fixtures are always drawn from the separately identified source checkout. No scientific assertion was relaxed. The supplemental causation matcher recognizes the actual reviewed phrase “does not establish causation”; its initial false-positive result is retained in the execution artifacts.
