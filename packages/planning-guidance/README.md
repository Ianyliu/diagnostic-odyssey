# @diagnostic-odyssey/planning-guidance

Offline deterministic input, egress, candidate and output contracts (plus Draft 2020-12 schemas) for bounded planning-guidance workflows.

Private workspace package; consumed through `src/index.ts`.

## Notes

`apps/web/src/server/planning-guidance` is a **byte-for-byte mirror** of `src/` enforced by `apps/web/test/ai-preview-source-mirror.test.ts`. Change both together or neither. Tests call Python validators, so provision `requirements-test.txt` first (tests never install packages).

## Public API

Exact names and type signatures are recorded in [`tests/characterization/golden/package-api.json`](../../tests/characterization/golden/package-api.json).

- Values (15): `assertCandidate`, `assertEgress`, `assertInput`, `assertOutput`, `bindCandidate`, `canonicalJSON`, `compareIds`, `contextKey`, `fingerprint`, `projectEgress`, `requestProposalId`, `snapshotContent`, `unavailable`, `validate`, `VERSION`
- Types (12): `AllowedUse`, `Context`, `Digest`, `Hint`, `Id`, `ModelCandidateV1`, `ModelEgressV1`, `NumericRecord`, `PlanningGuidanceInputV1`, `PlanningGuidanceOutputV1`, `Reference`, `VerifiedAuthority`

## Test

```bash
npm test --workspace @diagnostic-odyssey/planning-guidance
```
