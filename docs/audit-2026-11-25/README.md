# Engineering maintenance audit: 2026-11-25

Scope: documentation, CI/CD, unit testing, coding practices and technical debt, with **no change to scientific behavior**.
Baseline: `main@5b81f5fea2bdb3545e47302fde54c4b4c2a5f2b0`. Work branch: `chore/audit-docs-ci-tests-debt-20261125`
(local only; nothing pushed, merged or deployed). Disposition and evidence are summarized at the end of this file.

## Findings and disposition

| # | Finding | Disposition |
| --- | --- | --- |
| H1 | `apps/web/api`, `build/` and tests were not type-checked | **Resolved.** Browser/server/test projects, `api/tsconfig.json` for the Vercel builder, `tsconfig.tools.json`; 27 test-fixture type errors fixed without `any`, ignores or weakened strictness; 1 unreachable `split()` narrowing in the endpoint ([ADR 0002](../adr/0002-split-typescript-projects-and-keep-tests-hermetic.md)) |
| H2 | `planning-guidance` `npm test` ran `pip install` | **Resolved.** Removed; deps pinned in `requirements-test.txt`; every workflow that runs `npm test` installs them explicitly; suite passes with outbound networking denied (`npm run test:offline`) |
| H3 | `api/ai-guidance.ts` is a 205 KB single file | **Deferred, with evidence.** The real Vercel builder does not trace local `.ts` modules; a split function fails with `ERR_MODULE_NOT_FOUND` at runtime ([ADR 0003](../adr/0003-vercel-api-functions-stay-self-contained.md)). Added 387-case characterization, self-containment test and an offline Vercel build check instead |
| H4 | Broken local Node (Homebrew node 26 missing `libsimdjson`), no `.nvmrc` | **Partially resolved.** `.nvmrc` (22.23.3) added; the campaign used an isolated toolchain. The machine's Homebrew Node remains broken and was deliberately not modified |
| M1 | CI duplication/drift, unpinned actions, no concurrency | **Mostly resolved.** All actions SHA-pinned with releases recorded; Node from `.nvmrc`; composite setup action in seven jobs; PR-only cancellation; inventory-based artifact checks. Not done: R package pinning, stale `acquisition-browser-qa.yml` removal ([workflow matrix](../operations/ci-workflows.md)) |
| M2 | No coverage or dependency update automation | **Resolved.** Informational coverage (no thresholds); Dependabot for npm, Actions and pip, grouped minor/patch, no auto-merge |
| M3 | Test gaps | **Partially resolved.** ~3,650 characterization cases, API snapshot for 8 packages, 387 endpoint cases, contracts public-API test, tooling tests. `ui` and `condition-adapters` still have no package-level `test` script |
| M4 | Thin lint | **Partially resolved.** Type-aware async rules and `eqeqeq` at zero warnings. Still off: `no-explicit-any` (179), `no-non-null-assertion` (309), `no-unnecessary-type-assertion` (81) |
| M5 | Oversized modules | **Partially resolved.** `contracts/src/index.ts` (1,089 lines) split into 9 modules; `PilotPage.tsx` (754 lines) into 9 modules with rendered-parity proof. Remaining: `ai-guidance.ts` (deferred), `linked-condition-candidate.ts` (946), `BriefPage.tsx`, `AiHandoff.tsx`, `LocalContextPage.tsx` |
| M6 | Documentation sprawl and drift | **Partially resolved.** User's in-progress edits preserved verbatim in their own commit and then extended; capability status, CI, ADRs, package READMEs, link checker. Historical archives untouched |
| M7 | Missing governance files | **Resolved where possible.** CONTRIBUTING, SECURITY, PR template added; CODEOWNERS and the security contact are explicit open items ([open items](../governance/open-items.md)); no LICENSE by instruction |
| M8 | Large tracked/generated tree | **Untouched by design.** Reviewed artifacts are immutable; now guarded by an explicit inventory |

### Newly discovered

1. CI silently depended on the hidden `pip install`: six workflows (`opening-circuit-qa`, `workstream-k-qa`, four evidence-candidate workflows) ran `npm test` without installing Python deps.
2. Reviewed-artifact checks in several workflows used `for manifest in artifacts/reviewed/*/SHA256SUMS` discovery loops, which pass with fewer checks if a release disappears.
3. Narrowing `apps/web/tsconfig.json` made the Vercel builder report `node:crypto`/`Buffer`/`process` type diagnostics for `api/ai-guidance.ts` (fixed with `api/tsconfig.json`; the offline build check now fails on any TS diagnostic).
4. `scenario-comparison.test.ts` built a Brief with a stale `AnalysisContext` shape (`national_artifact_version`); several tests feed out-of-contract values (`"unavailable"`, `"pending"`). Fixed or made explicit via `invalidInput()`.
5. `test:coverage` (added during this campaign) initially failed because the lcov reporter does not create its directory; fixed.
6. `apps/web/src/server/planning-guidance` is an unused, byte-for-byte mirror of `packages/planning-guidance/src` enforced only by a test. Kept (removal needs an owner decision).
7. Some `apps/web/src/data` modules import extensionless relative specifiers (for example `decisionTrace.ts`), so they cannot be loaded by Node-only tests; they are covered by browser suites.
8. `acquisition-browser-qa.yml` only runs for PR #98.

None of these changed scientific, security or presentation behavior. No semantic defect requiring a correction was found.

## Equivalence and verification

See [final acceptance results](#final-acceptance-results).

## Not done / needs authorization

- Actual GitHub Actions runs and an isolated Vercel Preview verification (require push authorization).
- Branch protection, license, code owners, security contact: see [open items](../governance/open-items.md).

## Final acceptance results

Gate run from a **fresh clone** of the branch HEAD (`bcb18ea`) with an isolated toolchain (Node 22.23.3 / npm 10.9.9, Python 3.12.14 with
`jsonschema==4.26.0`, R 4.5.2). Nothing was pushed, merged or deployed. These are **local** results only.

| Gate | Command | Result |
| --- | --- | --- |
| Clean install | `npm ci` | pass |
| Types | `npm run typecheck` | pass (all workspaces, `apps/web` browser/server/test projects, tools) |
| Lint | `npm run lint` | pass, 0 warnings |
| Unit tests | `npm test` | 515 / 515 pass (baseline 508 / 508; all 508 baseline tests present and passing, 7 added) |
| Tooling tests | `npm run test:tools` | 12 / 12 |
| Equivalence | `npm run test:characterization` | 3 / 3: ~3,650 behavior cases, type-level API of 8 packages, 387 endpoint cases, all byte-identical to the pre-refactor goldens |
| Reviewed artifacts | `npm run verify:artifacts` | 23 files in 4 releases match the inventory; `git diff 5b81f5f..HEAD -- artifacts/` is empty |
| Docs | `npm run verify:docs` | 56 maintained Markdown files, links and anchors resolve |
| Python | `npm run test:py` | 32 + 51 tests and the candidate-output verifier pass |
| R | `npm run test:r` | synthetic MEPS pipeline tests pass |
| Build | `npm run build` | pass |
| Reproducibility | `npm run verify:build` | repeated builds emit 50 identical files |
| Hermeticity | `npm run test:offline` | pass with outbound networking denied |
| Coverage (informational) | `npm run test:coverage` | 94.80 % lines, 83.63 % branches, 91.24 % functions across packages and web tests; no thresholds |
| Vercel build | `scripts/verify/vercel-function-build.sh` | functions are exactly `ai-guidance` and `ai-preview`, headers/routing intact, no TS diagnostics, both load |
| Workflows | actionlint 1.7.12 | no errors; 11 pre-existing shellcheck style warnings, same as baseline |
| Aggregate | `npm run check` | pass |
| Browser regression | 9 existing suites (acceptance, continuity, visual-quality, motion, guided-workspace, planning-insights, planning-request-handoff, opening-circuit, landing-evidence) | 9 / 9 pass on the final build (baseline 9 / 9) |
| Rendered parity | `tests/browser/pilot-parity.mjs` | `/pilot` at 390 / 768 / 1440 px, light and dark, 12 states each: `<main>` HTML, ARIA tree and focus order identical in all 72 states; 0 screenshot differences beyond rasterization noise that also occurs within the baseline build |

Not run: GitHub Actions; an isolated Vercel Preview; `tests/browser/test_workstream_h_inventory.py` (needs PyMuPDF); browser PDF suites that need extra Python packages.

### Bundle differences, explained

- `index-*.css` is **byte-identical** to the baseline. (An earlier intermediate state reordered 39 `.decision-trace` rules; the acceptance audit found it by comparing CSS bundles rule by rule, rendered parity had not flagged it, and it was fixed and guarded by `pilot-css-order.test.ts`.)
- `index-*.js`, `FutureAIExperiencePage-*.js` and `index.html` differ in hash. Identified causes: the build-provenance stamp (`sourceSha`, `sourceCommitDate`), the chunk filename references between the two JS files and `index.html`, minifier identifier renames after module restructuring, and about 1.2 KB of additional module wrappers. The JS was not attributed byte for byte; scientific equivalence rests on the characterization, parity and browser evidence above, not on bundle hashes.

### Residual risks

- CI changes are statically validated only; the first PR run is the real test (for example the added Python install steps and the composite action).
- Vercel behavior of `apps/web/api` is verified with the local builder (`@vercel/node` 32.0.0), not the production builder.
- R packages are installed unpinned in CI; browser suites use system Chrome and cover Chromium only.
- Large golden files (~0.6 MB) must be reviewed as data, not skimmed.

### Reviewer handoff

```bash
git switch chore/audit-docs-ci-tests-debt-20261125        # base: main@5b81f5f; first commit is the user's pre-existing doc edits, verbatim
nvm use                                                     # 22.23.3
python3 -m venv .venv && . .venv/bin/activate && python3 -m pip install -r requirements-test.txt
npm ci && npm run check:full
scripts/verify/vercel-function-build.sh                      # downloads a pinned Vercel CLI; no login
git diff --stat 5b81f5f..HEAD -- artifacts/                  # must be empty
```

Review in this order: [ADR 0001](../adr/0001-behavior-preserving-changes-need-exact-equivalence-evidence.md) (how equivalence is proven), `tests/characterization/golden/PROVENANCE.md`,
the `contracts` and `PilotPage` commits (mechanical moves), the CI commit with [the workflow matrix](../operations/ci-workflows.md), then docs.
