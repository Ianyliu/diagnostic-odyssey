# Characterization tests

Behavior-preserving refactors are proven by **exact comparison** with a golden snapshot generated
from the pre-refactor code (see `golden/PROVENANCE.md`).

| Command | What it checks |
| --- | --- |
| `npm run test:characterization` | Runs both comparisons below and fails on any drift. |
| `capture.ts` | ~3,650 deterministic cases: real reviewed artifacts through every validator, mutation sweeps (delete / null / wrong type / NaN / Infinity / boundary), estimate release × display × evidence-type matrix, scenario boundaries, evidence-gating matrix, Brief build + JSON serialization, acquisition hints, offline planning guidance, AI handoff payloads, planning insights and Pilot presentation logic. |
| `api-snapshot.ts` | Type-level public API of every workspace package via the TypeScript compiler API (names, kinds, expanded signatures). |

There are no numeric tolerances. Outcomes (including thrown errors) are canonicalized
(sorted keys; `NaN`, `±Infinity` and `-0` tagged) and compared as text. Nothing here reads a clock,
uses randomness or touches the network.

Never regenerate the goldens to turn a failure green: investigate the first listed case instead.
Intentional behavior changes belong in their own reviewed commit with a written justification.
