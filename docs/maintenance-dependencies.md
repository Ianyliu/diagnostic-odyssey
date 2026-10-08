# Maintenance dependency baseline — October 8, 2026

Generated from source `b99d1c703226009f2004a06a332174124fbfd8a3` in an empty checkout using official Node **22.23.3**, npm **10.9.9**. Node archive SHA-256: `23b25245dcfb9af7262f8ff142e9e2e0af025368117329e7a7458a51e5922f53` (darwin-arm64).

The previous untracked root lockfile was preserved outside the working checkout and compared before introducing this lock. It contained Vite 7/8 and React Router 7 resolutions inconsistent with the current package manifests; it was not overwritten or adopted. There was no tracked lockfile to preserve on main. Fresh resolution remains within existing declared dependency ranges: Vite 6.4.4, React Router DOM 6.30.6, PostCSS 8.5.29, source-map-js 1.2.2. No package manifest or major dependency upgrade is included.

A clean `npm ci` installed 186 packages. Typecheck, all 228 tests, lint and production build passed before changing CI/documentation to `npm ci`. The lockfile itself is the authoritative complete dependency state; record its SHA-256 with every demo build.

## Security audit and deliberately deferred upgrades

The high-severity source-map-js advisory [GHSA-68fv-2mgg-jv7q](https://github.com/advisories/GHSA-68fv-2mgg-jv7q) is fixed at 1.2.2. Fresh `npm audit` reports no high/critical findings and two moderate package entries (react-router and its dependent react-router-dom), covering [navigation redirects](https://github.com/advisories/GHSA-wrjc-x8rr-h8h6) and [SSR error hydration](https://github.com/advisories/GHSA-337j-9hxr-rhxg).

This app uses client-only BrowserRouter with developer-defined internal Link/NavLink/Navigate targets. It does not take untrusted navigation destinations, perform SSR, use hydrateRoot, or consume server hydration error data. These affected paths are not used by this application. This is an application-exposure assessment, not a claim that the installed package is patched. Upgrading to React Router 7.18+ is deferred to a separately tested migration; do not use `npm audit fix --force` in the submission-readiness pass. Reassess immediately if user-controlled navigation or SSR is introduced.

ESLint 9 remains the existing major version; npm reports it as unsupported. Migrating lint tooling is a post-submission maintenance item, not a reason to change runtime dependencies now.
