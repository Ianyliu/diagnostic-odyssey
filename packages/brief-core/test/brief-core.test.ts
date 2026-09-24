import assert from "node:assert/strict";
import test from "node:test";
import { buildPlanningBrief } from "../src/index.ts";
import type { Estimate, LocalContextRecord } from "@diagnostic-odyssey/contracts";

const estimate = (release_status: Estimate["release_status"], display_status: Estimate["display_status"]): Estimate => ({
  estimate_id: release_status + "-" + display_status, measure_id:"m", label:"Measure",
  value: release_status === "suppressed" ? null : 1, unit:"people",
  interval_low:null, interval_high:null, interval_type:null,
  denominator:"denom", universe:"universe", system_boundary:"national",
  evidence_type:"survey_estimate", release_status, display_status,
  source_ref:"s", artifact_version:"v1", allowed_interpretation:"descriptive",
  prohibited_interpretation:[], limitations:[]
});

const localRecord = (
  release_status: LocalContextRecord["release_status"],
  state: LocalContextRecord["state"] = "loaded"
): LocalContextRecord => ({
  indicator_id: "wv.test." + release_status + "." + state,
  label: "Local test indicator",
  geography_name: "West Virginia",
  geography_type: "state",
  state_fips: "54",
  county_fips: null,
  source_agency: "Test source",
  source_ref: "test-source",
  source_locator: "https://example.test",
  source_release_vintage: "test vintage",
  observation_as_of_date: "2026-09-24",
  value: 1,
  unit: "designations",
  universe: "test universe",
  margin_of_error: null,
  confidence_level: null,
  uncertainty_type: null,
  context_type: "contextual_indicator",
  state,
  limitations: [],
  allowed_interpretation: "implementation context",
  prohibited_interpretation: [],
  release_status
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

test("brief requires reviewed release status as well as loaded or partial local-context state", () => {
  const brief = buildPlanningBrief({
    context:{condition_id:"c",cohort_id:"x",age_range:"18–64",evidence_year:2024,geography_scope:"United States",local_context_id:null,severity_filter:null,artifact_version:"v1"},
    estimates:[],
    localContext:[
      localRecord("reviewed_released", "loaded"),
      localRecord("reviewed_released", "partial"),
      localRecord("preliminary", "loaded"),
      localRecord("preliminary", "partial"),
      localRecord("reviewed_released", "empty")
    ],
    evidence:[],
    dataRequests:[],
    generatedAt:"2026-01-01T00:00:00Z"
  });

  assert.equal(brief.local_context.length, 2);
  assert.ok(brief.local_context.every(record => record.release_status === "reviewed_released"));
  assert.ok(brief.local_context.every(record => record.state === "loaded" || record.state === "partial"));
});
