# Focused implementation validation

This is engineering evidence for an **unmerged** #23 PR, not scientific admission,
professional privacy certification, release approval or merge authority.

| Boundary | Result |
| --- | --- |
| Workspace unit tests | 329 pass, zero failures |
| Typecheck / lint / production build | Pass; existing Vite large-chunk advisory remains, no dependency version changes |
| Python local-context suite | 51 pass; synthetic candidate-output verifier passes |
| Governed core comparison | Exact equality: 11 scenarios, 150 sensitivity points, three serialized Brief JSON payloads, 21 estimates, 34 local indicators, 27 files / 23 manifest payloads |
| Existing browser workflow comparison | Four Brief payloads and three sensitivity snapshots equal accepted baseline; only top-level Brief generation time excluded by the unchanged comparator |
| New browser matrix | 12/12 pass: production and isolated synthetic fixture at 1440/820/360 px, light/dark, reduced motion |
| Specific PR #94 request-name defect | Pass for all three existing request families |
| Latest PR #94 pagination delta on fresh main | Pass: selected-request / long-context whole entries and all 21 printed interpretations |
| Synthetic card automated WCAG checks | Zero violations / zero incomplete results in six screen-mode axe scans; not manual accessibility certification |
| Actual JSON/PDF | Canonical synthetic provenance retained; production exports contain no unadmitted guidance; selected-current/stale/refreshed/removed exports checked |
| Frozen inputs | Actual source Git blobs and working files match retained digests; B subject and all three original assessment hashes checked |

The production registry is empty. Production browser checks exercise empty and pending
requests, separate keyboard selection, stale selection preservation/exclusion, refresh,
removal, JSON download, print and disclosure restoration. There is no production-admitted
guidance path to certify. Positive admitted guidance uses a plainly labeled synthetic
test actor/registry in a separate local Vite fixture, not a product route, flag or release.
It exercises the real shared resolver, core codec, read-only card and invalid/stale status
renderer; all 19 source-element locators are retained. Full session attach/remove with a
genuine admitted release remains a required admission/integration review before enabling.

Keyboard checks cover request selection by question and disclosure activation. Screen
and print overflow checks cover the affected surfaces. Representative mobile dark
production and synthetic screenshots and actual PDFs are in [validation](validation/).
The synthetic PDF intentionally identifies its non-authoritative actor and registry.
PDF content checks inspect actual extracted provenance/limits; visual inspection covers
representative pages. A trailing mostly empty print page remains a pagination limitation,
not lost content. No claim of a full screen-reader or manual accessibility certification.

The changed source/manifest identity list is retained in
`validation/rendered-source-identities.json` (SHA-256
`76eca1d8fd792ed2b31317fa1f40b35de97500f4f5d8250c250c63cb72dd966a`).
It must match the final PR's product sources. Later documentation/test-only commits do
not authorize reuse after any product source/build-input change. Exact-head normal CI
must separately pass Node/TypeScript, Python, immutable checksums and R synthetic tests.
No real-data scientific workflow was dispatched. CI/review run identities are reported
on the PR, rather than predicted in this document.

Two precise test corrections accompany the core export boundary: the mixed-selection
test now supplies its actual valid scenario to a direct core caller, and the warning
test checks returned text after the implementation moved into core. No snapshot was
deleted or differences broadly normalized. Exact-byte comparison caught a request-key
ordering drift; the sanitizer now preserves legacy recognized-field order and a test
freezes it.

Candidate JSON, source HTML and assessment records are verification files, not browser
imports. Reviewed artifacts, quantitative contracts/arithmetic, Candidate A isolation,
other candidate suppression/non-admission and separate local-context selection remain
unchanged. Narrative source admission and the Evidence reader remain absent.

Reproduce with Node 22: `npm ci`, `npm test`, `npm run typecheck`, `npm run lint`,
`npm run build`; run the existing Python suites through normal CI. For rendered checks,
use an external Playwright/axe runner as the existing browser harness does, serve the
production build on localhost:4194, prepare the fixture with
`node --experimental-strip-types tests/browser/prepare-acquisition-fixture.mjs`, serve
its dedicated Vite config on localhost:4195, then run
`tests/browser/acquisition-hints.mjs` with `PLAYWRIGHT_RUNNER` and `QA_OUTPUT` set.
The generated fixture stays under ignored artifacts and never enters production.

Remaining independent gates: exact-HEAD contract/export/UI/privacy/implementation review;
any necessary institutional privacy authority; exact-byte admission and release allowlist;
owner merge authorization. Static synchronization and production deployment are not authorized.
