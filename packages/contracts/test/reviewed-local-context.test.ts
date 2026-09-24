import assert from "node:assert/strict";
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
const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8")) as LocalContextArtifact;

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
