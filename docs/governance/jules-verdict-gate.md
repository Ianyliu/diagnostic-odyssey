# Issue #101: Jules exact-HEAD verdict gate — draft ADR

**Status:** Draft. Independent security review and PM approval required before merge or required-check activation. No changes to existing reviewer, branch protections, application, evidence, or source-admission logic.

## Observed baseline (2026-10-12)

Existing jules-pr-review.yml pins sanjay3290/jules-pr-reviewer at 66c23eff45e2103fb3d2d6873ba073e6e281ef31, grants pull-requests:write and statuses:write and provides the JULES_API_KEY. Upstream source defaults to fail_on:blocking: a VERDICT:comment can post a green commit status, and its issue-comment upsert overwrites its previous review.

- PR #97 original HEAD 095c7ecd, run [38146305852](https://github.com/Ianyliu/diagnostic-odyssey/actions/runs/38146305852): final approve log and green status. Integration HEAD 05dd4235, run [38153337411](https://github.com/Ianyliu/diagnostic-odyssey/actions/runs/38153337411): timed out without verdict, posted comment status success and overwrote the first review. Only log-level historical evidence survived until the [separate append-only record](https://github.com/Ianyliu/diagnostic-odyssey/pull/97#issuecomment-6112361920), which did not reconstruct the original text.
- PR #99 initial [BLOCK evidence](https://github.com/Ianyliu/diagnostic-odyssey/pull/99#issuecomment-6113119823) falsely alleged package-lock.json was untracked. Exact-head CI ran npm ci successfully. This is a disputed BLOCK, never retroactively APPROVE. New final HEAD 4b56b381 obtained substantive APPROVE in [38170333794](https://github.com/Ianyliu/diagnostic-odyssey/actions/runs/38170333794). Both historical and new events must be preserved.
- Main at branch creation: 17fe339c01d749bff4922d41318c85055e137149. Branch-protection read returned 403 (resource not accessible to this GitHub integration); rulesets listed empty. Enforced required checks remain **unverified**.

## Decision and acceptance contract

Create a separate verifier rather than trusting green status of the third-party reviewer. A read-only pull_request job runs isolated syntax/negative tests. The privileged workflow_run verifier uses GitHub API metadata, current PR HEAD, reviewer-run/job logs, final posted review comment, and a distinct audit record. The privileged pull_request_target handler is metadata-only and seeds a pending commit status; it does not check out or execute PR code. Only default-branch code is executed.

The proposed required commit status is jules/verdict-gate, never the fixture job or the upstream jules/review status. Approval requires ALL:

1. Authenticated exact reviewer workflow identity and run, completed success, unique non-draft open same-repo PR, live head matching the review run's 40-character SHA, and no later same-head reviewer run.
2. Exactly one successful review job with one Jules session, one final-review-with-VERDICT marker and exactly one terminal approve/success log statement; never an interim message, timeout, missing log or verifier exception.
3. One GitHub-actions bot review comment carrying the same run-session ID, one exact VERDICT:approve line, no [BLOCKING] section, and a GitHub edit timestamp attributable to that run.
4. An independent new audit issue comment successfully created *before* a success status. A failed audit write yields no approval.

Missing verdict, benign COMMENT, BLOCK, timeout, stale SHA, skipped draft, fork, overwritten comment, ambiguous or duplicate run/job, altered session, audit/API failure all fail closed. The gate has no PM exception flag and never reads a PR description as executable instructions. A separately documented PM exception and independently attributable exact-head human review are a separate governance decision, not forged Jules approval.

## Audit/retention

Each completed attempt creates a distinct new PR audit comment (no update call) plus a per-attempt JSON Actions artifact with exact captured UTF-8 review body, SHA-256, run ID, HEAD, session, source comment ID and outcome. The audit comment HTML-escapes its review-body marker, preventing the upstream substring-based upsert from targeting that audit. Do not paste secrets or sensitive data into PR narratives.

**Not legally immutable:** GitHub repository administrators can remove comments/artifacts, the common bot identity is not a Jules signature, and these artifacts expire after 90 days. For long-term compliance, add separately authorized external WORM archival and independent credential/key management. The goal now is append-only by verifier behavior and resilient historical provenance, not an unsupported permanence claim.

## Security and operational risks

- Third-party review code is SHA-pinned but has privileged status/comment writes and a Jules API secret; review its pinned source and dependencies. It exposes untrusted PR title/body/diff to a model, subject to prompt injection and hallucinations. The #99 lockfile false positive proves reviewer conclusions require grounded verification.
- New verifier uses actions:read, pull-requests:read, issues:write, statuses:write, contents:read. The fixture job is read-only. It fetches logs through a short-lived signed HTTPS redirect without forwarding GITHUB_TOKEN. It never executes PR code or interprets PR prose as instructions.
- The upstream action also holds statuses:write. A compromised upstream action could spoof jules/verdict-gate; GitHub commit statuses do not restrict writers by context. Stronger isolation requires a dedicated GitHub App with an independently attributed required Check Run, a separate reviewed phase.
- PR-to-run association may disappear for old merged PRs. Such records cannot pass current-head verification; old runs remain historical only. API outages and callback races also require fail-closed handling.
- GitHub Actions workflow green on the default branch is distinct from the PR-head commit status; do not substitute either for substantive reviewer approval.

## Testing, activation and rollback

Tests cover timeout/green fallback, absent verdict, BLOCK, COMMENT, draft/fork, stale SHA, overwritten comment, wrong session, duplicate jobs, edited comment, malicious PR-description instructions, API/log missing, contradictory findings and marker-safe audit snapshot. Run node --check for both JS files and node --test tests/ci/jules-verdict.test.mjs. Require exact-HEAD GitHub proof plus independent review of code.

Before enabling any required check, exercise real nonproduction APPROVE, COMMENT, BLOCK, timeout, rerun and audit-failure callbacks. Confirm job logs, redirect behavior, append-only comment creation and artifact hash. This PR does **not** change branch protection; PM and security reviewer must separately decide activation. Workflow permissions must be reviewed in the actual repository, since branch-protection APIs were inaccessible.

Rollback before merge: close draft PR. After activation: PM-authorized revert of this isolated workflow and scripts, leaving historical audit records untouched. If status is pending/failed, do not force approval or weaken branch protections; hold merge or use a separately documented independently verified exception process. Coordinate any check-configuration change with PM. Never edit old Jules verdicts or PR #99.
