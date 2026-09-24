import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import test from "node:test";
import {
  assertValidLocalContextArtifact,
  canLoadReviewedLocalContextArtifact,
  type LocalContextArtifact
} from "../src/index.ts";

const artifactPath = new URL(
  "../../../artifacts/reviewed/local-context-wv-hrsa-acs-candidate-20260924T052332Z/local-context.json",
  import.meta.url
);
const artifactRaw = fs.readFileSync(artifactPath);
const artifact = JSON.parse(artifactRaw.toString("utf8")) as LocalContextArtifact;
const reviewManifestPath = new URL(
  "../../../artifacts/reviewed/local-context-wv-hrsa-acs-candidate-20260924T052332Z/review-manifest.json",
  import.meta.url
);
const reviewManifest = JSON.parse(fs.readFileSync(reviewManifestPath, "utf8")) as Record<string, unknown>;

test("promoted WV local-context artifact is valid and eligible for reviewed loading", () => {
  assert.doesNotThrow(() => assertValidLocalContextArtifact(artifact));
  assert.equal(canLoadReviewedLocalContextArtifact(artifact), true);
});

test("promoted WV local-context artifact preserves the approved release and geography invariants", () => {
  assert.equal(artifact.manifest.release_status, "reviewed_released");
  assert.equal(artifact.manifest.national_meps_burden_unchanged, true);
  assert.equal(artifact.indicators.length, 34);
  assert.ok(artifact.indicators.every(record => record.release_status === "reviewed_released"));

  assert.deepEqual(artifact.geography, {
    geography_name: "West Virginia",
    geography_type: "state",
    state_fips: "54",
    county_fips: null
  });

  assert.ok(artifact.indicators.every(record =>
    record.geography_name === "West Virginia" &&
    record.geography_type === "state" &&
    record.state_fips === "54" &&
    record.county_fips === null
  ));
});


test("promotion manifest is cryptographically bound to the reviewed payload and preserves promotion boundaries", () => {
  const reviewedHash = crypto.createHash("sha256").update(artifactRaw).digest("hex");
  assert.equal(reviewedHash, "82e3cc5d5c6bd1d084fddb47b36ca08df76be19ab2a641dbba50b8c59c467bc4");
  assert.equal(reviewManifest.reviewed_local_context_sha256, reviewedHash);
  assert.equal(
    reviewManifest.candidate_local_context_sha256,
    "05961842229ffff252d2deda74e10d1c1dd542c38678684f65ca6fa0fabb8588"
  );
  assert.equal(reviewManifest.numerical_recomputation_performed, false);
  assert.equal(reviewManifest.runtime_selection_changed, false);
  assert.equal(reviewManifest.state_level_only, true);
  assert.equal(reviewManifest.county_evidence_approved, false);
});
