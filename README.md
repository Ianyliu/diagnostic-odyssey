# Deploy-ready demo bundle — `demo/deploy-ready-2026-10-06-b99d1c70`

A verified, fully static production build of the **Diagnostic Odyssey Ledger**
clickable demo, pushed as a deploy-ready branch for the TOPx HHS Tech Sprint
Phase 2 final submission (due **October 15, 2026, 11:59 PM ET**).

## What this branch is

- **Orphan branch** (no parent commit) containing only the built site plus deployment metadata.
- **Source:** `Ianyliu/diagnostic-odyssey` main @ `b99d1c70`
  (commit dated 2026-10-02T16:32:21Z; unchanged since the Oct 4 round-4 review).
- **Built:** 2026-10-06, via `npm install` (186 packages, Node v24.20.0) + `vite build` (~12 s).
- **Not merged to main.** Main is untouched by this branch.

## Verification (2026-10-06)

- Web test suite: **162/162 pass** (`node --experimental-strip-types --test`).
- Runtime analysis of the built bundle: **zero application API calls, zero runtime JSON
  fetches, zero WebSocket/EventSource/XHR** — the reviewed MEPS artifact is
  imported at build time and validated by `assertValidArtifactBundle` during the build.
  (The generated Vite module-preload helper may use `fetch` internally if preload events fire.)
- Served locally (`python3 -m http.server`): `/` → 200, JS asset → 200.
- Full report: `demo-build-verification.md` (kept alongside the submission
  drafts, not in this branch).

## Contents (~700 kB)

| File | Size | Notes |
|---|---:|---|
| `index.html` | 1.45 kB | Entry point |
| `assets/index-CuSK_Skz.css` | 100 kB | Styles |
| `assets/index-DCs6JUE-.js` | 502 kB | App bundle |
| `diagnostic-odyssey-horizontal.png` | — | Brand image |
| `diagnostic-odyssey-icon.png` | — | Brand image |
| `diagnostic-odyssey-mark.svg` | — | Brand image |
| `netlify.toml` | — | Netlify publish root + SPA fallback |
| `vercel.json` | — | Vercel SPA fallback |

## Important path constraint

This exact bundle is built for a **domain root**. Generated assets and brand
images use absolute paths such as `/assets/...` and
`/diagnostic-odyssey-icon.png`, and the app's `BrowserRouter` has no
`basename`.

Therefore:

- **Works as-is:** `https://diagnostic-odyssey.pages.dev/`, a Netlify/Vercel
  project domain, or a dedicated custom domain/subdomain such as
  `https://diagnostic.example.org/`.
- **Does not work as-is:** a GitHub Pages project path such as
  `https://ianyliu.github.io/diagnostic-odyssey/`. That deployment requires a
  source rebuild with a matching Vite base path and React Router basename (or
  equivalent relative-path routing).

## How to deploy

The app uses `BrowserRouter`, so non-root routes such as `/pilot` must return
`index.html`.

- **Cloudflare Pages (recommended):** connect this repository and select this
  branch. No build command is needed; publish the repository root. Cloudflare
  Pages treats a project without a top-level `404.html` as an SPA and falls
  back to `/` for unknown paths, so **do not add a GitHub-Pages-style
  `404.html` to this branch**.
- **Netlify:** connect this branch, leave the build command empty, and publish
  `.`. The committed `netlify.toml` provides the required 200 rewrite to
  `/index.html`.
- **Vercel:** connect this branch as a static project. The committed
  `vercel.json` rewrites application routes to `/index.html`.
- **GitHub Pages:** practical only if you assign a dedicated custom domain at
  the domain root and accept the `404.html` SPA workaround, or rebuild the
  source specifically for the repository subpath. It is not the best fit for
  this current root-path bundle.

## Data artifact note

The bundled build embeds the reviewed MEPS candidate artifact
`meps-2024-long-covid-candidate-20260926T011343Z` (**Sept 26** bundle).
The TOPx Phase 2 submission drafts cite
`meps-2024-long-covid-candidate-20260923T020607Z` (**Sept 23**, 21 estimates),
and a newer Sept 29 reviewed artifact
(`meps-2024-linked-condition-service-use-reviewed-20260929-v1`) exists.
Pointing the demo at a different artifact is a **repo change** (rebuild), not a
deploy-blocker — confirm before the Oct 15 submission which bundle should be
live.

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
