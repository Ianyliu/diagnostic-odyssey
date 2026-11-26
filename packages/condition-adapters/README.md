# @diagnostic-odyssey/condition-adapters

Condition-specific cohort labels, pathway definitions and source compatibility for the generic contracts (Long COVID reference implementation; ME/CFS partial compatibility).

Private workspace package; consumed through `src/index.ts`.

## Notes

Contracts stay condition-neutral; adapters are data, not calculations. This package has no `test` script; its exports are covered by the characterization suite (`tests/characterization`).

## Public API

Exact names and type signatures are recorded in [`tests/characterization/golden/package-api.json`](../../tests/characterization/golden/package-api.json).

- Values (4): `conditionAdapters`, `getConditionAdapter`, `longCovidAdapter`, `mecfsAdapter`
- Types (2): `ConditionAdapter`, `PathwayStep`

## Test

No package-level tests (see notes above). Run `npm run typecheck --workspace @diagnostic-odyssey/condition-adapters` and the repository-level `npm run test:characterization`.
