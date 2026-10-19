import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { canExportEstimate, assertValidArtifactBundle, type ArtifactBundle } from "@diagnostic-odyssey/contracts";
import { formatEstimateInterval, formatEstimateValue } from "../src/data/formatEstimateValue.ts";

const read = (relative: string) => readFileSync(fileURLToPath(new URL(relative, import.meta.url)), "utf8");
const source: unknown = JSON.parse(read("../../../artifacts/reviewed/meps-2024-long-covid-candidate-20260926T011343Z/bundle.json"));
assertValidArtifactBundle(source);
const bundle: ArtifactBundle = source;

test("Overview headline evidence remains an unmodified subset of the ordinary 21 reviewed measures", () => {
  const estimates = bundle.burden_domains.flatMap(d => d.measures).filter(canExportEstimate);
  assert.equal(estimates.length, 21);
  for (const id of ["gross-all-cause-spending-total", "medical-bills-insurance-time", "k6-serious-distress"]) {
    const item = estimates.find(e => e.measure_id === id);
    assert.ok(item);
    assert.match(formatEstimateInterval(item), /^95% CI /);
    assert.ok(formatEstimateValue(item).length > 0);
  }
  const overview = read("../src/pages/OverviewPage.tsx");
  assert.match(overview, /reviewedMeasures\.find\(item => item\.measure_id === measureId\)/);
  assert.match(overview, /formatEstimateInterval\(estimate\)/);
  assert.match(overview, /estimate\.universe/);
  assert.doesNotMatch(overview, /tryLoadReviewedLinkedConditionSecondaryEvidence|exact-U09|linkedCondition/);
  assert.match(overview, /not attributable Long COVID or diagnostic-delay cost/i);
});
