import assert from "node:assert/strict";
import test from "node:test";
import {
  canExportEstimate,
  validateEstimate,
  validateScenario,
  type Estimate
} from "../src/index.ts";

test("suppressed values cannot carry a numeric value", () => {
  const issues = validateEstimate({
    estimate_id: "e1",
    measure_id: "m1",
    label: "Suppressed",
    value: 5,
    unit: "people",
    interval_low: null,
    interval_high: null,
    interval_type: null,
    denominator: "adults",
    universe: "US adults",
    system_boundary: "national survey",
    evidence_type: "survey_estimate",
    release_status: "suppressed",
    display_status: "analytical_artifact",
    source_ref: "src",
    artifact_version: "v1",
    allowed_interpretation: "none",
    prohibited_interpretation: [],
    limitations: []
  });
  assert.ok(issues.some(issue => issue.path.endsWith(".value")));
});

test("scenario reach is a proportion", () => {
  const issues = validateScenario({
    scenario_id: "s",
    eligible_population: 100,
    reach: 25,
    capacity: 25,
    baseline_window_months: 12,
    alternative_window_months: 6,
    horizon_months: 12,
    fixed_cost: 10,
    per_participant_cost: 1,
    target_pathway_step: "recognition",
    mechanism: "navigation",
    assumption_refs: [],
    artifact_version: "v1"
  });
  assert.ok(issues.some(issue => issue.path.endsWith(".reach")));
});

test("only reviewed analytical estimates are exportable", () => {
  const base: Estimate = {
    estimate_id: "e",
    measure_id: "m",
    label: "Estimate",
    value: 1,
    unit: "people",
    interval_low: 0.5,
    interval_high: 1.5,
    interval_type: "95% CI",
    denominator: "adults",
    universe: "US adults",
    system_boundary: "national",
    evidence_type: "survey_estimate",
    release_status: "reviewed_released",
    display_status: "analytical_artifact",
    source_ref: "src",
    artifact_version: "v1",
    allowed_interpretation: "descriptive",
    prohibited_interpretation: [],
    limitations: []
  };
  assert.equal(canExportEstimate(base), true);
  assert.equal(canExportEstimate({ ...base, display_status: "illustrative" }), false);
});
