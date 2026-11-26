# ADR 0001: Behavior-preserving changes are proven by exact equivalence evidence

- Status: Accepted (2026-11-25)

## Context

This repository produces planning numbers and exports that people may act on. Existing unit tests assert specific
properties but cannot show that a refactor left *all* observable behavior intact. Passing tests is necessary, not sufficient.

## Decision

Refactors that claim to preserve behavior must be accompanied by deterministic characterization data captured from the
pre-refactor code and compared **exactly** afterwards:

- `tests/characterization/capture.ts`: ~3,650 cases over real reviewed artifacts and synthetic boundary inputs (validators,
  mutation sweeps, status matrices, scenario engine, evidence gating, Brief JSON, acquisition hints, planning guidance, AI
  handoff payloads, planning insights, Pilot logic).
- `tests/characterization/api-snapshot.ts`: type-level public API of every workspace package via the TypeScript compiler.
- `tests/characterization/endpoint.ts`: 387 cases for the Preview-only `/api/ai-guidance` handler.
- `tests/browser/pilot-parity.mjs`: rendered HTML, ARIA tree, focus order and pixel digests of the Strategy Lab.

Rules: no numeric tolerances; only known nondeterministic fields are normalized (challenge nonce/MAC, latency, generated-at,
random ids); goldens are generated from the baseline commit twice and compared before use; goldens are never regenerated to
make a failing comparison pass. Bundled asset hashes may change under restructuring and must be explained separately; they
are not an acceptance gate for scientific equivalence.

## Consequences

- Scientific-output equivalence, reviewed-artifact immutability (`verify:artifacts`) and repeated-build reproducibility
  (`verify:build`) are three separate gates.
- The goldens are large (≈0.6 MB). They are the cost of being able to refactor safely.
- Intentional behavior changes require their own commit and regenerated goldens with a written justification.
- Sensitivity was checked: a 1e-7 change to a validator boundary changes the characterization output.
