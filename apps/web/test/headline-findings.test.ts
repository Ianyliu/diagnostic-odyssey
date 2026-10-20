import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import test from "node:test";
import { canExportEstimate } from "@diagnostic-odyssey/contracts";
import { loadReviewedMepsArtifact } from "../src/data/reviewedArtifact.ts";
import { HEADLINE_FINDINGS, selectHeadlineFindings } from "../src/data/headlineFindings.ts";
const bundle = loadReviewedMepsArtifact();
test("headline findings resolve to reviewed export-eligible national estimates", () => {
 const rows=selectHeadlineFindings(bundle);
 assert.equal(rows.length,HEADLINE_FINDINGS.length);
 for(const {estimate} of rows){assert.ok(canExportEstimate(estimate));assert.equal(typeof estimate.value,"number");}
});
test("U09 and unreviewed measures never enter Overview",()=>{
 for(const spec of HEADLINE_FINDINGS){assert.match(spec.estimateId,/^meps24-/);assert.doesNotMatch(spec.estimateId,/u09|linked-condition/i);}
});
test("headline interpretations remain descriptive and screening is not diagnosis",()=>{
 const labels=selectHeadlineFindings(bundle).map(({spec,estimate})=>spec.label(estimate)).join(" ");
 assert.doesNotMatch(labels,/caused by|attributable|savings|ROI|diagnosed with depression/i);
 assert.match(labels,/a screen, not a diagnosis/);
 assert.match(labels,/all causes/);
 assert.match(labels,/medical bills and insurance/);
 assert.match(labels,/K6 threshold/);
});
test("ordinary estimate count uses reviewed export eligibility rather than a literal",()=>{
 const selected=bundle.burden_domains.flatMap(domain => domain.measures).filter(canExportEstimate);
 assert.equal(selected.length,21);
 const source=readFileSync(new URL("../src/components/HeadlineFindings.tsx",import.meta.url),"utf8");
 assert.match(source,/filter\(canExportEstimate\)\.length/);
 assert.doesNotMatch(source,/Explore all 21/);
});
