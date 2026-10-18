# Guided workspace verification

## Baseline and environment

Pinned baseline: `4a86284a8791235423c92fc9608e74dbcf24e2e0`. Its Linux main CI passed (run `39086314047`). Local checks use macOS arm64, Node 22.23.3 and isolated browser/Python tooling outside the repository.

On this case-insensitive filesystem, both baseline typecheck and production build fail: the extensionless `./DemoLiterature` component import resolves to `demoLiterature.ts` before `DemoLiterature.tsx`. TypeScript reports TS1149/TS1261; Rollup reports `DemoLiteratureNotice` is not exported by the data module. This is a reproduced local portability issue, not a claim that main CI fails.

The separate portability commit renames only the component to `DemoLiteratureComponents.tsx` and updates its four consumers and source-inventory test. Afterward typecheck, production build and the concept-literature tests pass. The data module, content and behavior are unchanged.

For baseline screenshots/browser comparison, the archived pinned source uses a temporary external Vite config with an exact `./DemoLiterature` → `DemoLiterature.tsx` alias. This resolves the same local filename ambiguity without editing baseline sources. Governed snapshots use the original pinned sources. No workaround is needed in the candidate.

## Verification results

Results, failures/fixes, screenshot inventory and acceptance recommendation will be recorded here after the feature commits.
