import assert from "node:assert/strict";
import test from "node:test";
import { canExportEstimate } from "@diagnostic-odyssey/contracts";
import { loadReviewedMepsArtifact } from "../src/data/reviewedArtifact.ts";
import { HEADLINE_FINDINGS, selectHeadlineFindings, formatWorkWeeks } from "../src/data/headlineFindings.ts";
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
});
test("time translation does not imply sub-week precision",()=>{
 assert.equal(formatWorkWeeks(76.46),"about 2 forty-hour work weeks");
 assert.equal(formatWorkWeeks(40),"about 1 forty-hour work week");
 assert.equal(formatWorkWeeks(57),"about 1.5 forty-hour work weeks");
});
