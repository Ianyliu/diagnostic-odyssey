# Golden snapshot provenance

Generated from the **pre-refactor** code at `main@5b81f5fea2bdb3545e47302fde54c4b4c2a5f2b0`
(plus the user's uncommitted documentation edits, which do not affect behavior), using the
harness files in the parent directory, on Node 22.23.3.

- `characterization.json`: behavioral outcomes (values or thrown errors) of validators, the
  scenario engine, evidence gating, Brief generation/serialization, acquisition hints, planning
  guidance, AI handoff payloads and presentation logic. Small outcomes are stored in full; large
  ones as truncated SHA-256 digests of their canonical JSON.
- `package-api.json`: type-level public API of every workspace package, from the TypeScript
  compiler API.

Both were generated twice and compared byte-for-byte before being committed (deterministic).
Do not regenerate these files to make a failing comparison pass. A legitimate, reviewed change to
scientific behavior or a public API must be committed separately with an explicit justification.

## endpoint.json

387 deterministic cases for the Preview-only `/api/ai-guidance` handler (`apps/web/api/ai-guidance.ts`),
generated from the same pre-refactor baseline (`main@5b81f5f`; `ai-guidance.ts` sha256 prefix `b8db843a…`)
and verified byte-identical on the maintenance branch before any endpoint refactoring. It drives
`handleReviewedGuidance` directly with an injected state store, a recording provider mock and a stubbed
clock; nothing touches the network. Only known nondeterministic fields are normalized: the random
challenge nonce/MAC, measured latency, generated-at timestamp and random generation/proposal ids.
Covered: feature gates, methods, bearer auth and origin, server configuration and state-store
selection, body size/shape/encoding, consent, selection mutation sweep, challenge signing, tampering,
replay and expiry, rate limiting, state-store failures, provider failure modes, the exact egress sent
to the provider, and that no response ever contains the API key, operator token or challenge secret.
