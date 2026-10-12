# Issue #101 — Stage A: non-authoritative Jules review audit

**Security posture: DRAFT / NOT FOR MERGE OR ENFORCEMENT.** Stage A was authorized by the Chief PM on October 12, 2026 in [Issue #101 comment 6127596080](https://github.com/Ianyliu/diagnostic-odyssey/issues/101#issuecomment-6127596080). The independent reviewer [BLOCK at PR #102](https://github.com/Ianyliu/diagnostic-odyssey/pull/102#issuecomment-6126887140) remains controlling pending a second-pass review. The reviewed original head was 4109b609935239e393a388ee680d789c6dbd9713; baseline main advanced to 5cc772a198f86a92866bf14cb4ad545ff583200e after #99 was merged. No PR #99, product, science, reviewed data, or release changes are made here.

## Background: green Actions do not mean approval

Existing .github/workflows/jules-pr-review.yml pins the external action at 66c23eff45e2103fb3d2d6873ba073e6e281ef31. It holds PR-comment and commit-status write privileges. Default fail_on:blocking maps COMMENT to success; draft skip also yields successful job. It updates a marker-matching existing comment, erasing the former live text.

- PR #97 original head 095c7ecd… got APPROVE in [run 38146305852](https://github.com/Ianyliu/diagnostic-odyssey/actions/runs/38146305852); later head 05dd4235… timed out without verdict in [run 38153337411](https://github.com/Ianyliu/diagnostic-odyssey/actions/runs/38153337411) but was green and overwrote the original comment. Historic full prose was not recovered; [append-only log-derived correction](https://github.com/Ianyliu/diagnostic-odyssey/pull/97#issuecomment-6112361920) records the limitation.
- PR #99 initially got a [BLOCK with a false untracked-lockfile claim](https://github.com/Ianyliu/diagnostic-odyssey/pull/99#issuecomment-6113119823); actual package-lock.json was tracked and npm ci passed. That remains historical BLOCK. Later exact-head [run 38170333794](https://github.com/Ianyliu/diagnostic-odyssey/actions/runs/38170333794) issued a separate APPROVE.

## New Stage A sequence

The PR fixture job runs with contents:read and executes syntax checks, unit fixtures and simulated network/filesystem integrations. The privileged workflow_run job runs only on the trusted main branch, using existing actions:read / pull-requests:read / issues:write / statuses:write / contents:read permissions. It does not checkout, execute or shell-interpolate PR code or PR text. Only completed reviewer runs trigger audit; we deliberately removed pending callbacks that could race with finalized statuses. A per-reviewer-HEAD workflow concurrency group sets cancel-in-progress:false.

1. **COLLECT:** Re-fetch GitHub reviewer run/attempt, uniquely associated current PR, workflow blob identity, jobs, bounded signed HTTPS log redirect (no token forwarded), previous/current reviewer comments, and latest reviewer execution. Fetch failures are individually recorded where possible. Separate collectEvidence() captures original available source text and SHA-256 **whether provisional approval succeeds or fails**. Each record pins repo, PR, reviewer HEAD, run/attempt, capture time, comment ID, session, author, log hash/excerpts, and original available reviewer-body preimage(s). Logs normally omit full review prose. Any overwritten historical preimage *cannot* be recovered and is explicitly recorded as unavailable.
2. **APPEND:** POST a *new*, HTML-marker-escaped PR comment with the capture, negative assessment and the first complete reviewer body. Other available preimages reside in the JSON artifact. It never edits historical comments. Write a local JSON envelope with a SHA-256 of its canonical payload. If the comment API or filesystem fails, no provisional approval survives.
3. **ARCHIVE:** The GitHub artifact action uploads the exact captured JSON and emits artifact ID and SHA-256 ZIP digest, before finalization. Failure to upload prevents approval. Artifacts have 90-day configured retention; external WORM custody is not provided.
4. **FINALIZE:** Query GitHub for the artifact ID/name/digest/expiry and correct verifier workflow run; re-read PR, reviewer run/attempt, latest same-head review, workflow blob and original comment body/hash. It performs a last-minute fresh PR/run check before writing a non-authoritative status. If upload, comment capture, source bytes, current HEAD or attempts mismatch, issue a failure *when the GitHub API is available*. An older callback does not publish a status over a newer outcome. An audit comment and upload must already exist before any success. A second new append-only finalization-receipt comment captures the intended status, archive ID/digest and payload checksum *before* the status API write; a receipt is not proof that that later API write succeeded.
5. **STOP:** No branch-protection/required-check configuration, app credentials or live enforcement. The status context jules/verdict-gate is **not** an independently credentialed Check Run and must never be treated as authoritative.

The verifier produces two separate concepts: provisional evidence consistency and post-archive final disposition. The JSON records provisional assessment, not an assertion that later status publication succeeded. A final status may fail after an archived assessment, and the status API can be unavailable. GitHub event/commit-status operations are not atomic. Do not infer merge authorization from the audit or a green verifier job.

## F1–F5 independent-review remediation matrix

| Finding | Stage A classification | Evidence / limitation |
| --- | --- | --- |
| F1 — upstream can spoof jules/verdict-gate via statuses:write | **UNRESOLVED** | No exclusive publisher for native commit statuses. Stage B separately credentialed App Check Run with source-pinned required check is necessary for enforcement |
| F2 — negative verdict prose/hash lost | **MITIGATED** | captureEvidence() saves any available BLOCK/COMMENT/timeout/invalid text regardless of acceptance; JSON artifact and new audit comment include SHA-256, source and capture time. Cannot recover a version already overwritten before capture; bot identity and storage remain mutable |
| F3 — race, attempts, errors and historical successful statuses | **MITIGATED** | No requested/pending callbacks; per-HEAD non-canceling concurrency, latest-run/attempt checks in collect and finalize, fresh reads immediately before status, stale callback no-op, filesystem/HTTP faults post failure when possible. Cannot guarantee a prior success disappears during GitHub/API outages or a new run launched between last read and write |
| F4 — approval before durable evidence | **MITIGATED** | 3-stage workflow: capture → upload-artifact → artifact ID/digest verification → status. Missing/failed artifact, wrong digest, failed capture comment, or interrupted run cannot create an *honest verifier-produced* new success. Uploaded ZIP/metadata, comments and status still have mutable/expiring custodians |
| F5 — bot author/time not independent Jules attestation | **UNRESOLVED** | Session, source and hash are consistency signals only, never a cryptographic model signature. Dedicated App/independent attestation is Stage B |

**No Finding is claimed FIXED as an enforcement guarantee.** The improvements are intentionally non-authoritative; F1 and F5 remain blockers to trustworthy required-check activation.

## Adversarial coverage and reproducibility

Run:

    node --check scripts/ci/jules-verdict-core.mjs
    node --check scripts/ci/verify-jules-run.mjs
    node --test tests/ci/jules-verdict*.test.mjs

The fixture integration starts the real two-phase Node handler in isolated subprocesses with a mock authenticated GitHub API, fake signed-log redirects and local scratch artifacts. Its TAP and SHA-256 are retained as a *simulation proof artifact* in the PR fixture CI, **not a real workflow_run production archive**. Scenarios include historical BLOCK and timeout bodies, invalid/COMMENT, overwritten/edited comments, duplicated reviews, malicious PR instructions, uncertain author, missing log, log redirects, out-of-order same-HEAD runs/attempts, stale HEAD, prior spoofed successful status, failed audit POST, missing artifact, wrong artifact ID/digest, failed upload, local file creation failure, and status API error. A synthetic artifact API is not actual GitHub artifact publication.

## Still required before future enforcement

Independent security reviewer must audit exact new HEAD and challenge the evidence identity/custody, API completeness, concurrent finalizers, data retention and error paths. Stage A can be considered *only* for non-authoritative audit infrastructure. A real deployment smoke test, authenticated reviewer-origin attestation, dedicated GitHub App Check Run and expected-source pinning, independent durable retention (WORM if necessary), and an explicit PM Stage B implementation decision are prerequisites for an authoritative gate. No such authorization is implied. GitHub branch-protection read was previously 403; absence of readable rules is NOT evidence they are unset.

## Rollback and containment

While draft/unmerged, close PR #102 or leave it blocked without touching existing main workflows or branch rules. Following any separately approved Stage A merge, a reviewed revert removes the isolated script/workflow; preserve audit records and block merges whenever the audit or verification is unavailable. Never manufacture APPROVE, change a historical BLOCK, weaken required checks, change PR #99, or perform scientific/source admission. A native commit-status failure cannot substitute for a separate independent human/PM exception decision.
