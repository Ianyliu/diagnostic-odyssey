# Analyze with AI — PR A

This page records the merged PR A foundation. See [PR B](PR-B.md) for the
Planning Brief preview, copy/download interface, source-drift rules and validation.

This is the read-only data/prompt core for the October 15, 2026 v1.0 handoff
specification. It is not connected to the application UI. No model, provider,
clipboard, download, network, credential, storage or telemetry code is introduced.
The existing application remains usable without importing this module.

## Contract and authority

`apps/web/src/data/aiHandoff.ts` accepts the **same current composed PlanningBrief**
used for JSON export. A future caller must pass that object after the existing
selection/currentness and stale-warning composition; it must not reconstruct a
Brief by traversing raw artifacts or accept arbitrary caller JSON as reviewed data.

`createAiHandoffEnvelope(brief, options)` takes the exact parsed result of
`serializeBriefJson(brief)`. It never changes that payload or recomputes arithmetic.
The detached result is deeply frozen. Both schema (`do.ai-handoff.v1`) and template
(`2026-10-v1`) versions are explicit. `generated_at` reuses the supplied Brief's
timestamp, so there is no clock dependency. A future UI must freeze the Brief once
per preview and manage source drift separately; this module cannot observe UI state.

Defaults are `current_brief`, `comprehensive`, and an empty question. Only current
Brief scope is supported. The six goals are comprehensive, executive, evidence
audit, pilot planning, data gaps, and technical methods. Questions are trimmed,
limited to 2,000 Unicode code points, and included only as untrusted JSON content.
Overlong questions fail; they are never shortened. No record is omitted to fit a
transport budget. `plainTextLength` counts Unicode code points, not UTF-16 code
units, bytes or URL-encoded length.

`renderAiHandoffMarkdown(envelope)` validates metadata and canonical payload parity
again. It renders complete JSON with sorted object keys and stable indentation;
array order and parsed values remain unchanged. HTML delimiters, ampersands,
backticks and Unicode line separators are JSON-escaped so record text cannot break
the code fence. The entire envelope round-trips through JSON without changing
source text. This is best-effort prompt guidance, not a guarantee against downstream
model hallucinations or prompt injection. Future UI must render text safely.

`createAiHandoffText(brief, options)` returns the frozen envelope, Markdown and
Unicode length together. No digest is generated or represented as certification.

## Defense in depth and scientific boundaries

The Brief builder filters release/display eligibility. Its serializer validates
finite values and scenarios and re-resolves requests and optional acquisition
guidance, but does not re-filter every constructed record. The handoff therefore
**rejects** a canonical payload with ineligible national/local records or
non-approved evidence; it does not silently rewrite the canonical payload. Existing
Brief/contracts/scenario implementations are unchanged.

Additional checks reject inconsistent national/finding artifact identities,
selected local context without an artifact ID, invalid timestamps, scenario/result
ID or pathway/mechanism mismatches, and bounded effects without an approved,
quantitatively admissible matching evidence record. A scenario's artifact version
identifies planning assumptions and need not equal the national MEPS version.

The source of scientific authority remains the validated loaders, review records
and deterministic evidence gates. PlanningBrief has no local artifact manifest or
source index; this module cannot independently authenticate a local record's
membership, reviewer identity, or a locator against original sources. No provenance
enrichment is attempted. Missing locators remain unresolved. Approved display
evidence is never promoted to an intervention effect. National evidence, selected
local context, assumptions, arithmetic and AI interpretation stay distinct.

All canonical warnings, uncertainty/distribution metadata, cost hierarchy,
pathway/mechanism boundaries, source IDs, nulls and numerical precision are
preserved. Sensitivity is always `not_in_planning_brief`. No sensitivity series,
unselected local records, unselected requests, or full-workspace appendix is added.
Illustrative **analytical records** fail; existing planning defaults remain clearly
labeled assumptions rather than evidence or proof of an analyst edit.

## Review and rollback

Implementation starts from `main@5cc772a198f86a92866bf14cb4ad545ff583200e`.
Read-only GitHub verification found #105 open/unmerged at
`c176e8843780039661cc1439ab56da6cb69a059f`, #106 draft at
`fef4f501998916c17a580120ced871e0afdfd1e9`, and open release/governance drafts
#94, #102 and #103. None was imported or changed. The four goals in #106 describe
a separate future concept and do not replace this specification's six goals.

The implementation and tests are one atomic commit; review documentation is a
separate commit. Review the versioned template fixture alongside the source.
Independent scientific/export/security review remains pending. CI success is not
scientific approval, permission to merge, or release authorization. Rollback is a
revert of the additive core and documentation commits; there is no runtime
activation or data migration to undo.

PRs B–E require explicit subsequent authorization: UI, source-drift gating and
accessibility; copy/download; safe provider launches; verified consented prefill;
and independently reviewed full-workspace scope. This PR does not merge, deploy,
synchronize static branches, modify Cloudflare, or change October 15 submission
artifacts. See [verification.md](verification.md) for checks and limitations.
