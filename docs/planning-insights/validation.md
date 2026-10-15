# Validation and handoff

Tested application commit: `1768bdc1d1efebcc83d8433130f27db0610f7396`.
Baseline: verified current main `5cc772a198f86a92866bf14cb4ad545ff583200e`.
Documentation and test-only follow-ups do not change the tested web payload.
These are engineering results, not independent scientific admission or release
authorization. See [machine-readable results](validation-summary.json).

## Executed checks

| Check | Result |
| --- | --- |
| Clean Node 22.23.3 / npm 10.9.9 `npm ci` | PASS |
| `npm run typecheck` | PASS |
| `npm test` | 376/376 PASS, including 11 focused insights tests |
| `npm run lint` in clean committed source | PASS, no extra ignore flags |
| `npm run build` | PASS; six payload files byte-identical to the working-checkout build |
| Existing full browser acceptance | 26/26 groups PASS, including route/theme/reduced-motion, numeric boundaries, keyboard, errors, JSON and actual PDF |
| Insights browser checks | 14/14 groups PASS; 360/390/768/1440px, both themes, disclosure keyboard access, applied state, local selection, request staleness, huge finite values and opt-in PDF |
| Existing Gate 0 accessibility | 14/14 PASS |
| Existing acquisition browser suite | 12/12 PASS, including synthetic-only admitted fixtures and actual production JSON/PDF |
| Python narrative provenance | 32/32 PASS |
| Python local-context contracts | 51/51 PASS |
| Candidate-output verifier | PASS |
| Synthetic R analysis | PASS, R 4.5.2 with isolated testthat 3.3.2 |
| Feature-disabled build | PASS; preview/links/print choice absent; actual default JSON equals enabled build |

The preview's eight viewport/theme axe evaluations reported **zero violations**;
incomplete findings are retained for human judgment. The feature browser run
recorded no page errors or external network requests. This is local browser
evidence, not certification of all browsers, assistive technology, or production.

The first local attempts exposed environment issues: the system Python disallows
global pip installation, R lacked testthat, and the repository's untracked
`.maintenance-local` archives were being linted. Final checks used an isolated
Python environment with the existing pinned `jsonschema==4.26.0`, a temporary R
test library, and a clean archive of the committed source. No user archives or
global language installations were changed. Browser tests also exposed and
corrected a new tablet overflow for Number.MAX_VALUE resource headlines; the
complete existing suite was rerun after the correction.

## Scientific and export preservation

[Governed comparison](governed-comparison.json): all 27 reviewed files and 23
published checksum entries, 21 national estimates, two reviewed Typical Ranges,
34 WV indicators, Candidate A isolation, 11 scenarios, 150 sensitivity points
and three canonical serialized Brief cases remain unchanged.

[Browser comparison](governed-browser-comparison.json): all seven original
workflow/sensitivity snapshots match. Only the existing Brief `generated_at`
timestamp is normalized. Optional insights interactions, disclosures, print
selection and request inspection leave canonical JSON unchanged. Stale requests
remain excluded until explicit refresh; creation and Brief selection remain
separate actions.

The existing actual printed Brief is still eight pages for the baseline's
selected-context/current-request workflow. Its **page-by-page extracted text is
identical**, normalizing only generation timestamps. No PDF byte-equality claim
is made: execution metadata and font/resource serialization may differ.

The opt-in summary intentionally adds separate summary pages and leaves the
original detailed sections intact. Actual PDFs were generated with the summary
off, on, all 34 reviewed context indicators selected, and a maximum finite
resource requirement. The default opt-in example is nine pages (two summary
pages plus the seven-page unselected-context Brief); the full-context example is
24 pages. Summary pages preserve native units, uncertainty, populations,
denominators, record IDs and source locators. Investigation prompts and
intervention options are absent from the printed summary. PDF pages were rendered
with Poppler and inspected; text alone was not used as visual QA.

Long-context visual inspection identified a fixed-footer collision. The opt-in
summary now uses native page-margin footers; the default print path is unchanged.
`verify-insights-pdfs.py` checks all 49 pages across the four feature PDF cases
for footer presence and body clearance, plus native population/denominator
metadata and exclusion of unaccepted prompts. All checks pass. This supports the
tested Chromium print engine, not a cross-browser print guarantee.

## Reproduction

Use Node 22 with a clean checkout and the repository's existing test-only Python
validator installed in a virtual environment. Run the five root npm checks in
order. Browser dependencies remain outside the repository, as documented in
`tests/browser/README.md`.

Serve `apps/web/dist` with Vite Preview. Set `PLAYWRIGHT_RUNNER`, `QA_BASE_URL`
and a fresh `QA_OUTPUT`, then run:

```sh
node tests/browser/acceptance.mjs
node tests/browser/planning-insights.mjs
node tests/browser/gate0-accessibility.mjs
python3 tests/browser/verify-insights-pdfs.py "$QA_OUTPUT"
```

For acquisition regressions, first run
`node --experimental-strip-types tests/browser/prepare-acquisition-fixture.mjs`
and serve its existing Vite fixture separately. Set `QA_FIXTURE_URL`, then run
`node tests/browser/acquisition-hints.mjs`. Fixtures are synthetic and grant no
production admission.

Use the existing maintenance capture/compare scripts and browser compare script
against separate baseline/final directories. A local release-preparation dossier
contains the exact clean build, source/tree/lockfile identities, full file-hash
manifest and provenance. It is unapproved and has not been synchronized to GitHub
static hosting or uploaded to Cloudflare.

## Remaining gates and limitations

- Independent substantive review of the exact PR revision and applicable
  scientific, security/privacy, accessibility and release-owner decisions remain
  pending. Local PASS results do not replace those gates.
- No admitted intervention narrative, acquisition mapping, causal parameter,
  provider integration, source acquisition or new inference capability is shipped.
- Actual VoiceOver/NVDA speech, non-Chromium rendering, native OS print dialogs,
  and tagged-PDF accessibility are not certified. Chromium PDFs are untagged.
- Vite retains its existing over-500kB chunk warning. No production dependency
  or lockfile change was introduced; no performance benchmark is claimed.
- No main merge, static synchronization, Cloudflare configuration/deployment,
  external submission or October 15 artifact replacement was performed.

## Screenshots

- [Before: desktop Planning Brief](screenshots/before-brief-desktop-light.png)
- [After: desktop insights, light](screenshots/after-insights-desktop-light.png)
- [After: desktop insights, dark](screenshots/after-insights-desktop-dark.png)
- [After: mobile insights, dark](screenshots/after-insights-mobile-dark.png)
- [Actual opt-in PDF](example-summary.pdf)
