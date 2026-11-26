# Architecture decision records

Short records of consequential engineering decisions: what was decided, the evidence, and the consequences.
Add a new ADR when a decision constrains future work or reverses a previous one. Number sequentially; do not rewrite
accepted ADRs, supersede them.

| ADR | Decision | Status |
| --- | --- | --- |
| [0001](0001-behavior-preserving-changes-need-exact-equivalence-evidence.md) | Behavior-preserving changes are proven by exact comparison with recorded baseline output | Accepted |
| [0002](0002-split-typescript-projects-and-keep-tests-hermetic.md) | Type-check by runtime boundary; type-aware lint on owned files; tests never install or reach the network | Accepted |
| [0003](0003-vercel-api-functions-stay-self-contained.md) | `apps/web/api` functions stay self-contained; `ai-guidance.ts` is not decomposed | Accepted |
