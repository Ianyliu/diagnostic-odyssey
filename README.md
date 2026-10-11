# Verified static demo — PR #79 contract refresh

This branch preserves its independent orphan history. The new bundle is a normal
child of `9e6981786325e74bfe968584fae8c2d492a09791`, with no force push or merge into main.

Source main: [`e27403af8d878327d28ead2b6f7aeb00657c5239`](https://github.com/Ianyliu/diagnostic-odyssey/commit/e27403af8d878327d28ead2b6f7aeb00657c5239).
Built from a clean checkout using **Node 22.23.3 / npm 10.9.9**, `npm ci --offline --no-audit --no-fund`, then
`npm run build` (output `apps/web/dist`). Lock SHA-256: `347b7a8499c72ef317907276b85a74bd17ae3334a8af2e32a777d6ff789208a6`.
`build-provenance.json` records full file hashes, dependency/build state, reviewed
artifact versions/checksums and the previous release rollback point.

| Generated asset | Bytes | SHA-256 |
|---|---:|---|
| `assets/index-D24PT-ZR.css` | 100,980 | `cfcccb91d15e50bf31de5219877df13f9d8e5cb6ebf7f4faaf2fc0a95a36c6c5` |
| `assets/index-DzXhtyp7.js` | 506,776 | `7f4d77719ee5d2c0ec59a7ee4826a72a07086ee0084407ca69f3d82dc65a84c6` |

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
[implementation audit](https://github.com/Ianyliu/diagnostic-odyssey/blob/e27403af8d878327d28ead2b6f7aeb00657c5239/docs/maintenance-audit-report.md),
[browser acceptance](https://github.com/Ianyliu/diagnostic-odyssey/blob/e27403af8d878327d28ead2b6f7aeb00657c5239/tests/browser/README.md).
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

Previous known-good rollback deployment: `171fdf6b-839c-4852-9449-6a5aba6516bc`
at https://171fdf6b.diagnostic-odyssey.pages.dev, static commit `6a216270094519b45421db91a6eb80e7b6c07ee5`.
Preserve this deployment. If live verification fails, restore that deployment and
verify it before claiming submission readiness.

## Repository-hygiene refresh

[PR #93](https://github.com/Ianyliu/diagnostic-odyssey/pull/93) passed independent Jules review and exact-head CI, then merged with user authorization. This clean merged-main build is byte-identical to the reviewed candidate: browser theme-color and native score/uncertainty labels are included; scientific artifacts and governed outputs are unchanged. The full 26-group candidate browser evidence is reused on verified identical bytes; artifact-serving checks are recorded separately in the PR release addendum.

This commit refreshes the GitHub static branch only. **No production deployment was triggered.** Existing production remains the rollback deployment above until a separately authorized upload. Do not merge, rebase or reset this standalone history to main.

## Contract-only source refresh

[PR #79](https://github.com/Ianyliu/diagnostic-odyssey/pull/79) passed independent Jules contract review at `3cc1a846f2d8d3024d5127b5503039c5adba75b7` and merged with user authorization as `e27403af8d878327d28ead2b6f7aeb00657c5239`. Exact merged-main [CI](https://github.com/Ianyliu/diagnostic-odyssey/actions/runs/38105703994), including Python and synthetic R, passed. The clean fresh build has all six generated web files byte-identical to parent `9e6981786325e74bfe968584fae8c2d492a09791`; headers and routing configurations are unchanged. Reuse the prior browser/JSON/PDF evidence only on that proved equivalence.

This ordinary child commit updates source/dependency/review/build provenance and checksums only. The isolated narrative contract has no runtime consumer. Source/applicability admission, narrative reader and acquisition hints remain separately gated and unimplemented. Full candidate source documents are retained outside this static bundle. No new scientific approval or release is implied. **No production deployment is authorized or performed.**
