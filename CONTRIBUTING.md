# Contributing to Diagnostic Odyssey

Diagnostic Odyssey is a scientific decision-support platform, not only a web app. A change that is
"just a refactor" can still change what a planner is told. Read the
[scientific guardrails](docs/scientific-guardrails.md) before changing calculations, validators,
exports, release gates or any text that interprets numbers.

## Set up

| Tool | Version | Needed for |
| --- | --- | --- |
| Node.js | exactly the version in [`.nvmrc`](.nvmrc) (22.23.3); `engines` allows `>=22` | everything JavaScript/TypeScript |
| Python 3 | 3.9+ locally; CI uses the runner's `python3` | JSON Schema validators called by the workspace tests |
| R | 4.x with `haven`, `jsonlite`, `survey`, `testthat` | `npm run test:r` and the analytical pipeline only |

```bash
npm ci
python3 -m venv .venv && . .venv/bin/activate
python3 -m pip install -r requirements-test.txt   # pinned jsonschema; tests never install packages themselves
```

Test commands are offline and must not mutate your environment. A missing Python dependency is a test
failure with a clear message, not a skipped test. `npm run test:offline` runs the suite with outbound
networking denied (macOS `sandbox-exec`, Linux `unshare`) to prove it.

## What `npm run check` covers

`npm run check` is the fast local gate. It runs, in order:

1. `typecheck`: every workspace plus `tsconfig.tools.json`. `apps/web` is checked as separate
   browser (`src`), server (`api`, `build`, `src/server`, `vite.config.ts`), and test projects.
2. `lint`: ESLint with `--max-warnings=0`, including type-aware async rules on files owned by a tsconfig.
3. `test`: all workspace unit tests (including Python-backed schema agreement tests).
4. `test:tools`: tests of repository tooling (reviewed-artifact verifier).
5. `test:characterization`: exact-equivalence comparison with the recorded baseline (see below).
6. `verify:artifacts`: reviewed artifacts against the authoritative inventory
   (`scripts/verify/reviewed-artifacts.inventory.json`).
7. `verify:docs`: relative links and anchors in maintained Markdown (historical archives excluded).
8. `build`: production Vite build.

`npm run check:full` adds `test:py` (Python unit tests and the candidate-output verifier),
`test:r` (synthetic R pipeline tests) and `verify:build` (repeated-build byte stability).

Not covered by either command, and required where relevant to your change:

- Browser acceptance, accessibility and PDF suites: [docs/testing.md](docs/testing.md#browser-acceptance).
- `scripts/verify/vercel-function-build.sh`: offline Vercel build of `apps/web/api` (downloads a pinned
  CLI; no login). Run it when touching `apps/web/api`, `vercel.json` or the TypeScript project files.
- `python3 -m unittest discover -s tests/browser -p 'test_workstream_h_inventory.py'` (needs PyMuPDF).
- `npm run test:coverage` is informational only; there are no coverage thresholds.

Passing software checks is **not** scientific release approval.

## Behavior-preserving changes need equivalence evidence

Refactors must not change scientific outputs, validator verdicts, export contents, security behavior or the
rendered experience. `tests/characterization/` holds about 3,650 deterministic cases, a type-level public API
snapshot of every package, and 387 cases for the Preview-only endpoint, all generated from pre-refactor code
([provenance](tests/characterization/golden/PROVENANCE.md)). Comparison is exact: no numeric tolerances.

- If a characterization test fails, investigate the first listed case. Do **not** regenerate goldens to make it pass.
- A deliberate behavior change belongs in its own commit with a written justification and regenerated goldens.
- For UI structure changes, `tests/browser/pilot-parity.mjs` shows how to compare rendered HTML, ARIA and focus order.
- Source-text contract tests may not be weakened to accommodate moved code; update them to assert at least as much.

## Hard rules

- Never commit raw microdata, secrets, `.env` files, local paths or generated candidates ([data/README.md](data/README.md)).
- Never edit `artifacts/reviewed/**` or anything under historical audit records. Reviewed artifacts are immutable and
  checksummed; a new release is a deliberate change to the inventory file plus review documentation.
- `apps/web/api/*` files are public Vercel functions and must stay self-contained ([ADR 0003](docs/adr/0003-vercel-api-functions-stay-self-contained.md)).
- Missing, suppressed and unreleased values are never zero. Scenario assumptions are never observed effects.
- Do not add dependencies without a stated need; do not enable auto-merge; do not change branch protection from a PR.
- No new LICENSE, owners or security contacts without the project owner's decision ([open items](docs/governance/open-items.md)).

## Commits and pull requests

- Small, atomic, independently revertible commits with imperative subjects (`fix(api): ...`, `refactor(contracts): ...`).
- Run `npm run check` (and the extra commands above that apply) before opening a PR; fill in the PR template.
- CI details, required-check names and the workflow matrix: [docs/operations/ci-workflows.md](docs/operations/ci-workflows.md).
- Significant engineering decisions get a short ADR in [docs/adr](docs/adr/README.md).
