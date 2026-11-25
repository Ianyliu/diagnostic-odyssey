# @diagnostic-odyssey/brief-core

Builds the canonical `PlanningBrief` from released estimates, validated scenario outputs, evidence, local context and data requests, and serializes it to JSON. Export filtering here is a second line of defense.

Private workspace package; consumed through `src/index.ts`.

## Notes

Unreleased, suppressed and illustrative estimates never enter exports; invalid scenarios throw before export. `createBriefCodec` builds a codec around an acquisition resolver; `buildPlanningBrief` and `serializeBriefJson` use the production codec.

## Public API

Exact names and type signatures are recorded in [`tests/characterization/golden/package-api.json`](../../tests/characterization/golden/package-api.json).

- Values (5): `acquisitionWithheldWarning`, `buildPlanningBrief`, `createBriefCodec`, `serializeBriefJson`, `staleSelectedDataRequestExclusionWarning`
- Types (2): `BriefInput`, `PlanningBrief`

## Test

```bash
npm test --workspace @diagnostic-odyssey/brief-core
```
