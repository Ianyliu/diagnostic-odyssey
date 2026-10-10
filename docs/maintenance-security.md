# Submission maintenance security review

## Actions

All external workflow actions are pinned to the full commit resolving their existing version tag during this review. No action major upgrades or expanded token permissions. CI and analytical acquisition workflows already use contents:read; Jules now has an explicit read-only workflow default and retains only its required job permissions: contents:read, pull-requests:write and statuses:write. Its job timeout is bounded at 40 minutes around the action's 30-minute review timeout.

The pinned reviewer source masks its Jules key, rejects pull_request_target, skips fork PRs by default, fetches diffs through GitHub APIs, and posts comments/statuses. It does not check out or run PR code. The token and API key remain repository secrets; Census credentials are scoped to acquisition/verification steps, sanitized from output, and excluded from aggregate candidate packages. Prompt-injection and external-service trust remain reasons to require independent substantive review; a bot status alone does not establish correctness.

The older Jules HTTP 400 FAILED_PRECONDITION errors occurred at external session creation, separately from successful application CI. Do not disable the workflow or treat authentication/API errors as application failures. Check service account access/API enablement in Jules if this recurs. Each maintenance merge records an exact-head code/test review. Copilot quota failures and empty bot replies are not counted as substantive reviews.

## Main branch protection: manual owner action

The inspected main protection endpoint returned 404 (unprotected); repository rulesets were empty. No mandatory review gate is currently enforced. Admin permission is available, but this audit does not invent an unapproved reviewer roster or impose a potentially unfulfillable sole-maintainer approval gate.

Before submission, the owner should configure a main ruleset requiring PRs, successful CI jobs verify and r-analysis-tests, one independent approving reviewer, resolved review conversations, and a current/up-to-date tested merge base. Dismiss stale approvals or require approval after the latest reviewable push. Block force pushes and branch deletion; avoid routine admin bypass. Ensure an eligible independent reviewer exists before enabling the approval requirement. Keep external Jules service availability separate from application CI; document equivalent independent review when unavailable, while respecting any enforced requirement.

Maintenance merges use an expected-head SHA check, preserve atomic commits and remote branches, and test combined behavior. Recheck protections and actual check names in GitHub settings when enabling the ruleset.

## Deployment

The static branch has independent history and must be updated by an ordinary non-force commit. Cloudflare Pages is a direct-upload project: pushing GitHub does not prove deployment. Verify the returned deployment ID and actual live deep links/assets before calling a release complete; retain the previous deployment as rollback. Preserve Pages SPA behavior, immutable hashed-asset caching, index revalidation and existing security headers. CSP currently permits inline scripts/styles for the existing application. Further CSP tightening requires rendered-browser testing and is deferred rather than risking the submission demo.

Reference: [GitHub secure use](https://docs.github.com/en/actions/reference/security/secure-use).
