# ADR 0002: Type-check by runtime boundary; keep tests hermetic

- Status: Accepted (2026-11-25)

## Context

`apps/web/tsconfig.json` type-checked only `src` and `vite.config.ts`, so the security-sensitive `api/` functions, build
tooling and 60+ test files were never type-checked. Ambient types also leaked: `vite.config.ts` pulled Node types into the
"browser" project. Separately, `packages/planning-guidance`'s `npm test` ran `pip install` on every invocation.

## Decision

1. `apps/web` has three projects: `tsconfig.json` (browser: `src`, DOM, `vite/client`; excludes `src/server`),
   `tsconfig.server.json` (`api`, `build`, `src/server`, `vite.config.ts`; Node types, no DOM), `tsconfig.test.json` (tests).
   `apps/web/api/tsconfig.json` supplies Node types to the Vercel builder, which type-checks with the nearest tsconfig.
   `tsconfig.tools.json` covers `tests/characterization` and `scripts/**/*.ts`.
2. No type errors were resolved with `any`, ignore directives or weakened strictness. Test fixtures that deliberately violate
   a contract use the single, greppable helper `invalidInput()` in `apps/web/test/helpers/typed.ts`; the
   characterization harness uses explicit `as never` only where it deliberately feeds invalid input to a validator.
3. ESLint enables `await-thenable`, `no-floating-promises` (not in `test/`), `no-misused-promises`,
   `switch-exhaustiveness-check` and `eqeqeq` (null allowed) with explicit `parserOptions.project`, only for files owned by a
   tsconfig. `no-explicit-any` (179), `no-non-null-assertion` (309) and `no-unnecessary-type-assertion` (81) stay off:
   enabling them would require edits to security-sensitive and byte-mirrored code in a behavior-preserving pass.
4. Test scripts never install packages. Python test dependencies are pinned in `requirements-test.txt` and must be
   provisioned beforehand. Hermeticity is demonstrated by running the suite with outbound networking denied
   (`npm run test:offline`), not inferred from a static search for `pip`.
5. Coverage is informational: no global threshold and no tests written only to raise a number.

## Consequences

- Latent defects are now visible to the compiler (one unreachable `split()` narrowing in the endpoint, 27 test-fixture issues, none changing behavior).
- `src/server/planning-guidance` (a byte-for-byte mirror enforced by a test) is type-checked under the server project.
- A new package in `packages/` needs its own `tsconfig.json` to be covered by lint's project list (`packages/*/tsconfig.json`).
