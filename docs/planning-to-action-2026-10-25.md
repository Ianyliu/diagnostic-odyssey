# Planning-to-action: sensitivity request handoff

Refs #142 (workstream B), #23 (acquisition guidance), #21 (freshness wording).

## Verified shipped gap and scope

Started from newly fetched `origin/main@cdb91bd20e1e449883f8127f34046c61cdb95b1c` in the separate `feat/planning-request-handoff-142` worktree. Inspected Pilot, sensitivity explorer, request templates, ArtifactContext, request cards, current browser suites and merged PR #98. Creation, selection, stale exclusion and refresh already worked. This change addresses the remaining interpretive handoff: the card did not name the planning decision, expose the exact applied inputs, or explain owner confirmation and recovery when data cannot be supplied. The existing rationale was hidden in the default-collapsed details.

The existing card now connects the decision to the unchanged request question and rationale. Current requests expose all eight exact applied numeric Pilot inputs, using the existing precision-preserving formatter. Stale requests retain their earlier rationale and withhold current inputs until refresh; no historical scenario snapshot is invented. The checklist asks the owner to confirm a local source system, definitions, aggregate output, period and disclosure controls, and to revisit assumptions or scope when the summary is unavailable. A link returns to existing sensitivity. Brief inclusion is explicitly distinct from sending a request.

“Current” is explained as agreement with the applied scenario, not a certification of source vintage. This is a bounded #21 clarification, not a cross-workspace freshness implementation.

## Ownership

| Files | Purpose |
| --- | --- |
| `apps/web/src/pages/DataRequestsPage.tsx`, `.css` | Existing card handoff, source-currentness copy and scoped mobile focus clearance |
| `apps/web/src/data/dataRequestHandoff.ts` | Read-only presentation model; uses existing request currency and exact input formatting |
| `apps/web/test/data-request-handoff.test.ts` | Four deterministic tests: supported decisions, precision, stale/unavailable input withholding, unsupported IDs, mutation/export safety |
| `tests/browser/planning-request-handoff.mjs` | Four viewport/theme journeys, keyboard/visible focus, axe, overflow, invalid draft and test-only unavailable local-context loader |
| `tests/browser/planning-request-exports.mjs`, `compare-planning-request-exports.py` | Six actual JSON/PDF download stages and exact base/head comparison |
| `.github/workflows/planning-request-handoff.yml` | Exact-head production-browser QA, separate dev-only failure fixture and isolated PR-base build |

No edits to `BriefPage.tsx`, `App.tsx`, the AI workspace, `tests/browser/planning-intelligence-integration.mjs`, contracts, core serializers, scenario arithmetic, governed artifacts, request templates or acquisition allowlists. PR #139's branch is untouched.

## Validation and inspectable evidence

Local validation: 469 workspace unit tests; typecheck, lint and production build. Existing Vite large-chunk advisory remains. The initial local full-suite run needed an isolated Python environment with the repository's pinned `jsonschema==4.26.0`; no system Python change was made.

The real browser journey covers empty requests → Pilot sensitivity → one analyst-created capacity request → exact inputs/owner/fields/privacy → scenario change → stale selected request excluded from canonical Brief → explicit refresh preserving deselection → current selection included. Existing Brief suggestions remain separate and do not create reach/timing requests. Invalid unfinished drafts pause creation and preserve the last valid applied scenario. A separately labelled test-only interception throws in the local-context loader; national findings and the request loop remain usable, with no substitute local data.

The 390px and 1440px light/dark matrix checks real Tab/Enter/Space order, controls unobscured by fixed navigation, zero horizontal overflow and axe WCAG A/AA. The mobile focus check found and fixed the new disclosure initially landing under the fixed navigation, with CSS confined to Data Requests.

The export runner fixes the browser clock to `2026-10-25T15:00:00Z`, downloads JSON and prints actual PDFs at six stages: empty, created, stale, refreshed-unselected, refreshed-selected and removed. It verifies all 21 national and 34 local records and intervention evidence remain identical, and that no acquisition guidance is exported. Base/head JSON bytes, extracted PDF text and PDF page counts match without removing any JSON fields. PDF binary equality is not claimed. Read-only rendering of the executive and request pages was also inspected; the existing sparse final request page remains unchanged.

A supplemental governed snapshot comparison preserved 11 scenarios, 150 sensitivity points, three canonical payloads, all 27 reviewed files and all 23 checksum-manifest entries. The old maintenance runner still asserts the superseded two-record context default; only a temporary local copy was adjusted to expect the shipped 34 records, identically for base and feature. The shared runner was not edited.

The dedicated CI job uploads `planning-request-handoff-<head SHA>` containing all matrix screenshots, axe reports, results, six baseline and six candidate JSON/PDF exports, comparison hashes and server logs. Exact-head CI and final local evidence are linked in the PR/delivery report; prior partial or failed runs are not acceptance evidence.

## Review boundaries

This is presentation and next-step guidance. Requests still start selected for convenience; refresh retains choice; stale requests stay excluded; removing a request removes its selection. Optional acquisition guidance stays behind the existing resolver. Production's registry/allowlist remains empty: no FHIR/CMS mappings are exposed, admitted or exported, and no specific local source system is asserted available. Existing owner, fields, granularity and privacy wording remain canonical and unchanged.

The checklist is session UI, not an addition to canonical JSON/PDF. A request is not dispatched, data is not collected, and no effectiveness or quantified information-value claim is made. No scenario persistence, map or route was added. Independent product/accessibility review and real analyst usability evaluation remain necessary; local source availability and any scientific/privacy release admission are separate decisions. No merge or deployment is performed by this branch.
