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

const scenarioInput = {
  scenario_id: "test", eligible_population: 12000, reach: 0.25, capacity: 3000,
  baseline_window_months: 12, alternative_window_months: 6, horizon_months: 12,
  fixed_cost: 300000, per_participant_cost: 300,
  target_pathway_step: "recognition-to-referral", mechanism: "navigation-support",
  assumption_refs: [], artifact_version: "test"
};
const scenarioResult = {
  scenario_id: "test", intended_reach: 3000, reached_participants: 3000, capacity_gap: 0,
  baseline_person_months: 36000, alternative_person_months: 18000, difference_person_months: 18000,
  fixed_program_cost: 300000, variable_program_cost: 900000, program_resource_requirement: 1200000,
  target_pathway_step: "recognition-to-referral", target_mechanism: "navigation-support"
};
function validNumericalBrief() {
  return buildPlanningBrief({
    context:{condition_id:"c",cohort_id:"x",age_range:"18–64",evidence_year:2024,geography_scope:"United States",local_context_id:null,severity_filter:null,artifact_version:"v1"},
    estimates:[estimate("reviewed_released", "analytical_artifact")],
    localContext:[localRecord("reviewed_released")],
    scenario:{input:{...scenarioInput}, result:{...scenarioResult}},
    evidence:[], dataRequests:[], generatedAt:"2026-10-08T00:00:00.000Z"
  });
}

test("actual serialized Brief JSON preserves finite quantities, valid zeros, and scientific nullable fields", async () => {
  const {serializeBriefJson} = await import("../src/index.ts");
  const brief = validNumericalBrief();
  const serialized = serializeBriefJson(brief);
  const parsed = JSON.parse(serialized);
  assert.deepEqual(parsed.scenario.input, scenarioInput);
  assert.deepEqual(parsed.scenario.result, scenarioResult);
  assert.equal(parsed.scenario.result.capacity_gap, 0);
  for (const [key, value] of Object.entries(scenarioResult)) {
    if (typeof value === "number") {
      assert.equal(typeof parsed.scenario.result[key], "number");
      assert.ok(Number.isFinite(parsed.scenario.result[key]));
      assert.notEqual(parsed.scenario.result[key], null);
    }
  }
  assert.equal(parsed.burden_findings[0].interval_low, null);
  assert.equal(parsed.local_context[0].margin_of_error, null);
  assert.doesNotMatch(serialized, /NaN|Infinity/);
});

test("Brief construction and export reject every non-finite scenario result instead of serializing null", async () => {
  const {serializeBriefJson} = await import("../src/index.ts");
  for (const [key, value] of Object.entries(scenarioResult)) {
    if (typeof value !== "number") continue;
    for (const invalid of [NaN, Infinity, -Infinity, null]) {
      const result = {...scenarioResult, [key]: invalid};
      assert.throws(() => buildPlanningBrief({
        context:validNumericalBrief().context, estimates:[],localContext:[],
        scenario:{input:scenarioInput,result:result as typeof scenarioResult}, evidence:[], dataRequests:[]
      }), /Cannot export Planning Brief/);
      const brief = validNumericalBrief();
      brief.scenario!.result = result as typeof scenarioResult;
      assert.throws(() => serializeBriefJson(brief), /Cannot export Planning Brief/);
    }
  }
});

test("export revalidates finite scenario inputs and catches non-finite values elsewhere in the Brief", async () => {
  const {serializeBriefJson} = await import("../src/index.ts");
  for (const invalid of [NaN, Infinity, -Infinity]) {
    const invalidInput = validNumericalBrief();
    invalidInput.scenario!.input.fixed_cost = invalid;
    assert.throws(() => serializeBriefJson(invalidInput), /Cannot export Planning Brief/);
    const invalidEstimate = validNumericalBrief();
    invalidEstimate.burden_findings[0]!.value = invalid;
    assert.throws(() => serializeBriefJson(invalidEstimate), /must be a finite number/);
    const invalidContext = validNumericalBrief();
    invalidContext.local_context[0]!.margin_of_error = invalid;
    assert.throws(() => serializeBriefJson(invalidContext), /must be a finite number/);
  }
});
