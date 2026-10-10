# Verified static demo — October 10, 2026

This branch preserves its independent orphan history. The new bundle is a normal
child of `e28203aaefe1065cb6bceb30f317796bae4743c6`, with no force push or merge into main.

Source main: [`1910fd98b84cefa50ed64084af07b226739195cb`](https://github.com/Ianyliu/diagnostic-odyssey/commit/1910fd98b84cefa50ed64084af07b226739195cb).
Built from a clean checkout using **Node 22.23.3 / npm 10.9.9**, `npm ci`, then
`npm run build` (output `apps/web/dist`). Lock SHA-256: `4bb8387872c5174bcaceb7929c6d4cad3b634282504c2412bf6b6f1f71bdef8b`.
`build-provenance.json` records full file hashes, dependency/build state, reviewed
artifact versions/checksums and the previous release rollback point.

| Generated asset | Bytes | SHA-256 |
|---|---:|---|
| `assets/index-D24PT-ZR.css` | 100,980 | `cfcccb91d15e50bf31de5219877df13f9d8e5cb6ebf7f4faaf2fc0a95a36c6c5` |
| `assets/index-D79TFG21.js` | 506,461 | `0f981747bab68643b64decca57ac40645572e65ce1724b14289cc3a77a549bb5` |

## Scientific boundaries

The existing reviewed September 26 MEPS national bundle supplies 21 estimates;
the September 24 WV HRSA/ACS artifact supplies 34 separate implementation-context
indicators. The reviewed September 29 linked-condition package retains only its
previously admitted Candidate A secondary descriptive use under existing policy.
All 27 reviewed source files and their 23 manifest payload checksums are unchanged.
No new scientific release, evidence admission, effect or causal claim is included.
Typical Range IQRs remain distinct from mean confidence intervals. Local selections
and analyst assumptions never rescale national burden.

## Acceptance and reports

The maintenance report and reproducible browser harness live on source main:
[implementation audit](https://github.com/Ianyliu/diagnostic-odyssey/blob/1910fd98b84cefa50ed64084af07b226739195cb/docs/maintenance-audit-report.md),
[browser acceptance](https://github.com/Ianyliu/diagnostic-odyssey/blob/1910fd98b84cefa50ed64084af07b226739195cb/tests/browser/README.md).
The final release verification report records the actual static commit, deployment
ID, canonical URL, live checks and rollback point after upload; a branch push alone
does not prove deployment. See the audit documentation PR conversation for that
final release record.

## Deployment and routing

The existing Cloudflare Pages project `diagnostic-odyssey` is **Direct Upload**,
not Git-connected. Deploy these exact verified bytes using a scoped Pages upload
token/approved Wrangler installation, preserving `_headers`. Confirm canonical
deployment metadata and rendered production routes after upload.

This root-path SPA runs at https://diagnostic-odyssey.pages.dev. BrowserRouter deep
links rely on Pages' automatic SPA fallback: keep the root free of `404.html`.
The preserved `_headers` provides security headers, immutable hashed-asset caching
and no-cache index HTML. Netlify/Vercel fallback configurations remain available.
A GitHub Pages repository subpath requires a separate base-path/router rebuild.

Previous known-good rollback deployment: `8e0709c3-5fe5-4911-b0d7-020f883c4216`
at https://8e0709c3.diagnostic-odyssey.pages.dev, static commit `e28203aaefe1065cb6bceb30f317796bae4743c6`.
Preserve this deployment. If live verification fails, restore that deployment and
verify it before claiming submission readiness.
