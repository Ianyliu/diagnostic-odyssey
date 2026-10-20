# Workstream I — Wave 2 Scenario Persistence and Comparison Contract (proposal)

**Status:** DESIGN ONLY — Phase 1 contract requires PM approval; independent Workstream G product review to follow.  
**Issue:** #32 (P2, post-demo). **Read-only source baseline:** `a8d0fc910e26b7565eb69ec787492a4bdf669c5f`.  
**Release gate:** The October 22 production candidate is unaffected. This document does not authorize implementation, merge, deployment, or a scientific release.

## 1. Audited invariants and current behavior

- `apps/web/src/data/ArtifactContext.tsx`: Provider stores one applied `Scenario` and one numeric `PilotInputDraft` in React memory. It independently manages analyst Data Requests, Brief-selected request IDs, checkbox-selected Local Context, and one Pilot-used local indicator. On load it initializes validated reviewed national/local artifacts and illustrative defaults. **No session/local storage currently exists**.
- `apps/web/src/pages/PilotPage.tsx`, `data/pilotInputDraft.ts`: An editable invalid draft is not applied. Valid numeric edits replace the applied scenario immediately; results and sensitivity use only the applied, validated scenario. Target step/mechanism exist in the `Scenario` but are not presently editable in the Pilot form.
- `packages/contracts/src/index.ts`, `packages/scenario-engine/src/index.ts`: `Scenario` has a `scenario_id`, eight numeric planning fields, `target_pathway_step`, `mechanism`, `assumption_refs`, and `artifact_version`. `calculateScenario` validates inputs and finite output; results are deterministic (reach/capacity, person-month planning exposure, program resources), never causal ROI/savings.
- `packages/acquisition-hints/src/dataRequestTemplates.ts`: sensitivity request IDs are global to the session and field (`session.sensitivity.<field>`), not version-scoped. Currency is checked by exact content against `createSensitivityDataRequest(appliedScenario,field)`; mismatches are stale. Other request IDs are not subjected to this sensitivity freshness check.
- `apps/web/src/data/localContextSelection.ts`, `pilotLocalContextSelection.ts`: Pilot-used context is a single `{artifactVersion, indicatorId}` selection, separate from Brief checkbox selections. Resolution requires same current reviewed artifact version and a released record in `loaded` or `partial` state. The Brief unions both record sets and deduplicates by indicator ID.
- `reviewedArtifact.ts`, `reviewedLocalContext.ts`, `reviewedLocalContextValidation.ts`: runtime loads specific reviewed artifact versions with explicit compatibility checks, including a **finite allowlist** for national/local MEPS pairings. A saved scenario has no authority to load an arbitrary prior candidate, supersede review, or promote evidence.
- `apps/web/src/pages/BriefPage.tsx`, `packages/brief-core/src/index.ts`: canonical current Brief is built from the *current* reviewed source, one applied valid scenario, independently selected local indicators, and current selected Data Requests. The Brief builder filters reviewed/released content, sanitizes/resolves optional acquisition guidance, and rechecks sensitivity requests during serialization. JSON and browser print/PDF reflect the same composed Brief. The `generated_at` timestamp remains stable across non-substantive UI changes. Phase 1 must preserve this behavior, including AI handoff.

Important identity distinction: `Scenario.artifact_version` currently identifies the **planning-assumptions version** (`planning-assumptions-2026-09-v1` in defaults); it is **not** the national MEPS artifact version. A persistence contract must store these separately.

## 2. Proposed versioned contract

New pure, runtime-validated `ScenarioVersion` contract (types below are normative shapes, **not deployed code**). Use UUID v4 generated on **explicit user actions**, independently for logical scenario families and immutable versions. IDs are opaque, never names, array positions, timestamps, or hashes of editable assumptions.

```ts
type ScenarioId = string; // "scn_" + UUID, unique for a logical scenario
type ScenarioVersionId = string; // "scv_" + UUID, unique immutable snapshot

type PilotContextReference =
  | { state: "selected"; artifactVersion: string; indicatorId: string }
  | { state: "none"; artifactVersion: string }
  | { state: "unavailable"; artifactVersion: null };

interface ScenarioSourceIdentity {
  planningAssumptionsVersion: string; // equals snapshot.scenario.artifact_version
  calculationContractVersion: string; // explicitly published engine arithmetic contract
  nationalArtifactVersion: string;   // actual reviewed bundle.manifest.artifact_version
  nationalCodeCommit: string;        // bundle.manifest.code_commit, source attribution
  localArtifactVersion: string | null; // actual reviewed artifact, if loaded
}

interface ScenarioVersion {
  schemaVersion: 1;
  scenarioId: ScenarioId;
  versionId: ScenarioVersionId;
  revision: number;                   // 1,2,3... within this scenario family
  parentVersionId: ScenarioVersionId | null;
  savedAt: string;                    // validated ISO 8601 UTC
  nameAtSave: string;                 // historical label, immutable
  snapshot: {
    scenario: Scenario;              // all 8 numeric inputs, pathway, mechanism,
                                     // assumption_refs, planning artifact version
    pilotContext: PilotContextReference;
    sources: ScenarioSourceIdentity;
  };
}
interface ScenarioFamily {
  scenarioId: ScenarioId;
  currentName: string;               // rename metadata only
  createdAt: string;
  versionIds: ScenarioVersionId[];   // ordered immutable version records
}
interface ScenarioCatalogV1 {
  catalogSchemaVersion: 1;
  catalogRevision: number;           // storage conflict/stale-tab detection
  families: ScenarioFamily[];
  versions: ScenarioVersion[];
  retiredScenarioIds: ScenarioId[];  // never reuse after deletion
}
```

**Cross-field validation:** exact known keys; no prototype-pollution/unknown nested fields; bounded catalog/labels/arrays/bytes; UUID-form and uniqueness; valid dates; `revision` sequential and distinct within family; parent belongs to the same family, points backward, and is acyclic; `versionId` and family `scenarioId` unique; `snapshot.scenario.scenario_id === scenarioId`; planning version equals `snapshot.sources.planningAssumptionsVersion`; valid `Scenario` via `validateScenario`, **plus** finite result via `calculateScenario`; valid path/mechanism and arrays; pilot context reference consistency; source identity nonempty; supported schema and calculation contract. Do not trust parsed storage because it is local.

**What is stored:** immutable, finite analyst inputs and their scientific boundary; selected Pilot-used indicator **identifier only**, with local artifact identity; the national artifact used when saved; assumption refs; schema/model identities; audit timestamps. **What is not stored:** reviewed estimate/indicator bodies, raw source data, evidence records or effect parameters, acquired hints, session Data Request bodies or Brief selections, calculator result caches as truth, AI-generated statements, patient data, browser download objects.

- Recompute `ScenarioResult` from validated inputs using the same deterministic engine on restore/compare. Never deserialize a stored result as authoritative. Golden-result tests must pin calculation semantics.
- No automatic version when editing, navigating, printing, changing selections, or autosaving a draft. The illustrative default is never silently added to the library.
- A logical `ScenarioId` persists across explicit revisions and rename. `versionId` is immutable. A duplicate starts a *new* scenario family and new version, with cloned assumptions and references subject to validation; its provenance can optionally point to the source version as a **non-authoritative** `duplicatedFromVersionId` only if added to the schema through review.
- First `Save as new scenario` assigns a fresh logical ID. Explicit activation may rebind only `Scenario.scenario_id` (not numeric assumptions) and record the active saved version; this changes the Brief scenario identity deliberately and must be shown in the UI. Subsequent `Save new version` preserves the family ID, increments revision, and captures currently applied assumptions. All snapshots are immutable.
- Rename updates `ScenarioFamily.currentName` only, leaving saved `nameAtSave`, `versionId`, timestamps and computations unchanged. A save after rename records the new name. Display both current and historical labels where they differ.
- Delete asks for confirmation; removes the family and all its versions from the library, retires the ID, and drops any Phase 2 comparison selection of them. The applied workspace and unrelated Data Requests/Brief checkbox selections remain unchanged; if the deleted version was active, show **unsaved/unlinked workspace** rather than silently clearing inputs. No undo guarantee without an explicit previously exported backup.

## 3. Persistence, migration and transaction boundaries

Phase 1 supports an explicitly chosen browser scope: **session-only** (default; `sessionStorage`) or **keep on this device** (`localStorage`, affirmative opt-in). Browser storage is best effort and is not encrypted, synced, backed up, or suitable for patient identifiers. Scenario names should be short and avoid sensitive content. Never imply cross-device availability.

- One prefixed, schema-versioned catalog envelope per active scope; no mixing or silent merging between stores. Switching scope must preview target occupancy and explicitly confirm move/copy/conflict choice.
- On initialization, first load the reviewed artifacts/current planning defaults **exactly as today**. Independently parse/validate the saved *library*; do not auto-restore the latest scenario or make it the default Brief. A corrupt/unsupported library cannot displace default state.
- Preflight validation, serialize-to-memory, write, read-back and verify before reporting success. On write/quota/security/private-mode exceptions, retain in-memory working state, report **not saved**, do not update catalog/selection as persisted. Treat storage updates as an adapter with injectable failing in-memory test doubles.
- Fresh install (`catalogSchemaVersion` absent) creates an empty catalog **only after an explicit save**; there is no legacy saved-schema source to import. Any future v1→vN migration must be explicit, deterministic/idempotent, validated before commit, preserve source/IDs, and retain a recovery copy until success. Unknown **future** versions and malformed payloads are read-only/unavailable; never overwrite or silently reset them. User-directed export/recovery is preferable to silent deletion.
- `catalogRevision` and `storage` events detect stale tabs and trigger conflict UI; test rejecting writes from an observed stale revision. Web Storage does **not** give a fully atomic cross-tab compare-and-swap: concurrent writers remain a documented risk. For enforceable multi-tab transactions, upgrade to an IndexedDB transactional store before claiming concurrent editing safety. Do not promise guaranteed conflict-free simultaneous writes in v1.
- Use no default or incidental telemetry of scenario content. No remote persistence or auto-sync in this phase.

## 4. Controlled restore protocol (pure dry-run then explicit commit)

1. User selects an exact **scenarioId + versionId**, previews name, date, eight inputs, pathway/mechanism, provenance, local reference, and differences from current applied inputs. Warn if current draft has incomplete/unapplied edits; require explicit discard confirmation.
2. Validate catalog/version identity, saved scenario, calculation result, and source identity. Resolve current reviewed national and local artifacts **through existing loaders/validators**, not stored source payloads; check same exact versions and existing allowed cross-artifact compatibility.
3. Classify a restore: **full** (schema/engine and all selected references compatible and eligible); **inputs-only, explicit** (calculation contract compatible but a reviewed source or selected Pilot-used reference is missing/changed/ineligible); **blocked** (invalid record, unsupported schema/calculation contract, or invalid/nonfinite scenario).
4. Full restore atomically applies the validated `scenario`, matching `createPilotInputDraft(scenario)`, and the reviewed Pilot-used context selection (or explicit `none`). Inputs-only restore clears/unattaches **only** Pilot-used context in the applied workspace, preserves a visible unresolved-reference warning and the immutable saved reference, and requires user confirmation. If a stored indicator has become `preliminary`, `unavailable`, `suppressed`, or changed artifact version, **never** substitute another indicator with the same label.
5. **Do not mutate** Local Context Brief checkbox selections, `analystDataRequests`, `briefDataRequestIds`, reviewed bundles, evidence, or acquisition hints. After applying a scenario, **derive** sensitivity request freshness anew; stale selected requests remain excluded, and only an exact match may become current. Existing non-sensitivity requests are not newly certified as scenario-applicable merely by restoring. The existing reviewed hint resolver still independently verifies any optional guidance.
6. Recompute the canonical current one-scenario Brief from its normal composition. Never include a restored scenario or local ref in export solely because it was stored. Save/restore dialogs must accurately distinguish a recorded source version from the *currently loaded* source.

If national runtime context changes, an inputs-only restore reuses **only analyst assumptions**; it does not assert original evidence continuity. The next explicit save may capture the new active source identity as a new revision after user review. A `partial` local record is selectable only when its **reviewed release status and current artifact eligibility** pass existing gates; do not conflate the record's `partial` data state with a *partial restore*.

## 5. Phase 1 UX flow

- Pilot → **Saved scenarios** (initially empty, clearly labeled browser/session scope).
- Applied, valid draft: **Save as new** (name required, explicit confirmation), or when associated with a family: **Save new version**. Invalid draft or numeric overflow: saving blocked; preview shows last applied values versus draft.
- Library cards: name, latest revision, saved date, source/compatibility status; expandable version history with **Preview / Restore / Duplicate / Rename / Delete**. Clear distinctions between working changes, last applied result, and immutable versions.
- Restore preview: side-by-side input changes and explicit full/inputs-only/blocked state; if context is unresolved show precise artifact and indicator IDs and the effect of proceeding.
- Each action has a precise accessible confirmation/status/error; no automatic "best" label, no excessive alerts, keyboard and screen-reader support, and no silent overwrite of a different browser scope.
- Phase 1 **does not alter the canonical single-scenario Planning Brief schema, print layout, export choices, or AI handoff**.

## 6. Phase 2 — comparison and controlled Brief inclusion (separate PM gate)

- Comparison is opt-in, selects **exactly 2 or 3 explicitly saved `versionId`s** (not unsaved drafts or every edit), permits multiple versions of one logical family, and defaults to **none selected**. Explicit selector is independent of restore and independent of current applied Brief scenario.
- Compare every numeric analyst input, target pathway step/mechanism, assumption refs, original source identities, and Pilot-used local context IDs. Show raw values and signed deltas with clearly named **reference scenario** chosen by analyst, not chosen by software.
- Recalculate the **same** existing `ScenarioResult` per saved input and display outputs/deltas including reached participants, intended reach, capacity gap, baseline/alternative/difference person-months, and program resources. No new outcome/effect models, composite score, automatic rank, "winner" or local savings.
- For different `calculationContractVersion`s, show inputs/provenance but **withhold cross-version output deltas** unless an explicitly reviewed compatibility/migration rule exists. For different national/local versions or geographies, display separately with prominent **not directly comparable evidence context** warnings; do not pool, normalize, or imply equivalence. Unsupported or unreviewed context cannot be silently resolved from storage.
- Evidence/assumption status is **per column**, produced from the current reviewed source/admissibility gates; persisted assumption refs do not constitute reviewed evidence. Clearly separate what was assumed, what is currently eligible, and what was unavailable at save time.
- Brief selection: separate explicit **Include this comparison in Planning Brief** control, selecting 2–3 saved version IDs; default off. Keep the existing canonical applied-scenario section unchanged. Only after Phase 2 schema and rendering approval add a separately versioned comparison appendix to both rendered/printed Brief **and** JSON companion, including version IDs, immutable input snapshots, recomputed deterministic results, source-version statuses and incompatibility warnings. Deletion/invalidation of any selected saved version removes or blocks appendix generation with an explicit message, never silently substitutes another version. Source gating and request freshness must run again at composition and serialization. AI handoff adopts any new schema only after separate acceptance; until then it must omit/not invent comparison content and preserve current behavior.

## 7. Deterministic acceptance matrix

Run pure unit/contract tests plus integrated browser, JSON/PDF, accessibility and provenance tests on the exact implementation HEAD, with explicit fixture/source versions:

1. Identity: UUID validity, uniqueness, no collision across duplication/deletion; monotonically increasing revisions per family; immutable snapshots; rename preserves history; duplicate does not reuse IDs; delete does not affect other families.
2. Input validity: each numeric field, reach bounds, alternative ≤ baseline window, NaN/Infinity/unsafe derived overflow, malformed strings, missing schema, unknown keys, forged IDs, inconsistent parent chain, mismatched `Scenario.scenario_id` and source identity.
3. Storage: absent/empty storage, corrupt/truncated JSON, unsupported future schema, expired/invalid migration, quota exceeded, denied access, read-back mismatch, interrupted write, attempted silent reset, concurrent-tab stale revision, scope switch with conflicting IDs. Assert **no false saved status** and default applied state untouched on failure.
4. Save UX: no implicit version on per-keystroke edits, route change, print, selection toggle, or page refresh; invalid draft cannot save; save exactly captures validated applied values including noneditable pathway/mechanism and assumption refs; explicit activation identity behavior.
5. Restore: full, none, unavailable and selected Pilot reference; unchanged artifact, rotated local artifact, missing indicator, revoked reviewed release, record `partial` vs ineligible release, unknown national version, incompatible calculation contract, malformed snapshot, simulated missing bundle. Assert no reviewed source mutation and no auto-reattachment/substitution.
6. Unrelated state: restore must not change existing analyst request array, request inclusion IDs, acquisition hints, independent Brief checkbox-selected Local Context, or reviewed national/local bundles. Recalculate sensitivity freshness for all three fields, including pathway/mechanism and horizon changes; selected stale requests absent in JSON and print, with warning.
7. Canonical export: unchanged Phase 1 single-scenario Brief JSON shape, print/PDF parity, `generated_at` stability for disclosure changes, proper identity after explicitly restored scenario, no suppressed/unreleased evidence, and unchanged optional acquisition guidance guardrails.
8. Phase 2 (future): 0/1/2/3/4 selected cases; only 2–3 allowed in comparison, duplicate family versions, explicit reference/delta sign, model/version mismatch withholding output deltas, source incompatibility warnings, deleted/invalid selected ID, inclusion default off, identical JSON+print membership and warnings, no score/ranking and no causal/ROI output.
9. Regression: Pilot draft/results/sensitivity; Local Context → Pilot handoff; all 34 eligible local records and Brief selections; currently reviewed compatibility allowlist; Data Requests; `buildPlanningBrief`/`serializeBriefJson`; AI handoff; print boundary/page rules; workspace accessibility.

## 8. Risks, decisions requiring approval, and phased engineering

**Decisions for PM:** (A) Session-only by default with explicit local-device opt-in; (B) new logical ID + immutable per-save version ID; (C) Save New activates the saved family but does **not** change numerical values; (D) explicit inputs-only restore is offered on source mismatch, never as automatic fallback; (E) no Data Request or Brief checkbox snapshot/restore; (F) current canonical Brief unchanged in Phase 1; (G) browser-storage multi-tab limitation is documented rather than hidden.

**Risks:** Identical readable indicator IDs do not establish same reviewed artifact; scenario's planning-artifact version is not MEPS provenance; future calculator changes need a real version contract; non-sensitivity requests currently bypass sensitivity freshness logic; Web Storage is not transactional across tabs; local storage is neither private nor reliable backup; existing Brief and AI handoff contracts are single-scenario.

**Post-approval implementation slices (all post-demo):**
1. Contract and pure validated catalog/restore planner, typed calculation version, exhaustive deterministic tests; **no UI/persistence activation**.
2. Injectable browser storage adapters with failures, migrations, scope controls and conflict/error surfacing; security/privacy review.
3. Saved-scenario UI and explicit transaction/restore integration, with independent request/Brief context state unchanged; accessibility and end-to-end regression.
4. Independent Workstream G product acceptance + D release QA, PM go/no-go; only then consider runtime activation/merge/deployment in a future release.
5. Separate Phase 2 design-review and implementation PRs for compare + additive canonical Brief/PDF/JSON inclusion, with the same acceptance gates.

**Definition of ready for Phase 1:** PM signs off the contract and controlled-restore semantics; exact artifact/version policy is verified against runtime; Workstream G independently reviews the UX and evidence boundaries; no scientific release promotion is implied.
