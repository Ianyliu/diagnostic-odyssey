import assert from "node:assert/strict";
import test from "node:test";
import { buildPlanningBrief } from "../src/index.ts";
import type { Estimate } from "@diagnostic-odyssey/contracts";

const estimate = (release_status: Estimate["release_status"], display_status: Estimate["display_status"]): Estimate => ({
  estimate_id:`${release_status}-${display_status}`, measure_id:"m", label:"Measure",
  value: release_status === "suppressed" ? null : 1, unit:"people",
  interval_low:null, interval_high:null, interval_type:null,
  denominator:"denom", universe:"universe", system_boundary:"national",
  evidence_type:"survey_estimate", release_status, display_status,
  source_ref:"s", artifact_version:"v1", allowed_interpretation:"descriptive",
  prohibited_interpretation:[], limitations:[]
});
test("brief excludes illustrative and unreleased estimates", () => {
  const brief = buildPlanningBrief({
    context:{condition_id:"c",cohort_id:"x",age_range:"18–64",evidence_year:2024,geography_scope:"national",local_context_id:null,severity_filter:null,artifact_version:"v1"},
    estimates:[
      estimate("reviewed_released","analytical_artifact"),
      estimate("reviewed_released","illustrative"),
      estimate("suppressed","analytical_artifact")
    ],
    localContext:[], evidence:[], dataRequests:[], generatedAt:"2026-01-01T00:00:00Z"
  });
  assert.equal(brief.burden_findings.length, 1);
});


test("brief preserves release gating for preliminary and illustrative values", () => {
  const brief = buildPlanningBrief({
    context:{condition_id:"c",cohort_id:"x",age_range:"18–64",evidence_year:2024,geography_scope:"United States",local_context_id:null,severity_filter:null,artifact_version:"v1"},
    estimates:[
      estimate("reviewed_released","analytical_artifact"),
      estimate("preliminary","analytical_artifact"),
      estimate("reviewed_released","illustrative")
    ],
    localContext:[],
    evidence:[],
    dataRequests:[],
    generatedAt:"2026-01-01T00:00:00Z"
  });

  assert.equal(brief.burden_findings.length, 1);
  assert.equal(brief.burden_findings[0]?.release_status, "reviewed_released");
  assert.equal(brief.burden_findings[0]?.display_status, "analytical_artifact");
});
