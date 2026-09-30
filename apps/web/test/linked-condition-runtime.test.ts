import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  ACTIVE_LINKED_CONDITION_PRODUCT_POLICY_VERSION,
  ACTIVE_REVIEWED_LINKED_CONDITION_ARTIFACT_VERSION,
  loadReviewedLinkedConditionSecondaryEvidence,
  selectReviewedLinkedConditionSecondaryEvidence,
  tryLoadReviewedLinkedConditionSecondaryEvidence,
  type ReviewedLinkedConditionPackageInput
} from "../src/data/reviewedLinkedConditionArtifact.ts";

const artifactRoot = new URL(
  "../../../artifacts/reviewed/meps-2024-linked-condition-service-use-reviewed-20260929-v1/",
  import.meta.url
);

const readJson = (name: string): unknown =>
  JSON.parse(readFileSync(fileURLToPath(new URL(name, artifactRoot)), "utf8"));

const packageInput = (): ReviewedLinkedConditionPackageInput => ({
  candidateFile: readJson("linked-condition-candidate-estimates.json"),
  reviewedDiagnostics: readJson("reviewed-diagnostics.json"),
  sourceMetadata: readJson("source-metadata.json"),
  runManifest: readJson("github-actions-run-manifest.json"),
  reviewManifest: readJson("review-manifest.json"),
  productPolicy: readJson("product-policy.json")
});

const clone = <T>(value: T): T => structuredClone(value);

test("specialized runtime selection loads only reviewed Candidate A", () => {
  const evidence = loadReviewedLinkedConditionSecondaryEvidence();

  assert.equal(
    ACTIVE_REVIEWED_LINKED_CONDITION_ARTIFACT_VERSION,
    "meps-2024-linked-condition-service-use-reviewed-20260929-v1"
  );
  assert.equal(
    ACTIVE_LINKED_CONDITION_PRODUCT_POLICY_VERSION,
    "linked_condition_product_policy_v1"
  );
  assert.equal(evidence.kind, "reviewed_linked_condition_secondary_evidence");
  assert.equal(evidence.candidateId, "u09_linked_service_use_person_share");
  assert.equal(evidence.value, 0.04796093404373186);
  assert.equal(evidence.intervalLow, 0.02542838707094154);
  assert.equal(evidence.intervalHigh, 0.07049348101652217);
  assert.equal(evidence.precisionStatus, "meps_precise");
  assert.equal(evidence.precisionReportingStatus, "reportable");
  assert.equal(evidence.support.governedTargetN, 380);
  assert.equal(evidence.support.personsWithQualifyingLinkedEncounterN, 22);
  assert.equal(evidence.support.qualifyingTargetEncounterN, 109);
  assert.equal(evidence.support.weightedTargetDenominator, 6831165.107549);
  assert.equal(evidence.support.fullDesignDegreesOfFreedom, 159);

  const runtimeRecord = evidence as unknown as Record<string, unknown>;
  for (const ordinaryEstimateKey of [
    "estimate_id",
    "measure_id",
    "release_status",
    "display_status",
    "artifact_version",
    "source_ref"
  ]) {
    assert.equal(ordinaryEstimateKey in runtimeRecord, false);
  }
});

test("specialized loader invokes merged reviewed-package validation before selection", () => {
  const malformed = packageInput();
  const candidate = clone(malformed.candidateFile) as {
    candidates: Array<Record<string, unknown>>;
  };
  candidate.candidates[0]!.value = 0.05;
  malformed.candidateFile = candidate;

  assert.throws(
    () => selectReviewedLinkedConditionSecondaryEvidence(malformed),
    /Invalid reviewed linked-condition package/
  );
});

test("active runtime pins reject artifact and policy version drift", () => {
  const artifactDrift = packageInput();
  const review = clone(artifactDrift.reviewManifest) as Record<string, unknown>;
  review.artifact_version = "future-linked-condition-artifact";
  artifactDrift.reviewManifest = review;
  assert.throws(
    () => selectReviewedLinkedConditionSecondaryEvidence(artifactDrift),
    /Invalid reviewed linked-condition package|active pin/
  );

  const policyDrift = packageInput();
  const policy = clone(policyDrift.productPolicy) as Record<string, unknown>;
  policy.policy_version = "linked_condition_product_policy_v2";
  policyDrift.productPolicy = policy;
  assert.throws(
    () => selectReviewedLinkedConditionSecondaryEvidence(policyDrift),
    /Invalid reviewed linked-condition package|active pin/
  );
});

test("Candidate A admission and all non-A policy assignments fail closed on drift", () => {
  const cases: Array<[number, string]> = [
    [0, "reviewed_not_product_admitted"],
    [1, "admitted_secondary_descriptive"],
    [2, "admitted_secondary_descriptive"],
    [3, "reviewed_not_product_admitted"],
    [4, "reviewed_not_product_admitted"],
    [5, "reviewed_not_product_admitted"]
  ];

  for (const [index, state] of cases) {
    const drift = packageInput();
    const policy = clone(drift.productPolicy) as {
      candidate_states: Array<Record<string, unknown>>;
    };
    policy.candidate_states[index]!.product_policy_state = state;
    drift.productPolicy = policy;
    assert.throws(
      () => selectReviewedLinkedConditionSecondaryEvidence(drift),
      /Invalid reviewed linked-condition package|product-policy assignment drift/
    );
  }
});

test("Candidate A precision, reporting, validity, wording, and historical release flag fail closed", () => {
  const candidateFields: Array<[string, unknown]> = [
    ["precision_status", "meps_questionable_precision"],
    ["precision_reporting_status", "reportable_with_caution"],
    ["computationally_valid", false],
    ["product_release_eligible", true]
  ];

  for (const [field, value] of candidateFields) {
    const drift = packageInput();
    const candidate = clone(drift.candidateFile) as {
      candidates: Array<Record<string, unknown>>;
    };
    candidate.candidates[0]![field] = value;
    drift.candidateFile = candidate;
    assert.throws(
      () => selectReviewedLinkedConditionSecondaryEvidence(drift),
      /Invalid reviewed linked-condition package|Candidate A/
    );
  }

  const wordingDrift = packageInput();
  const policy = clone(wordingDrift.productPolicy) as {
    candidate_a_presentation: Record<string, unknown>;
  };
  policy.candidate_a_presentation.always_visible_explanation = "Shortened explanation";
  wordingDrift.productPolicy = policy;
  assert.throws(
    () => selectReviewedLinkedConditionSecondaryEvidence(wordingDrift),
    /Invalid reviewed linked-condition package/
  );
});

test("failure state creates no fallback numeric evidence", () => {
  const state = tryLoadReviewedLinkedConditionSecondaryEvidence();
  assert.equal(state.status, "loaded");
  assert.ok(state.evidence);

  const malformed = packageInput();
  malformed.productPolicy = {};
  assert.throws(
    () => selectReviewedLinkedConditionSecondaryEvidence(malformed),
    /Invalid reviewed linked-condition package/
  );
});
