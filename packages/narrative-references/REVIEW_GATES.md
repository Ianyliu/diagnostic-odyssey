# Review, admission and consumer gates

This document defines contract semantics. It does not record scientific approval, source promotion, merge authorization or a runtime release.

## Record state table

| Release state | Reviewer status | Approved wording | Recorded review/source provenance | Meaning |
| --- | --- | --- | --- | --- |
| `candidate` | `draft` | null | Reviewer identity/time must both be null; source retention may be pending | Prepared material with no asserted completed review |
| `candidate` | `needs_review` | null | Identity/time both null, or both supplied with retained-source digest/retrieval time | Awaiting review, or recorded feedback requiring another review; neither means approval |
| `reviewed_not_released` | `approved` | Required | Reviewer identity/time, exact source digest/retrieval time, limitations and prohibited stronger claims required | Approved wording, **not yet independently promoted** |
| `reviewed_released` | `approved` | Required | Same approval provenance, plus a released catalog and independently verified release chain | Structurally release-shaped; authenticity/admission still requires the external gate |
| `rejected` | `rejected` | null | Reviewer identity/time and exact source digest/retrieval time required | Completed negative review; no display or recommendation permission |

Every other combination is invalid. A review completing does not imply approval. Revision feedback remains `candidate`/`needs_review`; rejection uses `rejected`/`rejected`. In particular, `reviewed_not_released` is deliberately narrower than “a reviewer looked at this.” No unapproved outcome requires or may carry approved wording.

Permitted governance paths are preparation → needs review → recorded revision feedback → new candidate revision → approval without release → independent promotion, or needs review → rejection. These are separately retained snapshots, not an automatic state machine or a validator permission to mutate a reviewed record. Reconsideration, changed wording, source bytes or applicability requires a new candidate identity and independent review; never overwrite a retained decision. Structural tests exercise the permitted snapshot combinations, not the authenticity or chronology of reviewer actions.

## Immutable applicability boundary

The catalog manifest requires `applicability_manifest_sha256`. It must be null for a candidate catalog and an exact lowercase SHA-256 for a released catalog. No existing reviewed artifact has this new field; this is an unreleased contract refinement.

The future applicability manifest is **substantive admission policy**, not UI configuration. It must have its own schema/version and immutable identity, bind exact claim IDs and catalog/source identities, and enumerate independently approved contexts and allowed uses. A context must explicitly identify condition/cohort, population bounds, setting, payer, geography, pathway step, mechanism and intended narrative use. An explicitly reviewed cross-system transfer is a decision, not an implicit wildcard. Unknown, absent or mismatched context values fail closed. No substring, fuzzy, label-humanization or nearest-context matching may grant use.

Review evidence must cover the exact candidate catalog, source files and applicability-map bytes. The immutable release catalog pins the review manifest and applicability manifest digests. A separately reviewed release allowlist pins the released catalog digest and those same manifest digests. Changing the map therefore changes the catalog bytes/digest and requires a new version and release allowlist identity, plus independent review; an old approval cannot silently apply to it.

Avoid circular digests: retain the pre-promotion candidate separately; its hash can be covered by review evidence before the released catalog embeds the review digest. Do not put a file's own digest inside itself. The eventual promotion verifier must check actual retained-byte preimages, exact version/identity relationships, reviewer authority and decision evidence. Hash-shaped strings, `approved` fields and CI success alone prove none of these things.

## Candidate preparation versus admission

Preserve the existing candidate IDs CDC26-PC-01, CDC26-SUPPORT-01, MAC24-COORD-01, MAC24-ACCESS-01, MAC24-REFERRAL-01, LOC24-ACCESS-01, LOC24-PATHWAY-01 and LOC24-WAIT-01. Their original scientific handoff has not been recovered. Source bindings and newly prepared wording are provisional until independently confirmed. LOC24-WAIT-01 remains background-only under the existing documented decision.

A candidate review package may retain original publications, exact locators, rights records and checksums for verification. It is not a released catalog. A packaging actor is not a scientific reviewer. Do not fabricate reviewer identities, approval dates, dispositions or source hashes. Rights and archival availability must be resolved before admission; a mutable URL alone is insufficient. Retain complete source documents for verification without unnecessarily including them in browser assets.

## Separately gated consumers

PR #79 remains contract-only. No loader, reader, export or applicability evaluator is implemented here. A later independently approved #26 PR may add a distinct read-only Evidence/reference section with exact approved wording, permitted use, applicability, limitations and source provenance. Keep narrative references outside `EvidenceRecord`, quantitative eligibility, scenario inputs and the Planning Brief. Standalone narrative JSON/print exports are deferred.

The reader must distinguish awaiting independent review, a valid no-applicable-reviewed-reference result, and invalid/unavailable artifacts. Candidate, rejected or invalid material cannot be a planning option. Approved background material cannot become a recommendation. A released catalog remains nonempty; a legitimate empty result is a filtered result or a separately accepted no-admission disposition, not a fabricated empty release.

Issue #23 is a separate contract/registry/UI/export workstream. Its hints are neither narrative references nor effects. Candidate mapping preparation may proceed independently, but implementation must follow #38's prerequisite gates. If Gate 1 is blocked, advancing Gate 2 requires explicit independent disposition.

Independent contract review of this exact PR HEAD, source/applicability review, promotion, reader/export/privacy review and merge authorization are separate gates. No automatic merge or source promotion is authorized. #68 integration, static synchronization and production deployment are outside this PR.
