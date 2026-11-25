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
