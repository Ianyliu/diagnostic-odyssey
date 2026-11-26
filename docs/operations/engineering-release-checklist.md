# Engineering release checklist (code and CI changes)

For scientific artifact releases use the [analytical release workflow](../analytical-release-workflow.md); this checklist
covers application, tooling and CI changes. It does not replace scientific review.

1. **Local gate:** `npm run check` (and `npm run check:full` when Python/R/analysis code changed). Paste failures; do not summarize them away.
2. **Equivalence:** if the change claims to preserve behavior, `npm run test:characterization` must pass without regenerated goldens
   ([ADR 0001](../adr/0001-behavior-preserving-changes-need-exact-equivalence-evidence.md)).
3. **Reviewed artifacts:** `npm run verify:artifacts` passes and `git diff --stat` shows no change under `artifacts/reviewed/`.
4. **Server functions:** if `apps/web/api`, `vercel.json` or TypeScript project files changed, run `scripts/verify/vercel-function-build.sh`.
5. **Browser acceptance** for UI-affecting changes ([docs/testing.md](../testing.md#browser-acceptance)), including mobile and desktop.
6. **PR:** use the template; CI must be green on the exact head SHA ([workflow matrix](ci-workflows.md)).
7. **Preview:** verify an isolated Vercel Preview for anything touching headers, the API functions or build output.
8. **Merge and deploy** follow the repository owner's process; the maintenance campaign neither merged nor deployed.

Local results never substitute for steps 6 and 7.
