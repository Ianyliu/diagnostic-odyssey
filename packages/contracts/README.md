# @diagnostic-odyssey/contracts

Canonical TypeScript contracts and runtime validators for artifacts and domain objects. The scientific status vocabulary (evidence types, release/display/admissibility statuses, data states) lives here so it cannot drift between modules.

Private workspace package; consumed through `src/index.ts`.

## Notes

Pure and dependency-free. Source layout: `constants.ts` (status vocabularies), `types.ts` (interfaces), `guards.ts` (internal helpers, not exported), `validate-estimate.ts`, `validate-local-context.ts`, `validate-scenario.ts`, `validate-requests.ts`, `validate-bundle.ts`, `gates.ts` (export gates), plus `linked-condition-candidate.ts` and `reviewed-linked-condition.ts`. `src/index.ts` is an explicit barrel: adding an export is a public API decision, pinned by `test/public-api.test.ts` and `tests/characterization`.

`src/validate-artifact-cli.ts` and `src/validate-linked-condition-candidate-cli.ts` are command-line validators used by pipelines.

## Public API

Exact names and type signatures are recorded in [`tests/characterization/golden/package-api.json`](../../tests/characterization/golden/package-api.json).

- Values (43): `admissibilityStatuses`, `assertValidArtifactBundle`, `assertValidLinkedConditionCandidate`, `assertValidLocalContextArtifact`, `assertValidReviewedLinkedConditionPackage`, `canDisplayDistributionSummary`, `canExportEstimate`, `canLoadReviewedLocalContextArtifact`, `dataStates`, `displayStatuses`, `evaluateLinkedConditionPrecision`, `evidenceTypes`, `linkedConditionCandidateAPresentationV1`, `linkedConditionCandidateIds`, `linkedConditionCandidateSourceRefs`, `linkedConditionPrecisionReasonCodes`, `linkedConditionPrecisionReportingStatuses`, `linkedConditionPrecisionRuleVersion`, `linkedConditionPrecisionStatuses`, `linkedConditionProductPolicyV1`, `linkedConditionProductPolicyVersion`, `releaseStatuses`, `reviewedLinkedConditionArtifactVersion`, `reviewedLinkedConditionProvenanceV1`, `reviewedLinkedConditionReconciliationV1`, `validateAcquisitionHintReference`, `validateArtifactBundle`, `validateDataRequest`, `validateEstimate`, `validateLinkedConditionCandidateDiagnostics`, `validateLinkedConditionCandidateEstimate`, `validateLinkedConditionCandidateFile`, `validateLinkedConditionCandidateManifest`, `validateLinkedConditionProductPolicy`, `validateLocalContextArtifact`, `validateLocalContextRecord`, `validateReviewedLinkedConditionCandidateSnapshot`, `validateReviewedLinkedConditionDiagnostics`, `validateReviewedLinkedConditionManifest`, `validateReviewedLinkedConditionRunManifest`, `validateReviewedLinkedConditionSources`, `validateScenario`, `validateScenarioResult`
- Types (39): `AcquisitionHintReference`, `AdmissibilityStatus`, `AnalysisContext`, `ArtifactBundle`, `ArtifactManifest`, `BoundedEffect`, `BriefManifest`, `BurdenDomain`, `DataRequest`, `DataState`, `DisplayStatus`, `DistributionSummary`, `Estimate`, `EvidenceRecord`, `EvidenceType`, `LinkedConditionCandidateEstimate`, `LinkedConditionCandidateFile`, `LinkedConditionCandidateId`, `LinkedConditionCandidateManifest`, `LinkedConditionCandidateValidationIssue`, `LinkedConditionPrecisionDecision`, `LinkedConditionPrecisionReasonCode`, `LinkedConditionPrecisionReportingStatus`, `LinkedConditionPrecisionStatus`, `LinkedConditionSupport`, `LocalContextArtifact`, `LocalContextGeography`, `LocalContextManifest`, `LocalContextRecord`, `LocalContextReleaseStatus`, `LocalContextSource`, `LocalGeographyType`, `QualitativeEvidence`, `ReleaseStatus`, `ReviewerStatus`, `Scenario`, `ScenarioResult`, `SourceManifestEntry`, `ValidationIssue`

## Test

```bash
npm test --workspace @diagnostic-odyssey/contracts
```
