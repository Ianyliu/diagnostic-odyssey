# CI workflows: inventory, equivalence and qualification status

Last reconciled during the 2026-11-25 maintenance campaign (branch `chore/audit-docs-ci-tests-debt-20261125`).

> [!IMPORTANT]
> Statically verified with actionlint 1.7.12 and a programmatic before/after diff of all 16 workflows; integration
> results on GitHub are recorded in the pull request and in the [audit report](../audit-2026-11-25/README.md#integration-qualification).

## Workflow matrix (after)

| Workflow | Role | Triggers | Jobs (timeout) | Concurrency | Gates and responsibilities |
| --- | --- | --- | --- | --- | --- |
| `acquisition-browser-qa.yml` | Historical PR browser QA | pull_request (paths filtered) | `rendered-acquisition` (25 min) | PR: one group per PR, superseded runs cancelled; other events: unique per-run group | Runs only for PR #98 (stale; see open items) |
| `ai-handoff-core.yml` | PR exact-head verification | pull_request (paths filtered) | `exact-head` (20 min) | PR: one group per PR, superseded runs cancelled; other events: unique per-run group | Typecheck, tests, lint, build, Python unit tests, reviewed-artifact inventory, browser AI-handoff checks |
| `ci.yml` | Core CI | push (main only), pull_request | `verify` (20 min), `r-analysis-tests` (15 min) (before: `verify` (10 min), `r-analysis-tests` (15 min)) | PR: one group per PR, superseded runs cancelled; other events: unique per-run group | Typecheck, unit, tooling, characterization, Python validators, reviewed-artifact inventory, lint, build, repeated-build byte stability; separate R synthetic tests |
| `future-ai-experience.yml` | PR browser QA (+R) | pull_request (paths filtered), workflow_dispatch | `concept-browser` (20 min), `integrated-r` (15 min) | PR: one group per PR, superseded runs cancelled; other events: unique per-run group | Concept/Studio browser checks with build flags on/off; integrated R tests |
| `gate0-accessibility.yml` | PR accessibility gate | pull_request (paths filtered) | `exact-head-web` (20 min), `exact-head-r` (15 min) | PR: one group per PR, superseded runs cancelled; other events: unique per-run group | Exact-head web gate with axe, reflow, contrast, keyboard; R synthetic tests |
| `jules-pr-review.yml` | Automated PR review | pull_request | `review` (40 min) | unchanged (cancels superseded runs) | Third-party reviewer action; uses a repository secret |
| `local-context-candidate.yml` | Evidence generation (manual) | workflow_dispatch | `generate-candidate` (20 min) | never cancelled (dispatch-only evidence) | HRSA+ACS candidate generation, verification, aggregate artifact upload |
| `meps-candidate.yml` | Evidence generation (manual) | workflow_dispatch | `generate-candidate` (30 min) | never cancelled (dispatch-only evidence) | Survey-aware MEPS candidate generation with real data |
| `meps-linked-condition-candidate.yml` | Evidence generation (manual) | workflow_dispatch | `linked-condition-candidate` (30 min) | never cancelled (dispatch-only evidence) | Linked-condition candidate generation |
| `meps-linked-condition-feasibility.yml` | Evidence generation (manual) | workflow_dispatch | `linked-condition-feasibility` (30 min) | never cancelled (dispatch-only evidence) | Linked-condition feasibility analysis |
| `opening-circuit-qa.yml` | PR browser QA | pull_request (paths filtered) | `browser` (25 min) | PR: one group per PR, superseded runs cancelled; other events: unique per-run group | Opening-circuit and landing-evidence browser suites |
| `planning-intelligence-integration.yml` | PR browser QA | pull_request (paths filtered), workflow_dispatch | `combined-browser` (30 min) | PR: one group per PR, superseded runs cancelled; other events: unique per-run group | Combined planning-insights / AI-handoff browser matrix and PDF checks |
| `planning-request-handoff.yml` | PR browser QA | pull_request (paths filtered) | `analyst-journey` (20 min) | PR: one group per PR, superseded runs cancelled; other events: unique per-run group | Sensitivity-to-request handoff and export parity |
| `workspace-interactions.yml` | PR browser QA | pull_request (paths filtered), workflow_dispatch | `workspace` (15 min) | PR: one group per PR, superseded runs cancelled; other events: unique per-run group | Drafts, downloads, reflow, keyboard, motion, guided workspace, PDF |
| `workstream-h-qa.yml` | PR browser QA | pull_request (paths filtered), workflow_dispatch | `combined-physical` (30 min) | PR: one group per PR, superseded runs cancelled; other events: unique per-run group | Fail-closed PDF/JSON acceptance |
| `workstream-k-qa.yml` | PR security QA | pull_request (paths filtered), workflow_dispatch | `security-browser` (35 min) | PR: one group per PR, superseded runs cancelled; other events: unique per-run group | CSP/header regression behind simulated Vercel headers; optional immutable-preview URL input |

Workflow permissions are `contents: read` everywhere (unchanged), except the third-party review job, which already
declared its own scoped permissions.

## What changed, and what provably did not

Programmatic comparison of `main@5b81f5f` against the branch for all 16 workflows:

- **Unchanged:** every job id, every trigger event, every job `if:` condition, every top-level `permissions`. Path
  filters only gained entries (listed below); none was removed.
- **Changed timeout:** only `ci.yml` / `verify`, 10 → 20 minutes, because the job gained characterization, tooling and
  informational coverage steps (their local runtime is a few seconds each; the raise is headroom, not a measured need).
- **Pins:** all external actions are pinned to full commit SHAs (previously three workflows used floating `@v4`).
- **Node:** `node-version: 22` and `22.23.3` both became `node-version-file: .nvmrc` (22.23.3). Workflows that used the
  floating `22` now run the exact qualified patch release.
- **Python test dependencies:** the pin lives in [`requirements-test.txt`](../../requirements-test.txt). `planning-guidance`'s
  `npm test` used to run `pip install` itself; that was removed, so every workflow that runs `npm test` now installs the
  requirements explicitly (this added the step to `opening-circuit-qa`, `workstream-k-qa` and the four evidence-candidate
  workflows, which previously relied on the hidden install).
- **Reviewed artifacts:** the four hand-copied `sha256sum -c` blocks in `ci.yml` and the `for manifest in artifacts/reviewed/*/SHA256SUMS`
  discovery loops (which pass silently with fewer checks) were replaced by `npm run verify:artifacts`, which checks an
  explicit inventory (23 files across 4 releases, plus a pin on each `SHA256SUMS`) and fails on any missing, extra or
  mismatched directory, manifest or file. Candidate workflows keep their own checks of freshly generated outputs.
- **Added to `ci.yml`:** tooling tests, characterization (exact equivalence to the recorded baseline), informational coverage
  with a job summary and a 14-day artifact. Coverage has no thresholds and `continue-on-error: true`.
- **Concurrency:** pull-request runs share one group per PR (`<workflow>-pr-<number>`) with
  `cancel-in-progress: true`, so a newer push supersedes older validation. Every other event (`push` to `main`,
  `workflow_dispatch`) gets a unique group (`<workflow>-run-<run_id>`). This matters because GitHub keeps at most one
  *pending* run per concurrency group even with `cancel-in-progress: false`; a shared group could silently drop a queued
  `main` or dispatch run. Evidence-generating candidate workflows declare no concurrency group at all, so they are
  never cancelled or replaced. `jules-pr-review.yml` keeps its pre-existing PR-scoped group.
- **Coverage step:** `coverage/` is created before `tee` writes into it, the step runs under `bash` and records
  `PIPESTATUS[0]`, and a generation failure is written to the job summary, raised as a warning annotation and returned
  as the step's exit code. The step keeps `continue-on-error: true`, so coverage stays informational and never fails
  the job, but a failure is no longer reported as success.
- **Documentation links:** `npm run verify:docs` runs in `ci.yml` / `verify`; the checker's own tests run in
  `npm run test:tools`.
- **Path filters (narrow additions):** path-filtered browser workflows now also trigger on inputs that change what they
  execute: `package-lock.json` and `.nvmrc` (dependency and Node changes alter the built bundle and the browser runner),
  `.github/actions/setup-workspace/**` where the workflow calls that action, `requirements-test.txt` where the workflow
  installs it, and `packages/**` for `planning-intelligence-integration` and `workstream-h-qa` (their PDF/JSON exports
  are produced by package code bundled into the app). `ai-handoff-core` also tracks `package.json`, `tsconfig.base.json`,
  `scripts/verify/reviewed-artifacts.*` and the packages it bundles (`contracts`, `brief-core`, `planning-guidance`).
  TypeScript project files are not added to browser workflows: they do not change emitted bundles, and `ci.yml` runs
  `typecheck` on every pull request.
- **Composite action:** [`.github/actions/setup-workspace`](../../.github/actions/setup-workspace/action.yml) (Node from `.nvmrc`,
  `npm ci`, optional Python test deps) is now used by seven jobs in place of repeated setup-node + `npm ci` pairs. Checkout and exact-SHA
  verification steps stay in each workflow, before the action, with their original semantics.

### Trust boundary of the local composite action

A local composite action executes whatever is in the checked-out commit. It is therefore used only in unprivileged
`pull_request`, `push` and `workflow_dispatch` jobs that check out their own revision. No workflow uses
`pull_request_target` or `workflow_run`, and none may start doing so while it calls this action. Secrets are not
available to the composite steps beyond what the calling job already had (`jules-pr-review` and the candidate
workflows do not call it).

## Required status check compatibility

Branch protection was not inspected or changed. Job ids and workflow names were not renamed, so any existing
required check keeps its identity (for example `CI / verify`, `CI / r-analysis-tests`). Path-filtered workflows cannot
be required checks without a separate aggregate; none was added because no names changed. If a required-check list
is ever migrated, add a final `needs:` job and require only that aggregate.

## External action pins

All SHAs were matched against upstream tags with `git ls-remote --tags` (the floating `v4`/`v2`/`v1` tags point at the same commit).

| Action | Pinned commit | Release |
| --- | --- | --- |
| `actions/checkout` | `11d5960a326750d5838078e36cf38b85af677262` | v4.4.0 |
| `actions/setup-node` | `49933ea5288caeca8642d1e84afbd3f7d6820020` | v4.4.0 |
| `actions/upload-artifact` | `ea165f8d65b6e75b540449e92b4886f43607fa02` | v4.6.2 |
| `r-lib/actions/setup-r` | `f9a764fea8d5c63df6ef9a5c7795bf7deb5d7e05` | v2.14.0 |
| `sanjay3290/jules-pr-reviewer` | `66c23eff45e2103fb3d2d6873ba073e6e281ef31` | v1.0.2 |

Dependabot ([`.github/dependabot.yml`](../../.github/dependabot.yml)) proposes updates weekly for npm, GitHub Actions
(workflows and local actions) and pip. Minor/patch updates are grouped; majors arrive individually; there is no
auto-merge. R packages are not covered.

## Known weak points (not changed here)

- `acquisition-browser-qa.yml` only runs for PR #98 and is effectively dead; removal is a human decision ([open items](../governance/open-items.md)).
- R packages are installed unpinned from public binaries; the locally qualified set was haven 2.5.5, jsonlite 2.0.0,
  survey 4.5, testthat 3.3.2 (R 4.5.2).
- Pre-existing actionlint/shellcheck warnings (unused loop variables, SC2155) remain in ten workflows; no real actionlint
  errors exist.
- `jules-pr-review.yml` passes a repository secret to a third-party action on `pull_request`; forks do not receive it.

## Qualification status

| Stage | Status |
| --- | --- |
| Static validation (actionlint, YAML diff, Dependabot schema) | Done locally |
| Local execution of the commands the workflows run (Node 22.23.3, Python 3.12, R 4.5.2) | Done locally |
| Actual GitHub Actions execution | See the pull request checks and the [audit report](../audit-2026-11-25/README.md#integration-qualification) |
| Isolated Vercel Preview verification | See [Vercel projects](vercel-projects.md) and the audit report |
