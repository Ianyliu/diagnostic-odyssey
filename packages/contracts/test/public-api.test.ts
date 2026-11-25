import assert from "node:assert/strict";
import test from "node:test";
// Import through the package entry point exactly as an external consumer does.
import * as contracts from "@diagnostic-odyssey/contracts";
import type {
  AcquisitionHintReference, AdmissibilityStatus, AnalysisContext, ArtifactBundle, ArtifactManifest, BoundedEffect,
  BriefManifest, BurdenDomain, DataRequest, DataState, DisplayStatus, DistributionSummary, Estimate, EvidenceRecord,
  EvidenceType, LocalContextArtifact, LocalContextGeography, LocalContextManifest, LocalContextRecord,
  LocalContextReleaseStatus, LocalContextSource, LocalGeographyType, QualitativeEvidence, ReleaseStatus,
  ReviewerStatus, Scenario, ScenarioResult, SourceManifestEntry, ValidationIssue
} from "@diagnostic-odyssey/contracts";

/**
 * Compile-time check: every public type must remain importable from the package entry point.
 * (Type removal or renaming would fail `npm run typecheck` here before reaching consumers.)
 */
export type PublicTypes = [
  AcquisitionHintReference, AdmissibilityStatus, AnalysisContext, ArtifactBundle, ArtifactManifest, BoundedEffect,
  BriefManifest, BurdenDomain, DataRequest, DataState, DisplayStatus, DistributionSummary, Estimate, EvidenceRecord,
  EvidenceType, LocalContextArtifact, LocalContextGeography, LocalContextManifest, LocalContextRecord,
  LocalContextReleaseStatus, LocalContextSource, LocalGeographyType, QualitativeEvidence, ReleaseStatus,
  ReviewerStatus, Scenario, ScenarioResult, SourceManifestEntry, ValidationIssue
];

// Runtime export names, recorded before the module split. Additions are an API decision, not an accident.
const expectedRuntimeExports = [
  "admissibilityStatuses",
  "assertValidArtifactBundle",
  "assertValidLinkedConditionCandidate",
  "assertValidLocalContextArtifact",
  "assertValidReviewedLinkedConditionPackage",
  "canDisplayDistributionSummary",
  "canExportEstimate",
  "canLoadReviewedLocalContextArtifact",
  "dataStates",
  "displayStatuses",
  "evaluateLinkedConditionPrecision",
  "evidenceTypes",
  "linkedConditionCandidateAPresentationV1",
  "linkedConditionCandidateIds",
  "linkedConditionCandidateSourceRefs",
  "linkedConditionPrecisionReasonCodes",
  "linkedConditionPrecisionReportingStatuses",
  "linkedConditionPrecisionRuleVersion",
  "linkedConditionPrecisionStatuses",
  "linkedConditionProductPolicyV1",
  "linkedConditionProductPolicyVersion",
  "releaseStatuses",
  "reviewedLinkedConditionArtifactVersion",
  "reviewedLinkedConditionProvenanceV1",
  "reviewedLinkedConditionReconciliationV1",
  "validateAcquisitionHintReference",
  "validateArtifactBundle",
  "validateDataRequest",
  "validateEstimate",
  "validateLinkedConditionCandidateDiagnostics",
  "validateLinkedConditionCandidateEstimate",
  "validateLinkedConditionCandidateFile",
  "validateLinkedConditionCandidateManifest",
  "validateLinkedConditionProductPolicy",
  "validateLocalContextArtifact",
  "validateLocalContextRecord",
  "validateReviewedLinkedConditionCandidateSnapshot",
  "validateReviewedLinkedConditionDiagnostics",
  "validateReviewedLinkedConditionManifest",
  "validateReviewedLinkedConditionRunManifest",
  "validateReviewedLinkedConditionSources",
  "validateScenario",
  "validateScenarioResult"
];

test("runtime exports of the package entry point are exactly the documented public API", () => {
  assert.deepEqual(Object.keys(contracts).sort(), [...expectedRuntimeExports].sort());
});

test("internal guard helpers are not part of the public API", () => {
  for (const internal of ["isRecord", "isNonEmptyString", "isNullableFiniteNumber", "oneOf"]) {
    assert.equal(internal in contracts, false, `${internal} must stay internal`);
  }
});

test("typed consumers compile against validators and gates with their original signatures", () => {
  const issues: ValidationIssue[] = contracts.validateScenario({});
  assert.ok(issues.length > 0);
  const asserts: (value: unknown) => asserts value is ArtifactBundle = contracts.assertValidArtifactBundle;
  assert.throws(() => asserts({}));
  const gate: (estimate: Estimate) => boolean = contracts.canExportEstimate;
  assert.equal(typeof gate, "function");
});
