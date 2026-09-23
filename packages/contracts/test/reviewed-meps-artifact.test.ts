import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  assertValidArtifactBundle,
  canExportEstimate,
  type ArtifactBundle
} from "../src/index.ts";

const reviewedBundlePath = fileURLToPath(
  new URL(
    "../../../artifacts/reviewed/meps-2024-long-covid-candidate-20260923T020607Z/bundle.json",
    import.meta.url
  )
);

test("reviewed MEPS 2024 artifact validates and all 21 estimates are exportable", () => {
  const bundle = JSON.parse(
    readFileSync(reviewedBundlePath, "utf8")
  ) as ArtifactBundle;

  assert.doesNotThrow(() => assertValidArtifactBundle(bundle));

  const estimates = bundle.burden_domains.flatMap(domain => domain.measures);
  assert.equal(estimates.length, 21);
  assert.ok(estimates.every(canExportEstimate));
  assert.ok(estimates.every(
    estimate => estimate.release_status === "reviewed_released"
  ));
  assert.ok(estimates.every(
    estimate => estimate.display_status === "analytical_artifact"
  ));
  assert.equal(
    estimates.filter(estimate => estimate.release_status === "preliminary").length,
    0
  );
  assert.equal(
    estimates.filter(estimate => estimate.release_status === "suppressed").length,
    0
  );
  assert.equal(
    bundle.manifest.artifact_version,
    "meps-2024-long-covid-candidate-20260923T020607Z"
  );
  assert.equal(
    bundle.manifest.code_commit,
    "8952bb7446b7b0461e41f1794146ab5e612ebf40"
  );
});
