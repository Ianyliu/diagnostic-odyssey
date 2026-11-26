# Open governance items (need a human decision)

These items were deliberately **not** resolved by the engineering maintenance campaign because they require the
project owner. Do not fill them in with guesses.

| # | Item | Why it is open | Where it surfaces |
| --- | --- | --- | --- |
| 1 | Private security reporting channel | No contact or GitHub private-reporting setting was provided or verified | [SECURITY.md](../../SECURITY.md) |
| 2 | Code owners | No owner identities or teams were provided | [.github/CODEOWNERS](../../.github/CODEOWNERS) |
| 3 | Software license | Licensing is a legal decision; none was added | repository root has no LICENSE |
| 4 | Required status checks / branch protection | Out of scope and not changed; names are kept stable | [CI workflows](../operations/ci-workflows.md#required-status-check-compatibility) |
| 5 | Whether stale `acquisition-browser-qa.yml` (runs only for PR #98) should be removed | Workflow is historical; removing it changes recorded evidence responsibilities | [CI workflows](../operations/ci-workflows.md) |
| 6 | Pinning R package versions (renv or lockfile) | CI installs the latest binary packages; a lockfile is a new layer needing owner agreement | [docs/testing.md](../testing.md) |
| 7 | Isolated Vercel Preview verification and GitHub CI qualification of this branch | Authorized and performed on 2026-11-25; results and limits recorded in the audit report | [audit report](../audit-2026-11-25/README.md#integration-qualification) |
| 8 | Vercel project `diagnostic-odyssey-strategy-lab` fails on every commit (`apps/strategy-lab` exists only on an unmerged design branch) | Disconnecting, deleting or reconfiguring a Vercel project needs owner authorization; pre-existing and non-blocking | [Vercel projects](../operations/vercel-projects.md) |
| 9 | Preview deployment protection prevents automated deployed-browser testing without an owner-provided bypass mechanism | Creating protection-bypass tokens changes project settings | [audit report](../audit-2026-11-25/README.md#integration-qualification) |
