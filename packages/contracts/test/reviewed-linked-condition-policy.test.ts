import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  linkedConditionCandidateAPresentationV1,
  linkedConditionProductPolicyV1,
  linkedConditionProductPolicyVersion,
  reviewedLinkedConditionArtifactVersion,
  validateLinkedConditionProductPolicy,
  validateReviewedLinkedConditionManifest
} from "../src/index.ts";

const artifactRoot = new URL(
  "../../../artifacts/reviewed/meps-2024-linked-condition-service-use-reviewed-20260929-v1/",
  import.meta.url
);

const readJson = (name: string): unknown =>
  JSON.parse(readFileSync(fileURLToPath(new URL(name, artifactRoot)), "utf8"));

const hasPath = (
  issues: ReadonlyArray<{path: string; message: string}>,
  fragment: string
): boolean => issues.some(issue => issue.path.includes(fragment));

test("linked-condition product policy v1 is exact and runtime inactive", () => {
  const policy = readJson("product-policy.json");
  assert.deepEqual(validateLinkedConditionProductPolicy(policy), []);
  assert.equal(linkedConditionProductPolicyVersion, "linked_condition_product_policy_v1");
  assert.equal(
    reviewedLinkedConditionArtifactVersion,
    "meps-2024-linked-condition-service-use-reviewed-20260929-v1"
  );
  assert.deepEqual(linkedConditionProductPolicyV1, {
    u09_linked_service_use_person_share: "admitted_secondary_descriptive",
    u09_linked_service_use_encounters_mean: "reviewed_not_product_admitted",
    u09_linked_service_use_office_encounters_mean: "reviewed_not_product_admitted",
    u09_linked_service_use_outpatient_encounters_mean: "suppressed_precision",
    u09_linked_service_use_emergency_encounters_mean: "suppressed_precision",
    u09_linked_service_use_inpatient_encounters_mean: "suppressed_unsupported_zero"
  });
  assert.deepEqual(linkedConditionCandidateAPresentationV1, {
    candidate_id: "u09_linked_service_use_person_share",
    section_heading: "Documented U09-linked service-use footprint",
    measure_label:
      "Share with at least one 2024 encounter linked in MEPS to an exact U09 condition record",
    always_visible_explanation:
      "This is not the share diagnosed or recognized with Long COVID and does not measure Long-COVID-attributable healthcare use.",
    technical_limitations: [
      "Exact U09 is not equivalent to the governed operational-current Long COVID definition.",
      "Absence of U09 does not mean absence of Long COVID.",
      "Absence of a qualifying linked encounter does not mean absence of healthcare.",
      "Calendar-year 2024 encounters may occur before or after the Round 3/1 current-status anchor.",
      "Condition-event linkage does not establish causation.",
      "116 of 259 qualifying U09-linked events also carry at least one non-U09 condition link."
    ]
  });
});

test("product policy fails closed for unknown versions and runtime activation", () => {
  const policy = readJson("product-policy.json") as Record<string, unknown>;

  const wrongPolicy = structuredClone(policy);
  wrongPolicy.policy_version = "linked_condition_product_policy_v2";
  assert.ok(hasPath(validateLinkedConditionProductPolicy(wrongPolicy), "policy_version"));

  const wrongArtifact = structuredClone(policy);
  wrongArtifact.reviewed_artifact_version = "unknown";
  assert.ok(hasPath(
    validateLinkedConditionProductPolicy(wrongArtifact),
    "reviewed_artifact_version"
  ));

  const runtimeSelected = structuredClone(policy);
  runtimeSelected.runtime_selected = true;
  assert.ok(hasPath(
    validateLinkedConditionProductPolicy(runtimeSelected),
    "runtime_selected"
  ));
});

test("product policy rejects missing, duplicate, unknown, and incorrectly admitted candidates", () => {
  const policy = readJson("product-policy.json") as {
    candidate_states: Array<Record<string, unknown>>;
    [key: string]: unknown;
  };

  const missing = structuredClone(policy);
  missing.candidate_states.pop();
  assert.ok(hasPath(validateLinkedConditionProductPolicy(missing), "candidate_states"));

  const duplicate = structuredClone(policy);
  duplicate.candidate_states[5] = structuredClone(duplicate.candidate_states[0]!);
  assert.ok(hasPath(validateLinkedConditionProductPolicy(duplicate), "candidate_id"));

  const unknown = structuredClone(policy);
  unknown.candidate_states[0]!.candidate_id = "unknown_candidate";
  assert.ok(hasPath(validateLinkedConditionProductPolicy(unknown), "candidate_id"));

  const admitB = structuredClone(policy);
  admitB.candidate_states[1]!.product_policy_state = "admitted_secondary_descriptive";
  assert.ok(hasPath(
    validateLinkedConditionProductPolicy(admitB),
    "product_policy_state"
  ));

  const admitOffice = structuredClone(policy);
  admitOffice.candidate_states[2]!.product_policy_state = "admitted_secondary_descriptive";
  assert.ok(hasPath(
    validateLinkedConditionProductPolicy(admitOffice),
    "product_policy_state"
  ));

  const unsuppressOutpatient = structuredClone(policy);
  unsuppressOutpatient.candidate_states[3]!.product_policy_state =
    "reviewed_not_product_admitted";
  assert.ok(hasPath(
    validateLinkedConditionProductPolicy(unsuppressOutpatient),
    "product_policy_state"
  ));
});

test("Candidate A wording is a frozen product-policy invariant", () => {
  const policy = readJson("product-policy.json") as {
    candidate_a_presentation: Record<string, unknown>;
    [key: string]: unknown;
  };

  for (const field of [
    "section_heading",
    "measure_label",
    "always_visible_explanation"
  ]) {
    const altered = structuredClone(policy);
    altered.candidate_a_presentation[field] = "changed";
    assert.ok(hasPath(
      validateLinkedConditionProductPolicy(altered),
      `candidate_a_presentation.${field}`
    ));
  }

  const limitations = structuredClone(policy);
  limitations.candidate_a_presentation.technical_limitations = [];
  assert.ok(hasPath(
    validateLinkedConditionProductPolicy(limitations),
    "technical_limitations"
  ));
});

test("review manifest freezes product-policy admission separately from runtime selection", () => {
  const manifest = readJson("review-manifest.json");
  assert.deepEqual(validateReviewedLinkedConditionManifest(manifest), []);

  const runtime = structuredClone(manifest) as Record<string, unknown>;
  runtime.runtime_selected = true;
  assert.ok(hasPath(validateReviewedLinkedConditionManifest(runtime), "runtime_selected"));

  const wrongRule = structuredClone(manifest) as Record<string, unknown>;
  wrongRule.precision_rule_version = "other_rule";
  assert.ok(hasPath(
    validateReviewedLinkedConditionManifest(wrongRule),
    "precision_rule_version"
  ));

  const wrongFamily = structuredClone(manifest) as Record<string, unknown>;
  wrongFamily.artifact_family = "ordinary_burden";
  assert.ok(hasPath(
    validateReviewedLinkedConditionManifest(wrongFamily),
    "artifact_family"
  ));

  const ordinaryEstimate = structuredClone(manifest) as {
    product_release_scope: Record<string, unknown>;
    [key: string]: unknown;
  };
  ordinaryEstimate.product_release_scope.candidate_a_is_ordinary_national_burden_estimate =
    true;
  assert.ok(hasPath(
    validateReviewedLinkedConditionManifest(ordinaryEstimate),
    "candidate_a_is_ordinary_national_burden_estimate"
  ));
});
