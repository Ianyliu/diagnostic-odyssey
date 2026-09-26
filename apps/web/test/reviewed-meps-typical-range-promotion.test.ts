import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  assertValidArtifactBundle,
  type ArtifactBundle,
  type Estimate
} from "@diagnostic-odyssey/contracts";

const oldBundlePath = fileURLToPath(
  new URL(
    "../../../artifacts/reviewed/meps-2024-long-covid-candidate-20260923T020607Z/bundle.json",
    import.meta.url
  )
);
const newDirectory = fileURLToPath(
  new URL(
    "../../../artifacts/reviewed/meps-2024-long-covid-candidate-20260926T011343Z/",
    import.meta.url
  )
);
const newBundlePath = resolve(newDirectory, "bundle.json");
const newManifestPath = resolve(newDirectory, "review-manifest.json");
const newChecksumPath = resolve(newDirectory, "SHA256SUMS");

const readJson = (path: string): unknown => JSON.parse(readFileSync(path, "utf8"));
const hashFile = (path: string) =>
  createHash("sha256").update(readFileSync(path)).digest("hex");

const oldRaw = readJson(oldBundlePath);
const newRaw = readJson(newBundlePath);
assertValidArtifactBundle(oldRaw);
assertValidArtifactBundle(newRaw);
const oldBundle: ArtifactBundle = oldRaw;
const newBundle: ArtifactBundle = newRaw;

const flatten = (bundle: ArtifactBundle): Estimate[] =>
  bundle.burden_domains.flatMap(domain => domain.measures);

const oldEstimates = flatten(oldBundle);
const newEstimates = flatten(newBundle);

type PromotionManifest = {
  artifact_version: string;
  release_status: string;
  automatic_release: boolean;
  checks: Array<{id: string; status: string}>;
  review_decision: string;
  review_type: string;
  approved_estimate_count: number;
  suppressed_estimate_count: number;
  candidate_artifact_id: string;
  candidate_workflow_run_id: string;
  candidate_artifact_name: string;
  candidate_artifact_zip_sha256: string;
  candidate_code_commit: string;
  candidate_bundle_sha256: string;
  candidate_diagnostics_sha256: string;
  candidate_review_manifest_sha256: string;
  candidate_hc256_source_metadata_sha256: string;
  candidate_github_actions_run_manifest_sha256: string;
  source_input_sha256: string;
  expected_source_input_sha256: string;
  source_input_sha256_match: boolean;
  reviewed_bundle_sha256: string;
  reviewed_diagnostics_sha256: string;
  promotion_gate: string;
  promotion_scope: string;
  numerical_recomputation_performed: boolean;
  runtime_selection_changed: boolean;
  checks_approved_count: number;
};

const promotionManifest = readJson(newManifestPath) as PromotionManifest;

test("new durable reviewed MEPS bundle validates with exactly the two approved Typical Ranges", () => {
  assert.equal(newBundle.manifest.artifact_version, "meps-2024-long-covid-candidate-20260926T011343Z");
  assert.equal(newEstimates.length, 21);
  assert.equal(newBundle.local_context.length, 0);
  assert.ok(newEstimates.every(e => e.release_status === "reviewed_released"));
  assert.ok(newEstimates.every(e => e.display_status === "analytical_artifact"));

  const summaries = newEstimates
    .filter(e => e.distribution_summary !== undefined)
    .sort((a, b) => a.estimate_id.localeCompare(b.estimate_id));

  assert.deepEqual(
    summaries.map(e => e.estimate_id),
    [
      "meps24-gross-all-cause-spending-mean",
      "meps24-healthcare-paperwork-time-mean"
    ]
  );

  const spending = summaries[0]!;
  assert.equal(spending.distribution_summary!.p25, 1116);
  assert.equal(spending.distribution_summary!.p50, 3624);
  assert.equal(spending.distribution_summary!.p75, 14840);
  assert.equal(spending.distribution_summary!.unweighted_n, spending.unweighted_n);
  assert.equal(
    spending.distribution_summary!.weighted_denominator,
    spending.weighted_denominator
  );
  assert.equal(spending.distribution_summary!.weight_variable, spending.weight_variable);
  assert.equal(
    spending.distribution_summary!.variance_stratum_variable,
    spending.variance_stratum_variable
  );
  assert.equal(
    spending.distribution_summary!.variance_psu_variable,
    spending.variance_psu_variable
  );

  const paperwork = summaries[1]!;
  assert.equal(paperwork.distribution_summary!.p25, 0);
  assert.equal(paperwork.distribution_summary!.p50, 3);
  assert.equal(paperwork.distribution_summary!.p75, 12);
  assert.equal(paperwork.distribution_summary!.unweighted_n, paperwork.unweighted_n);
  assert.equal(
    paperwork.distribution_summary!.weighted_denominator,
    paperwork.weighted_denominator
  );
  assert.equal(paperwork.distribution_summary!.weight_variable, paperwork.weight_variable);
  assert.equal(
    paperwork.distribution_summary!.variance_stratum_variable,
    paperwork.variance_stratum_variable
  );
  assert.equal(
    paperwork.distribution_summary!.variance_psu_variable,
    paperwork.variance_psu_variable
  );
});

test("all 21 pre-existing Estimate records are unchanged apart from release/version/distribution additions", () => {
  const normalize = (estimate: Estimate) => {
    const {
      release_status,
      artifact_version,
      distribution_summary,
      ...rest
    } = estimate;
    void release_status;
    void artifact_version;
    void distribution_summary;
    return rest;
  };
  const normalized = (estimates: Estimate[]) =>
    estimates
      .map(normalize)
      .sort((a, b) => a.estimate_id.localeCompare(b.estimate_id));

  assert.equal(oldEstimates.length, 21);
  assert.equal(newEstimates.length, 21);
  assert.deepEqual(normalized(newEstimates), normalized(oldEstimates));
});

test("review manifest records explicit promotion and preserves approved candidate provenance", () => {
  assert.equal(promotionManifest.artifact_version, "meps-2024-long-covid-candidate-20260926T011343Z");
  assert.equal(promotionManifest.release_status, "reviewed_released");
  assert.equal(promotionManifest.automatic_release, false);
  assert.equal(promotionManifest.review_decision, "approved");
  assert.equal(
    promotionManifest.review_type,
    "explicit_reviewed_artifact_promotion"
  );
  assert.equal(promotionManifest.approved_estimate_count, 21);
  assert.equal(promotionManifest.suppressed_estimate_count, 0);
  assert.equal(promotionManifest.candidate_workflow_run_id, "36207596582");
  assert.equal(promotionManifest.candidate_artifact_id, "10894637150");
  assert.equal(
    promotionManifest.candidate_artifact_name,
    "meps-2024-long-covid-candidate-36207596582"
  );
  assert.equal(
    promotionManifest.candidate_artifact_zip_sha256,
    "3741d43d1145209d00f16d871d4477f028020def627b9b3e53837ed38dca6e10"
  );
  assert.equal(
    promotionManifest.candidate_code_commit,
    "7b56517442d75f6ac662e7f8db6bbd44cca3de33"
  );
  assert.equal(
    promotionManifest.candidate_bundle_sha256,
    "ffe6c73c2b831196ec5baa9f1e4d99003ffb233a97802d05aef1708844943f40"
  );
  assert.equal(
    promotionManifest.candidate_diagnostics_sha256,
    "6ea703bde35ff3ee2ddc75c21afcaeb9de8b273dec010255dd59174142ac9767"
  );
  assert.equal(
    promotionManifest.candidate_review_manifest_sha256,
    "d6b4f799ed25e262ce513a0db003e2c1cebee9b8b46f9b927419be863c566892"
  );
  assert.equal(
    promotionManifest.candidate_hc256_source_metadata_sha256,
    "f0f704df6ee8d082c01175d7107103a255e8d480471bfdc9935c4d21d6c96ee2"
  );
  assert.equal(
    promotionManifest.candidate_github_actions_run_manifest_sha256,
    "d1bd1cabd4e116a2db0481524e982819c80a7c567a5e1e7e27c06b60ada893a3"
  );
  assert.equal(
    promotionManifest.source_input_sha256,
    "b4bde859b39f626345561c05570292bb7264dd92eb76ce0c1a14d6b89076aed5"
  );
  assert.equal(
    promotionManifest.expected_source_input_sha256,
    promotionManifest.source_input_sha256
  );
  assert.equal(promotionManifest.source_input_sha256_match, true);
  assert.equal(promotionManifest.promotion_gate, "passed");
  assert.equal(promotionManifest.promotion_scope, "release_state_only");
  assert.equal(promotionManifest.numerical_recomputation_performed, false);
  assert.equal(promotionManifest.runtime_selection_changed, false);
  assert.equal(promotionManifest.checks_approved_count, 8);

  assert.deepEqual(
    promotionManifest.checks,
    [
      "methods_review",
      "cohort_review",
      "weighted_unweighted_n_review",
      "interval_review",
      "denominator_universe_review",
      "plausibility_review",
      "provenance_review",
      "interpretation_review"
    ].map(id => ({id, status: "approved"}))
  );
});

test("new reviewed package checksums verify and preservation-required candidate files are byte-identical", () => {
  const expected = new Map<string, string>([
    ["bundle.json", "5b32bfb3288a28ce0a57de4d0c3ec75fe1d83c0f19ad481e687b70af4a91eca0"],
    ["diagnostics.json", "6ea703bde35ff3ee2ddc75c21afcaeb9de8b273dec010255dd59174142ac9767"],
    ["review-manifest.json", "05fa3b743bde8af933bcb52a19cd564038f6416490b444aa073890beccdff994"],
    ["hc256-source-metadata.json", "f0f704df6ee8d082c01175d7107103a255e8d480471bfdc9935c4d21d6c96ee2"],
    ["github-actions-run-manifest.json", "d1bd1cabd4e116a2db0481524e982819c80a7c567a5e1e7e27c06b60ada893a3"]
  ]);

  const checksumLines = readFileSync(newChecksumPath, "utf8").trim().split("\n");
  assert.equal(checksumLines.length, expected.size);
  for (const line of checksumLines) {
    const [hash, fileName] = line.split(/\s{2}/);
    assert.ok(hash);
    assert.ok(fileName);
    assert.equal(hash, expected.get(fileName));
    assert.equal(hashFile(resolve(dirname(newChecksumPath), fileName)), hash);
  }

  assert.equal(
    hashFile(resolve(newDirectory, "diagnostics.json")),
    promotionManifest.candidate_diagnostics_sha256
  );
  assert.equal(
    hashFile(resolve(newDirectory, "hc256-source-metadata.json")),
    promotionManifest.candidate_hc256_source_metadata_sha256
  );
  assert.equal(
    hashFile(resolve(newDirectory, "github-actions-run-manifest.json")),
    promotionManifest.candidate_github_actions_run_manifest_sha256
  );
  assert.equal(promotionManifest.reviewed_bundle_sha256, hashFile(newBundlePath));
  assert.equal(
    promotionManifest.reviewed_diagnostics_sha256,
    hashFile(resolve(newDirectory, "diagnostics.json"))
  );
});

test("durable promotion does not switch runtime, rebind WV, or calibrate Pilot", () => {
  const runtime = readFileSync(
    fileURLToPath(new URL("../src/data/reviewedArtifact.ts", import.meta.url)),
    "utf8"
  );
  const localValidation = readFileSync(
    fileURLToPath(new URL("../src/data/reviewedLocalContextValidation.ts", import.meta.url)),
    "utf8"
  );
  const pilot = readFileSync(
    fileURLToPath(new URL("../src/pages/PilotPage.tsx", import.meta.url)),
    "utf8"
  );

  assert.match(runtime, /meps-2024-long-covid-candidate-20260923T020607Z/);
  assert.doesNotMatch(runtime, /meps-2024-long-covid-candidate-20260926T011343Z/);
  assert.match(
    localValidation,
    /meps-2024-long-covid-candidate-20260923T020607Z/
  );
  assert.equal(newBundle.scenario_examples.length, 0);
  assert.doesNotMatch(pilot, /inside (?:the )?(?:typical |empirical )?range/i);
  assert.doesNotMatch(pilot, /outside (?:the )?(?:typical |empirical )?range/i);
  assert.doesNotMatch(pilot, /empirically calibrated/i);
});
