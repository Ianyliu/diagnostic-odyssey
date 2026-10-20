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
Actual parsed JSON must preserve all eight required numeric inputs, all nine
required numeric outputs, and any bounded-effect endpoints. Missing or null
required numbers fail. Huge finite resource values must stay within desktop,
tablet, and mobile layouts in both themes; an overflowing sensitivity range must
show an error while preserving the valid applied scenario. Resource headlines
for 1e308 and Number.MAX_VALUE must display their complete scientific tokens on
one line within the heading bounds, and actual JSON must preserve both costs.
Scientific numeric tokens in the Pilot result ledger and Brief assumption/output
rows must also remain intact and within their rows. This includes maximum finite
reached participants with zero windows and costs, so the applied result remains
finite. This guards against a visually misleading exponent split even when the
overall page has no horizontal overflow. Valid zeros,
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

## Workstream H: fail-closed output acceptance (D-H1)

The Chromium runner `workstream-h-qa.mjs` emits 20 uniquely enumerated
selection/print coordinates per feature mode: default, deterministic-only,
concept-only, and all-enabled. This is **80 enumerated rows, 60 applicable
PASS states, and 20 explicit NOT_APPLICABLE_DISABLED rows**, not 80
independently executable states. The existing integrated candidate produced
**24 native Chromium PDFs (349 physical pages)** with **113 deliberately
selected first/last/appendix-adjacent raster page PNGs**; these are not
rasterizations of all 349 pages.

`workstream_h_inventory.py` independently defines the exact mandatory PDF
filenames/metadata: **12 for default; 4 for each other feature mode**.
It enforces manifest uniqueness and coverage, on-disk PDF and parseable
canonical `.pdf.json` companions, 21 national findings and required local
selection counts, unique Boolean print coordinates and accurate applicable
versus disabled statuses. Native PDF page/heading/footer inspection remains in
`verify-workstream-h-pdfs.py`, with the long A4-heading spatial fallback
restricted to the physical pages of the detailed appendix and the original
right-side badge clearance tests preserved.

After the verifier renders required first/last and FQHC/RHC/poverty-adjacent
pages, invoke the **non-mutating** validation stage:

```sh
python3 tests/browser/verify-workstream-h-pdfs.py /tmp/workstream-h-results
python3 tests/browser/verify-workstream-h-pdfs.py /tmp/workstream-h-results --check-inventory
WORKSTREAM_H_QA_OUTPUT=/tmp/workstream-h-results \
  python3 -m unittest discover -s tests/browser -p 'test_workstream_h_inventory.py' -v
```

The postrender stage reconstructs every expected PNG filename from physically
verified record-page positions and real PDF page counts; it checks exact names,
nontrivial decodable image contents, and complete verification-report coverage.
Unlike the render stage, `--check-inventory` **never recreates missing PNGs**.
Thirteen negative mutations per feature mode (52 in the four-job matrix)
require failure for missing PDF, missing manifest row, duplicate/invalid
metadata, altered/duplicate/missing print coordinates, missing companion,
extra PDF, missing/truncated PNG, and duplicate report entry. Each mutation
uses hard-linked disposable files, with copy-on-write for changed JSON, so
committed sources and original CI artifacts remain unchanged. GitHub Actions
runs both the non-mutating checker and the negative suite for every mode;
any nonzero result blocks Workstream H acceptance.

Passing these harness checks does not imply deployment parity, manual
screen-reader/native-print acceptance, or release of deferred comparator data.
