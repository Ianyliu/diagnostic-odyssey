# Executed validation

Validated against `main@5cc772a198f86a92866bf14cb4ad545ff583200e` in the managed Linux workspace. Runtime implementation is recorded in the foundation/UI commits; the proof commit adds tests and CI. The documentation commit adds only review evidence and instructions. Original PR #106 specification/fixture bytes are preserved.

## Local checks

| Check | Result |
| --- | --- |
| Workspace typecheck, lint and `git diff --check` | PASS |
| Workspace unit tests | 376 passed, zero failures; includes 11 new source/fixture/capability guard tests |
| Enabled, explicit-off and absent-flag builds | PASS; default and explicit-off output byte-identical across six files |
| Focused concept browser suite | 8/8 groups passed |
| Disabled route/navigation/chunk and no-network checks | 2/2 groups passed |
| Full existing browser suite, untouched baseline | 26/26 groups passed |
| Full existing browser suite, enabled implementation | 26/26 groups passed |
| Governed workflow / sensitivity comparison | All seven snapshots identical; only top-level Brief generation timestamp ignored |
| Default real Brief PDF | Eight pages in both builds; extracted text identical after generation timestamp normalization |
| Concept / concept-entry print exclusion | PASS; no concept export added |
| Rendered axe on concept | Zero violations across 16 goal/theme/viewport evaluations; incomplete `color-contrast` findings retained for manual judgment |
| Keyboard, aria snapshot, 320px reflow, reduced motion, sticky concept identity | PASS |
| Nonempty analyst selection and actual JSON before/after exploration | Exact equality; one selected local indicator and one selected analyst request preserved |
| Runtime requests / page errors during focused suite | Zero external, fetch/XHR/WebSocket/EventSource requests; zero page errors |
| Immutable reviewed checksums | All four reviewed SHA256 manifests pass; no reviewed file diff |
| Python provenance / local-context / candidate verifier | 32/32, 51/51, and verifier PASS |

Node **24.19.0**, Chromium **154.0.8037.57**, Playwright **1.62.1**, axe-core **4.11.1**. Application packages require Node >=22; the added browser workflow and existing verification workflow use Node 22. Local browser tooling was isolated under ignored `work/` and did not change application dependencies or the lockfile. The existing full browser suite was run with an environment-only launcher substitution for the installed Chromium executable; its assertions were unchanged. A sandboxed Python subprocess stalled on the first workspace-test attempt; the successful full suite was rerun in the network-enabled execution context without changing the test assertions.

Nineteen concept screenshots plus one default-build screenshot are committed. Representative desktop/mobile, light/dark, all four layouts and expanded states were visually inspected. Browser results and compact axe findings are committed alongside the governed comparison. Full raw axe/browser/PDF output remains local in ignored `work/`.

## Reproduce

```sh
npm ci
npm run typecheck
npm test
npm run lint

# Install test-only tools outside application dependencies.
npm install --prefix /tmp/concept-browser --save-exact --no-audit --no-fund playwright@1.62.1 axe-core@4.11.1

VITE_FUTURE_AI_EXPERIENCE_DEMO=on npm run build
npm exec --workspace @diagnostic-odyssey/web -- vite preview --host 127.0.0.1 --port 4175
# In another terminal:
PLAYWRIGHT_RUNNER=/tmp/concept-browser/package.json \
QA_CHROME=/usr/bin/google-chrome QA_OUTPUT=/tmp/concept-on \
node tests/browser/future-ai-experience.mjs
```

For the disabled proof, stop preview, build with the feature flag omitted, restart preview, and run:

```sh
npm run build
PLAYWRIGHT_RUNNER=/tmp/concept-browser/package.json \
QA_CHROME=/usr/bin/google-chrome QA_BUILD=off \
QA_DIST="$PWD/apps/web/dist" QA_OUTPUT=/tmp/concept-off \
node tests/browser/future-ai-experience.mjs
```

`QA_CHROME` may point to the installed Chromium executable, or be omitted to use Playwright's `chrome` channel. The committed workflow builds both absent-flag and enabled variants and retains screenshots/results. Follow [the existing browser instructions](../../tests/browser/README.md) for the full product regression and baseline comparison.

## Limits and pending release gates

These checks establish implementation behavior, not scientific admission or release approval. Automated accessibility and the aria snapshot do not certify screen-reader speech, native dialogs, non-Chromium behavior or tagged-PDF accessibility. Axe incomplete findings require human judgment. The existing Vite main-chunk-size warning remains. R analysis is unchanged and its synthetic suite remains in the existing CI workflow; it was not rerun locally. Remote CI status is reported separately in the PR.

No actual AI, literature retrieval, admitted intervention source, comparative-effect estimate, reviewed-artifact mutation, deployment, static synchronization or October 15 submission change occurred. Separate independent source, privacy/security, accessibility and exact-revision release review remain required before public activation.
