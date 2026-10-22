# Deploy-ready demo bundle — `demo/deploy-ready-2026-10-22-cdb91bd`

A verified, fully static production build of the **Diagnostic Odyssey Ledger**
clickable demo, pushed as a deploy-ready branch for the TOPx HHS Tech Sprint
Phase 2 final submission (due **October 15, 2026, 11:59 PM ET**).

## What this branch is

- **Orphan branch** (no parent commit) containing only the built site plus this README.
- **Source:** `Ianyliu/diagnostic-odyssey` main @ `cdb91bd20e1e449883f8127f34046c61cdb95b1c`.
- **Built:** 2026-10-22, via `npm install` + `npm run build` (workspace `@diagnostic-odyssey/web`).
- **Not merged to main.** Main is untouched by this branch.

## Verification

- `npm run build` succeeded; `npm test` (all workspaces) passed.
- The app is fully static: the reviewed MEPS artifact is imported at build time
  and validated during the build — no runtime API calls.

## How to deploy

The bundle is static and serves from any static host. **One requirement:**
the app uses `BrowserRouter`, so the host must rewrite all routes to
`index.html` (SPA fallback) for deep links to work.

- **Cloudflare Pages / Netlify:** connect this branch (no build command
  needed — output is already at the branch root) and enable SPA fallback
  (`/* → /index.html`, 200).
- **Drag-and-drop:** upload the files with the same SPA-fallback rule.
- **GitHub Pages:** would need the `404.html` workaround; not recommended.

## Rebuilding

```bash
git clone https://github.com/Ianyliu/diagnostic-odyssey.git
cd diagnostic-odyssey
git checkout cdb91bd20e1e449883f8127f34046c61cdb95b1c
npm install
npm run build   # → dist/ under the web workspace
```
