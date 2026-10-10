# Rendered acceptance checks

Run against a production build, using Node 22 and system Google Chrome. The
runner dependencies live outside the repository so they do not change the
application lockfile or production bundle:

```sh
npm install --prefix /tmp/diagnostic-browser-runner --save-exact --no-audit --no-fund @playwright/test@1.64.0 axe-core@4.11.1
npm ci
npm run build
(cd apps/web && ../../node_modules/.bin/vite preview --host 127.0.0.1 --port 4175)
# In another terminal:
PLAYWRIGHT_RUNNER=/tmp/diagnostic-browser-runner/package.json \
QA_BASE_URL=http://127.0.0.1:4175 \
QA_OUTPUT=/tmp/diagnostic-browser-results \
node tests/browser/acceptance.mjs
```

Alternatively start Vite preview from `apps/web` with the root-installed binary:
`../../node_modules/.bin/vite preview --host 127.0.0.1 --port 4175`.
Set `QA_BASE_URL=https://diagnostic-odyssey.pages.dev` for the same live-site checks.
The suite visits pages and downloads client-generated files; it does not mutate
server data or repository artifacts. Browser and localhost access may require the
execution environment's normal approval.

The runner exits nonzero for any failed matrix row. It emits `qa-results.json`,
`qa-matrix.md`, 24 route/theme/viewport screenshots, fault-state screenshots,
a print screenshot/PDF, actual JSON exports, and light/dark axe reports. Keep
baseline and repaired output directories separate. Reviewed national findings,
scenario arithmetic, and three sensitivity tables have exact regression checks.
Actual parsed JSON must preserve finite numeric scenario fields. Valid zeros,
invalid drafts, explicit local-context/request selection, stale exclusion and
refresh, history, focus, theme persistence, reduced motion, browser API failures,
and disclosure restoration are exercised in Chrome.

Fault injection is limited to the intercepted JavaScript response in a disposable
browser context. It corrupts the known national/local artifact-version marker to
exercise the real production error UI and fail-closed behavior. The loading test
observes the actual initial loading DOM commit before synchronous bundled-artifact
validation; it does not claim a persistent loading paint or invent network fetching.
Both techniques assert their expected state, so a changed build shape fails
visibly instead of silently skipping the check.

Axe checks WCAG A/AA rules, including rendered contrast, across all 11 routes and
both themes. Its `incomplete` results require human judgment. Automated label and
keyboard checks are useful evidence but do not establish full screen-reader
usability. The print test saves Chromium's PDF and simulates asynchronous
`beforeprint`/`afterprint` notifications; review the resulting page images and
perform a final native print-dialog smoke check before submission. Cold localhost
navigation timings are diagnostic samples, not a mobile-network performance claim.

Use `QA_FILTER="accessibility|direct routes"` only for targeted debugging. A final acceptance run must omit the filter.

Compare the actual serialized Brief exports and sensitivity snapshots from two
complete workflow runs. This ignores only the Brief execution timestamp; reviewed
source metadata, national findings, local selections, scenario inputs/results,
data requests, warnings, and sensitivity values must remain exactly equal:

```sh
node tests/browser/compare-results.mjs \
  /tmp/diagnostic-browser-before/qa-results.json \
  /tmp/diagnostic-browser-after/qa-results.json \
  /tmp/diagnostic-browser-after/governed-browser-comparison.json
```

The report includes SHA-256 digests of each normalized snapshot. It supplements
reviewed-file manifest verification; it does not replace it or authorize evidence
admission.
