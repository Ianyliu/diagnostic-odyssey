// Synthetic release authority for negative/positive engineering tests ONLY.
// The frozen mappings and policy remain unreleased; this is not review evidence.
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import type { AnalysisContext, Scenario } from "@diagnostic-odyssey/contracts";
import type { AcquisitionReleaseBytes } from "../src/index.ts";
export const readInput = (file: string) => readFileSync(new URL(`../review-inputs/${file}`, import.meta.url), "utf8");
export const digest = (value: string) => createHash("sha256").update(value).digest("hex");
export const context: AnalysisContext = JSON.parse(readInput("context-policy.candidate.json")).proposed_rule.artifact_context_exact;
export const scenario: Scenario = {
  scenario_id: "TEST-ONLY", eligible_population: 12000, reach: .25, capacity: 3000,
  baseline_window_months: 12, alternative_window_months: 6, horizon_months: 12,
  fixed_cost: 300000, per_participant_cost: 300, target_pathway_step: "recognition-to-referral",
  mechanism: "navigation-support", assumption_refs: [], artifact_version: "TEST-ONLY"
};
export function fixture(
  change?: (objects: {mapping: any; policy: any; sourceIndex: any; review: any; registry: any}) => void,
  subject: "amended" | "original" = "amended"
): {bytes: AcquisitionReleaseBytes; pins: string[]} {
  const mappingFile = subject === "amended" ? "mapping-candidates.privacy-amendment-1.json" : "mapping-candidates.json";
  const policyFile = subject === "amended" ? "context-policy.privacy-amendment-1.json" : "context-policy.candidate.json";
  const mapping = JSON.parse(readInput(mappingFile));
  const policy = JSON.parse(readInput(policyFile));
  const sourceIndex = JSON.parse(readInput("source-index.json"));
  const review = {
    schema_version: "1", status: "approved_for_release", reviewer: "SYNTHETIC TEST ACTOR — NO REAL APPROVAL",
    reviewed_at: "2000-01-01T00:00:00Z", evidence_url: "https://example.test/synthetic-review",
    code_commit: "0".repeat(40), mapping_sha256: "", policy_sha256: "", source_index_sha256: "",
    decisions: ["ACQ26-TIMING-01", "ACQ26-CAPACITY-01"].map(hint_id => ({hint_id, version: "2", mapping: "approved", privacy: "aggregate_only", context: "approved", release: "approved"}))
  };
  const registry = {
    schema_version: "1", registry_id: "SYNTHETIC-TEST-REGISTRY", version: "TEST-1", release_status: "reviewed_released",
    mapping_sha256: "", policy_sha256: "", source_index_sha256: "", review_sha256: "",
    approved_hint_ids: ["ACQ26-TIMING-01@2", "ACQ26-CAPACITY-01@2"]
  };
  change?.({mapping, policy, sourceIndex, review, registry});
  // Preserve the real frozen preimages by default. For mutation tests, rebuild all
  // dependency hashes so closed-object/semantic tests cannot pass on digest checks alone.
  const mappingText = JSON.stringify(mapping) === JSON.stringify(JSON.parse(readInput(mappingFile))) ? readInput(mappingFile) : JSON.stringify(mapping);
  const sourceText = JSON.stringify(sourceIndex) === JSON.stringify(JSON.parse(readInput("source-index.json"))) ? readInput("source-index.json") : JSON.stringify(sourceIndex);
  policy.mapping_candidates_sha256 = digest(mappingText);
  policy.source_index_sha256 = digest(sourceText);
  const policyText = JSON.stringify(policy) === JSON.stringify(JSON.parse(readInput(policyFile))) ? readInput(policyFile) : JSON.stringify(policy);
  registry.mapping_sha256 = review.mapping_sha256 = digest(mappingText);
  registry.policy_sha256 = review.policy_sha256 = digest(policyText);
  registry.source_index_sha256 = review.source_index_sha256 = digest(sourceText);
  const reviewText = JSON.stringify(review);
  registry.review_sha256 = digest(reviewText);
  const bytes = {
    registry: JSON.stringify(registry), mapping: mappingText, policy: policyText, sourceIndex: sourceText, review: reviewText,
    applicationContext: readInput("application-context.json"),
    artifact: readFileSync(new URL("../../../artifacts/reviewed/meps-2024-long-covid-candidate-20260926T011343Z/bundle.json",import.meta.url),"utf8")
  };
  return {bytes, pins: [digest(bytes.registry)]};
}
