# Verified static demo — October 10, 2026

This branch preserves its independent orphan history. The new bundle is a normal
child of `6a216270094519b45421db91a6eb80e7b6c07ee5`, with no force push or merge into main.

Source main: [`cb0d0a50d76fcdd9c0492fe4b348cb07969174d9`](https://github.com/Ianyliu/diagnostic-odyssey/commit/cb0d0a50d76fcdd9c0492fe4b348cb07969174d9).
Built from a clean checkout using **Node 22.23.3 / npm 10.9.9**, `npm ci`, then
`npm run build` (output `apps/web/dist`). Lock SHA-256: `4bb8387872c5174bcaceb7929c6d4cad3b634282504c2412bf6b6f1f71bdef8b`.
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
[implementation audit](https://github.com/Ianyliu/diagnostic-odyssey/blob/cb0d0a50d76fcdd9c0492fe4b348cb07969174d9/docs/maintenance-audit-report.md),
[browser acceptance](https://github.com/Ianyliu/diagnostic-odyssey/blob/cb0d0a50d76fcdd9c0492fe4b348cb07969174d9/tests/browser/README.md).
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
