# Verification matrix

Application source: **`24da6f69321755fce8e4ad0d379ca3741abfbe87`**. Baseline: **`0ad2c55db55d23c1f1b35b5e57db89f5fc0ba886`**. The publication source tree is byte-identical to the tested local source tree (`6d64649524aa52a7ac547e7bb110122bf33a3cba`); only commit identity changed to a public no-reply address. Later documentation/evidence commits are listed in the [inventory](commits.md). Tests ran locally against production builds unless a fixture is explicitly named. Remote CI status belongs to the PR and must be reviewed separately.

Environment: Node **22.23.3**, Python **3.12.14**, `jsonschema` **4.26.0**, R **4.5.0**, Playwright **1.64.0**, axe-core **4.11.1**, Chromium **154.0.8037.57** (Linux). Actual-PDF verification was repeated with CI's pinned `pdfplumber==0.11.7`. Browser dependencies are isolated outside the repository; production dependencies were not changed.

## Completed checks

| Check / exact command | Result | Evidence / limits |
| --- | --- | --- |
| `npm ci --no-audit --no-fund` in a fresh detached worktree, then `npm ls --all --json` | PASS | Clean lockfile install; no dependency edits. [Install log](evidence/repro-install.log). |
| `npm run typecheck` | PASS | All applicable workspaces. [Log](evidence/final-typecheck.log). |
| `npm run lint` | PASS | Zero warnings. [Log](evidence/final-lint.log). |
| `npm test` | PASS | Complete workspace unit suite, including actual Python schema agreement and bounded-runner failure cases; no skips. [Log](evidence/final-test.log). |
| `npm run build` | PASS with existing size advisory | Production build; main chunk approximately 571 kB minified. [Log](evidence/final-build.log). |
| `Rscript analysis/r/tests/run_tests.R` | PASS | Synthetic analytical tests; no microdata download or re-estimation. [Log](evidence/r-tests.log). |
| `python3 -m unittest discover -s analysis/local_context/tests -p 'test_*.py'` | PASS · 51 tests | [Log](evidence/python-local.log). |
| `python3 -m unittest discover -s packages/narrative-references/test -p 'test_provenance.py'` | PASS · 32 tests | [Log](evidence/python-provenance.log). |
| `bash analysis/local_context/tests/test_candidate_output_verifier.sh` | PASS | Candidate-output verifier regressions. [Log](evidence/candidate-verifier.log). |
| `node tests/browser/acceptance.mjs` | PASS · 26 groups | Eleven core routes × 1440/820/360px × light/dark, all-route axe checks, keyboard/history/anchors, drafts, extreme arithmetic, print and opening behavior. [Result + snapshots](evidence/acceptance.json). |
| `node tests/browser/gate0-accessibility.mjs` | PASS · 14 groups | 390px explicit/system themes × reduced/full motion; disclosures, keyboard navigation, focus and measured caption contrast at 1440/768/390px. [Results](evidence/accessibility.json). |
| `node tests/browser/workspace-continuity.mjs` | PASS · 2 groups | Unfinished input survives navigation; failed download recovers. [Results](evidence/workspace-continuity.json). |
| `node tests/browser/visual-quality.mjs` | PASS · 8 rows | 320/390/768/1440px × light/dark; whole numeric tokens, no overflow, mobile menu Escape and focus restoration. [Results](evidence/visual-quality.json). |
| `node tests/browser/motion.mjs` | PASS · 4 modes | Opening, keyboard interruption, reduced motion, query/deep-link bypass and session replay suppression. Observed opening layout shift: 0. [Results](evidence/motion.json). This is not a field Core Web Vitals measurement. |
| `node tests/browser/ai-handoff.mjs` | PASS · 24 groups | Six-goal payload/full Markdown bytes, clipboard failures, hostile input, stale sources, missing/suppressed/illustrative inputs, dialogs, focus/keyboard and print. Zero external requests/page errors. [Results](evidence/ai-handoff.json). |
| `node tests/browser/planning-insights.mjs` | PASS · 14 groups | Four widths × both themes, axe, stale states, extreme inputs, print opt-in and invariant JSON. [Results](evidence/planning-insights.json). |
| `node tests/browser/future-ai-experience.mjs` | PASS · 10 groups | Four concept goals × 1440/768/390px × light/dark with axe; reversible controls, keyboard tabs, canonical state and no network inference. [Results](evidence/future-ai.json). |
| `node --experimental-strip-types tests/browser/verify-ai-handoff-exports.ts "$AUDIT/final-future-ai-experience"` | PASS | Export contract validation. [Log](evidence/handoff-schema.log). |
| `python3 tests/browser/verify-insights-pdfs.py "$AUDIT/final-planning-insights"` | PASS · 4 PDFs | Summary off/on, all-context and extreme inputs; source locators/content and footer clearance. [PDF checks](evidence/pdf-verification.json). |
| `pdftotext -layout` for handoff dialog open/closed PDFs, then `cmp` | PASS | Byte-identical extracted text; dialog excluded from print. |
| `pdftotext -layout` for baseline/candidate Brief PDFs; compare after whitespace and execution-timestamp normalization | PASS | Same substantive extracted text. [Result](evidence/pdf-parity.json). |
| Governed capture/comparison and browser snapshot comparison | PASS | [Scientific report](scientific-invariance.md). |
| Twelve workflow-link hover text contrast measurements | PASS | Six links × both themes, measured against rendered card backgrounds; all ≥4.5:1. [Ratios](evidence/hover-contrast.json). |
| `npm audit --json` | **2 moderate package entries remain; exit 1** | No high/critical findings. Reachability assessment in [audit](README.md#security-findings-and-residual-risks); [raw audit](evidence/dependency-audit.json). Not labeled a clean audit. |

## Build combinations

Every combination builds its own directory and runs `planning-intelligence-integration.mjs` against that exact preview. The six-goal canonical/full-Markdown checks from #112 and the visitor controls from #110 remain active.

| Insights / concept | Integration groups | Disabled-concept bundle check |
| --- | --- | --- |
| `on` / `on` | [5 PASS](evidence/integration-on-on.json) | Not applicable |
| `on` / `off` | [5 PASS](evidence/integration-on-off.json) | [PASS: no concept chunk or entry points](evidence/concept-excluded-on-off.json) |
| `off` / `on` | [5 PASS](evidence/integration-off-on.json) | Not applicable |
| `off` / `off` | [5 PASS](evidence/integration-off-off.json) | [PASS: no concept chunk or entry points](evidence/concept-excluded-off-off.json) |

The unconfigured default build (both available) is used for the full acceptance suite. No production configuration was edited.

## Commands and environment

Commands above ran from `/workspace/diagnostic-odyssey`. The isolated clean-install/PR #113 compatibility checkout is `/workspace/work/diagnostic-odyssey-repro`. Output is under `/workspace/work/diagnostic-odyssey-audit` (`$AUDIT` below). These environment values explain the local paths; substitute your own tool locations when reproducing.

```bash
export PATH=/workspace/work/audit-tooling/node_modules/node/bin:/workspace/.venvs/diagnostic-odyssey/bin:/workspace/.tools/diagnostic-odyssey-r/bin:$PATH
export PLAYWRIGHT_RUNNER=/workspace/work/audit-tooling/package.json
export QA_CHROME=/usr/bin/chromium
export AUDIT=/workspace/work/diagnostic-odyssey-audit

# Production preview; final acceptance used a frozen copy at port 4187.
node node_modules/vite/bin/vite.js preview apps/web \
  --outDir "$AUDIT/final-static" --host 127.0.0.1 --port 4187 --strictPort
QA_BASE_URL=http://127.0.0.1:4187 QA_OUTPUT="$AUDIT/complete-acceptance" \
  node tests/browser/acceptance.mjs

# Other browser suites used QA_BASE_URL=http://127.0.0.1:4186 and the
# corresponding verified-* or final-* output directory named by their evidence.
# AI handoff also used this local fixture at port 4197:
node node_modules/vite/bin/vite.js --config tests/browser/ai-handoff-fixture/vite.config.mjs

# Repeat for insights=on/off and concept=on/off; preview each directory on 4199.
VITE_PLANNING_INSIGHTS_PREVIEW="$insights" VITE_FUTURE_AI_EXPERIENCE_DEMO="$concept" \
  node node_modules/vite/bin/vite.js build apps/web --outDir "$AUDIT/matrix-$insights-$concept/dist"
QA_BASE_URL=http://127.0.0.1:4199 QA_OUTPUT="$AUDIT/matrix-$insights-$concept/integration" \
  QA_INSIGHTS_MODE="$insights" QA_CONCEPT_MODE="$concept" \
  node tests/browser/planning-intelligence-integration.mjs
QA_BASE_URL=http://127.0.0.1:4199 QA_BUILD=off QA_DIST="$AUDIT/matrix-$insights-off/dist" \
  QA_OUTPUT="$AUDIT/matrix-$insights-off/concept-off" node tests/browser/future-ai-experience.mjs

node --experimental-strip-types scripts/maintenance/capture-governed-regression.mjs . "$AUDIT/candidate-governed.json"
node scripts/maintenance/compare-governed-regression.mjs "$AUDIT/baseline/governed.json" "$AUDIT/candidate-governed.json" "$AUDIT/scientific-invariance.json"
node tests/browser/compare-results.mjs "$AUDIT/baseline/browser/qa-results.json" "$AUDIT/complete-acceptance/qa-results.json" "$AUDIT/browser-invariance.json"
```

## PR #113 compatibility

A temporary detached checkout combined the candidate with PR #113 head `9cc5a2115f72037038b943a1a49d10a0314f7158` using `git merge --no-commit --no-ff origin/audit-pr113`. It applied without conflicts. Typecheck, the complete unit suite, production build, ten concept browser groups and governed scientific comparison passed. The theme-aware source assertion was included; the later one-line hover-color adjustment does not overlap #113. No merge commit was created and no existing branch was rewritten.

Evidence: [typecheck](evidence/pr113-typecheck.log), [unit](evidence/pr113-unit.log), [build](evidence/pr113-build.log), [concept browser](evidence/pr113-future-ai.json), [scientific comparison](evidence/pr113-invariance.json).

## Failures retained and limitations

- The initial unbounded Python run was interrupted after stalling; it was not a pass. The regular-file, bounded harness completed under the same restricted sandbox. [Original probe](evidence/schema-probe.log).
- The first export-feedback implementation changed the Brief timestamp; strict handoff equality failed. The implementation was repaired and the complete 24-group handoff suite passed with assertions unchanged.
- A screenshot timed out under concurrent browser load. The complete 14-group accessibility suite passed when rerun in isolation.
- An acceptance run timed out during rebuilding of its served directory. The entire 26-group suite was rerun against a frozen production build and passed. These intermediate failures are retained in [failure evidence](evidence/initial-failures.json), not counted as successful attempts.
- Chromium automation, axe and keyboard tests do not certify NVDA/JAWS/VoiceOver, real-device touch, Safari/Firefox or native OS print dialogs. Those remain unverified. Generated PDFs are not certified tagged/accessibility-conformant documents.
- No production deployment, field-performance collection, raw-data regeneration, live AI invocation or paid-token test was performed or authorized. Local compatibility checks do not admit illustrative literature as reviewed evidence.
- Required remote CI must be checked on the actual PR head before a merge recommendation becomes unconditional.
