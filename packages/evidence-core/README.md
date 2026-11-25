# @diagnostic-odyssey/evidence-core

Deterministic reviewer/admissibility rules that decide whether an evidence record may drive a scenario parameter, and its claim label.

Private workspace package; consumed through `src/index.ts`.

## Notes

An approved record is necessary but not sufficient: admissibility, pathway step and mechanism must also match the scenario.

## Public API

Exact names and type signatures are recorded in [`tests/characterization/golden/package-api.json`](../../tests/characterization/golden/package-api.json).

- Values (2): `canDriveScenarioParameter`, `evidenceClaimLabel`
- Types (1): `EvidenceUseDecision`

## Test

```bash
npm test --workspace @diagnostic-odyssey/evidence-core
```
