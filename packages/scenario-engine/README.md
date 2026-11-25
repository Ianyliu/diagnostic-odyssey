# @diagnostic-odyssey/scenario-engine

Pure deterministic scenario arithmetic: reach, capacity gap, person-month exposure, program-resource requirement, bounded-effect attachment and one-way sensitivity.

Private workspace package; consumed through `src/index.ts`.

## Notes

Accepts a validated `Scenario`; rejects invalid input and non-finite/overflowing results with `InvalidScenarioError` / `InvalidScenarioResultError`. No network, AI, analytics or local-context multipliers.

## Public API

Exact names and type signatures are recorded in [`tests/characterization/golden/package-api.json`](../../tests/characterization/golden/package-api.json).

- Values (10): `attachBoundedEffect`, `calculateScenario`, `capacityGap`, `intendedReach`, `InvalidScenarioError`, `InvalidScenarioResultError`, `oneWaySensitivity`, `personMonthExposure`, `programResourceRequirement`, `reachedParticipants`
- Types (1): `SensitivityPoint`

## Test

```bash
npm test --workspace @diagnostic-odyssey/scenario-engine
```
