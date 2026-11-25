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

_Pending: recorded by the final local acceptance gate._
