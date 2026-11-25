# @diagnostic-odyssey/acquisition-hints

Fail-closed acquisition-guidance contracts, sensitivity data-request templates and resolver boundaries. Production release allowlists are empty.

Private workspace package; consumed through `src/index.ts`.

## Notes

Data requests are planning artifacts, not observed evidence. `createSensitivityDataRequest` and the status helpers define when a request is current for the applied scenario.

## Public API

Exact names and type signatures are recorded in [`tests/characterization/golden/package-api.json`](../../tests/characterization/golden/package-api.json).

- Values (11): `acquisitionResolver`, `aggregatePrivacyBoundary`, `createAcquisitionResolver`, `createSensitivityDataRequest`, `dataRequestsMatch`, `getSensitivityDataRequestStatus`, `isDataRequestCurrentForScenario`, `requestFingerprint`, `sanitizeBaseDataRequest`, `sensitivityDataRequestId`, `sensitivityFieldFromDataRequestId`
- Types (8): `AcquisitionGuidance`, `AcquisitionMapping`, `AcquisitionReleaseBytes`, `AcquisitionResolution`, `AcquisitionResolver`, `AcquisitionState`, `SensitivityDataRequestStatus`, `SensitivityField`

## Test

```bash
npm test --workspace @diagnostic-odyssey/acquisition-hints
```
