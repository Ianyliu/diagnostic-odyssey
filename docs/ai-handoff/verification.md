# PR A verification

The PR description records the final exact HEAD, executed outcomes and GitHub run
links. Do not treat results from another SHA or a green merge-ref job as exact-head
approval. The dedicated **AI Handoff Exact Head** workflow checks out
`github.event.pull_request.head.sha`, verifies it, runs Node 22.23.3 clean install,
typecheck, all workspace tests, lint, build, offline provenance/local-context checks,
reviewed checksums, full browser acceptance and Gate 0 accessibility. It uses
read-only repository permissions and uploads revision-labeled browser evidence.

## Local reproduction

Use Node 22.23.3 and npm 10.9.9. Record `git rev-parse HEAD` before and after:

```sh
npm ci --no-audit --no-fund
npm run typecheck
npm test
npm run lint
npm run build
node --experimental-strip-types apps/web/test/ai-handoff.test.ts
python3 -m unittest discover -s packages/narrative-references/test -p 'test_provenance.py'
python3 -m unittest discover -s analysis/local_context/tests -p 'test_*.py'
bash analysis/local_context/tests/test_candidate_output_verifier.sh
for manifest in artifacts/reviewed/*/SHA256SUMS; do
  (cd "$(dirname "$manifest")" && sha256sum -c SHA256SUMS)
done
Rscript analysis/r/tests/run_tests.R
```

Install the existing isolated Playwright 1.64.0 / axe-core 4.11.1 runner and serve
the production build as documented in [browser QA](../../tests/browser/README.md).
Run full `acceptance.mjs` and `gate0-accessibility.mjs`. For acquisition regression,
prepare the existing synthetic fixture, serve its Vite config separately and run
`acquisition-hints.mjs`; no real release source is admitted by that fixture.

Repeat full acceptance on the pinned base and final HEAD, retaining separate output
directories. Use `tests/browser/compare-results.mjs` for canonical export and all
seven governed workflow/sensitivity snapshots. Compare every production payload
file's path and SHA-256, and compare actual default PDF page text while normalizing
only Brief generation timestamps. Because this core is not imported into UI,
identical built assets are expected. Also inspect the diff against the pinned base
to verify no reviewed artifacts, existing packages, Brief page, lockfile, formulas,
static branches or October 15 submission artifacts changed.

The new tests cover full canonical parity and JSON round trips; deep immutability
and stable output; all six goal templates and a committed guardrail snapshot;
actual inclusion counts and section order; 2,000-code-point questions; hostile
HTML/fences/delimiters/Unicode; a complete large payload; suppressed/unreleased/
preliminary/illustrative records; invalid finite values and scenarios; source and
scenario identity mismatches; absent scenario/local/national data; positive/zero
capacity gaps; stale requests and forged acquisition companions; evidence
admissibility; and envelope/supplement/version tampering.

## Limits requiring separate review

- No UI exists in PR A. Preview invalidation on live state changes, browser actions,
  provider compatibility, consent, clipboard failures, mobile Safari and manual
  screen-reader behavior belong to later explicitly authorized PRs.
- Local browser runs use the installed Chromium through a temporary runner adapter;
  repository test files are unchanged. The workflow uses the documented Chrome
  channel. Neither result certifies other browser engines or native print dialogs.
- Automated accessibility results retain axe incomplete findings for human review;
  they do not certify screen-reader speech or tagged PDF accessibility.
- Source membership and scientific authority remain with the validated loaders;
  the Brief alone cannot authenticate a local artifact manifest or original source
  locator. No enrichment or independent scientific certification is asserted.
- Production acquisition guidance is included only if the canonical production
  codec resolves it. There is no newly released acquisition source in this PR.
- Prompt injection controls are encoding and explicit instructions, not a guarantee
  of external model behavior. No downstream model or transmission was tested.
- The pre-existing Vite chunk-size warning is unchanged.

Scientific/export/security approval and exact-revision merge authorization remain
pending. No merge, deployment, static synchronization or subsequent stage is
authorized by these checks.
