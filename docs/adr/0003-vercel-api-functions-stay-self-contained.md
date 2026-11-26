# ADR 0003: Vercel API functions stay self-contained; `ai-guidance.ts` is not decomposed

- Status: Accepted (maintenance campaign, 2026-11-25)
- Scope: `apps/web/api/*` (the only public server functions: `/api/ai-guidance` Preview-only, and the retired `/api/ai-preview` 404 stub)

## Context

`apps/web/api/ai-guidance.ts` is a ~205 KB single file containing validators, canonicalization and
fingerprinting, rate-limit and replay state, the provider call, and two embedded reviewed artifacts
(~77 KB string literals whose SHA-256 values are pinned by tests). The maintenance plan proposed splitting it
into modules (artifact data, pure helpers, stateful security components, handler). The file header already
records that the function must have no local runtime imports because Vercel's function tracing excluded
`.ts` modules.

## Evidence gathered

A throwaway local build used the real builder (`vercel build` 66.6.0, `@vercel/node` 32.0.0) in a scratch copy.
A function that imported `./_lib/probe.ts` produced:

- `api/ai-preview.js` with the specifier unchanged (`from "./_lib/probe.ts"`), and a sibling `_lib/probe.js`;
- loading the built function failed with `ERR_MODULE_NOT_FOUND` for `.../_lib/probe.ts`.

So any local module split would build "successfully" and fail at runtime in the deployed function. Embedded
data modules, JSON imports and runtime file reads have the same tracing question and cannot be qualified
without a real Preview deployment, which is out of scope for this stage.

## Decision

1. **Do not decompose `ai-guidance.ts`** in this campaign. No decomposition commits were made, so there is
   nothing to revert.
2. Keep every file in `apps/web/api` self-contained (Node built-ins only). This is now enforced by
   `apps/web/test/api-self-contained.test.ts`, which also asserts that `api/` contains exactly the two
   known functions (a new file there becomes a new public endpoint).
3. Keep the independent qualification assets produced while investigating:
   - `tests/characterization/endpoint.ts` and `golden/endpoint.json`: 387 deterministic cases covering access
     gates, auth, origin, validation, challenge/replay/expiry, rate limits, state-store and provider failures,
     exact provider egress and secret non-disclosure.
   - `scripts/verify/vercel-function-build.sh`: offline `vercel build` that asserts the function inventory,
     routing/security headers, absence of TypeScript diagnostics, and that every built function loads.
   - `apps/web/api/tsconfig.json`: gives the Vercel builder correct Node types for the functions. Without it,
     narrowing `apps/web/tsconfig.json` to browser types made the builder report `node:crypto`/`Buffer`/`process`
     diagnostics.

## Consequences

- The security-sensitive endpoint remains one large file. Reviewability is improved indirectly by the
  characterization suite rather than by restructuring.
- Revisit only together with an isolated Vercel Preview verification, ideally after confirming how the
  production builder traces local ES modules, or by bundling the function at build time into a single file
  (a new build step, a separate decision).
- The same constraint applies to any future function added under `apps/web/api`.
