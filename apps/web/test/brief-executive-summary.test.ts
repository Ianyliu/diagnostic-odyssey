import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {fileURLToPath} from "node:url";
import test from "node:test";
import {canExportEstimate, type ArtifactBundle} from "@diagnostic-odyssey/contracts";
import {BRIEF_HEADLINE_ESTIMATE_IDS, selectBriefExecutiveHighlights} from "../src/data/briefExecutiveSummary.ts";

const artifactPath = fileURLToPath(new URL(
  "../../../../artifacts/reviewed/meps-2024-long-covid-candidate-20260926T011343Z/bundle.json", import.meta.url
));
const artifact = JSON.parse(readFileSync(artifactPath, "utf8")) as ArtifactBundle;
const national = artifact.burden_domains.flatMap(domain => domain.measures);
const selected = selectBriefExecutiveHighlights(national);

test("executive national headlines use exact reviewed, export-eligible IDs and retain source identity", () => {
  assert.deepEqual(selected.map(item => item.estimate.estimate_id), Object.values(BRIEF_HEADLINE_ESTIMATE_IDS));
  assert.ok(selected.every(item => canExportEstimate(item.estimate)));
  assert.ok(selected.every(item => item.estimate.source_ref === "meps-hc256-2024"));
  assert.ok(selected.every(item => item.estimate.artifact_version === artifact.manifest.artifact_version));
  assert.equal(selected[1]?.estimate.unit, "USD/year");
  assert.equal(selected[3]?.estimate.unit, "proportion");
  assert.notEqual(selected[3]?.estimate.measure_id, "k6-score-mean");
});

test("missing or unreleased headline is omitted, never replaced or imputed", () => {
  const without = national.filter(item => item.estimate_id !== BRIEF_HEADLINE_ESTIMATE_IDS.population);
  assert.equal(selectBriefExecutiveHighlights(without).length, 3);
  const suppressed = structuredClone(national);
  const record = suppressed.find(item => item.estimate_id === BRIEF_HEADLINE_ESTIMATE_IDS.seriousDistress)!;
  record.release_status = "suppressed";
  assert.equal(selectBriefExecutiveHighlights(suppressed).length, 3);
  assert.equal(national.find(item => item.estimate_id === BRIEF_HEADLINE_ESTIMATE_IDS.seriousDistress)?.release_status, "reviewed_released");
});
