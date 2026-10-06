# Deploy-ready demo bundle — `demo/deploy-ready-2026-10-06-b99d1c70`

A verified, fully static production build of the **Diagnostic Odyssey Ledger**
clickable demo, pushed as a deploy-ready branch for the TOPx HHS Tech Sprint
Phase 2 final submission (due **October 15, 2026, 11:59 PM ET**).

## What this branch is

- **Orphan branch** (no parent commit) containing only the built site plus this README.
- **Source:** `Ianyliu/diagnostic-odyssey` main @ `b99d1c70`
  (commit dated 2026-10-02T16:32:21Z; unchanged since the Oct 4 round-4 review).
- **Built:** 2026-10-06, via `npm install` (186 packages, Node v24.20.0) + `vite build` (~12 s).
- **Not merged to main.** Main is untouched by this branch.

## Verification (2026-10-06)

- Web test suite: **162/162 pass** (`node --experimental-strip-types --test`).
- Runtime analysis of the built bundle: **zero API calls, zero runtime JSON
  fetches, zero WebSocket/EventSource/XHR** — the reviewed MEPS artifact is
  imported at build time (`import ... with { type: "json" }`) and validated by
  `assertValidArtifactBundle` during the build. **The app is fully static.**
- Served locally (`python3 -m http.server`): `/` → 200, JS asset → 200.
- Full report: `demo-build-verification.md` (kept alongside the submission
  drafts, not in this branch).

## Contents (~700 kB)

| File | Size | Notes |
|---|---|---|
| `index.html` | 1.45 kB | Entry point |
| `assets/index-CuSK_Skz.css` | 100 kB | Styles |
| `assets/index-DCs6JUE-.js` | 502 kB | App bundle |
| `diagnostic-odyssey-horizontal.png` | — | Brand image |
| `diagnostic-odyssey-icon.png` | — | Brand image |
| `diagnostic-odyssey-mark.svg` | — | Brand image |

## How to deploy

The bundle is static and serves from any static host. **One requirement:**
the app uses `BrowserRouter`, so the host must rewrite all routes to
`index.html` (SPA fallback) for deep links to work.

- **Cloudflare Pages / Netlify:** connect this branch (no build command
  needed — output is already at the branch root) and enable SPA fallback
  (`/* → /index.html`, 200).
- **Drag-and-drop:** upload the files to Netlify Drop / Cloudflare Pages
  direct upload with the same SPA-fallback rule.
- **GitHub Pages:** would need the `404.html` workaround (copies of
  `index.html`); not recommended.

## Data artifact note

The bundled build embeds the reviewed MEPS candidate artifact
`meps-2024-long-covid-candidate-20260926T011343Z` (**Sept 26** bundle).
The TOPx Phase 2 submission drafts cite
`meps-2024-long-covid-candidate-20260923T020607Z` (**Sept 23**, 21 estimates),
and a newer Sept 29 reviewed artifact
(`meps-2024-linked-condition-service-use-reviewed-20260929-v1`) exists.
Pointing the demo at a different artifact is a **repo change** (rebuild),
not a deploy-blocker — confirm before the Oct 15 submission which bundle
should be live.

## Rebuilding

```bash
git clone https://github.com/Ianyliu/diagnostic-odyssey.git
cd diagnostic-odyssey
git checkout b99d1c70
npm install     # Node v24
npm run build   # → dist/
```

A rebuild from the same commit should reproduce this bundle byte-for-byte
(modulo build-tool nondeterminism in hashed asset filenames).
