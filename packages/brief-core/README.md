# @diagnostic-odyssey/brief-core

Builds the canonical `PlanningBrief` from released estimates, validated scenario outputs, evidence, local context and data requests, and serializes it to JSON. Export filtering here is a second line of defense.

Private workspace package; consumed through `src/index.ts`.

## Notes

Unreleased, suppressed and illustrative estimates never enter exports; invalid scenarios throw before export. `createBriefCodec` builds a codec around an acquisition resolver; `buildPlanningBrief` and `serializeBriefJson` use the production codec.

Optional `EvidenceFreshness` entries carry observation vintage, source release or resource modification, retrieval and review dates, artifact version, and the source-specific freshness state. JSON includes entries that match a released source and artifact in the Brief. The [analytical release workflow](../../docs/analytical-release-workflow.md#evidence-timing-in-the-workspace-and-brief) defines freshness for each source family.

## Public API

Exact names and type signatures are recorded in [`tests/characterization/golden/package-api.json`](../../tests/characterization/golden/package-api.json).

- Values (5): `acquisitionWithheldWarning`, `buildPlanningBrief`, `createBriefCodec`, `serializeBriefJson`, `staleSelectedDataRequestExclusionWarning`
- Types (3): `BriefInput`, `EvidenceFreshness`, `PlanningBrief`

## Test

```bash
npm test --workspace @diagnostic-odyssey/brief-core
```
