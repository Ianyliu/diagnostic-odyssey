import assert from "node:assert/strict";
import test from "node:test";
import {
  attachBoundedEffect,
  calculateScenario,
  InvalidScenarioError,
  oneWaySensitivity,
  type SensitivityPoint
} from "../src/index.ts";
import type { Scenario } from "@diagnostic-odyssey/contracts";

const base: Scenario = {
  scenario_id: "long-covid-recognition-demo",
  eligible_population: 12_000,
  reach: 0.25,
  capacity: 3_000,
  baseline_window_months: 12,
  alternative_window_months: 6,
  horizon_months: 12,
  fixed_cost: 300_000,
  per_participant_cost: 300,
  target_pathway_step: "recognition-to-referral",
  mechanism: "navigation-support",
  assumption_refs: ["fixture-assumption-set"],
  artifact_version: "fixture-v1"
};

test("golden scenario calculates reach, exposure, and resources", () => {
  const result = calculateScenario(base);
  assert.deepEqual(result, {
    scenario_id: "long-covid-recognition-demo",
    intended_reach: 3_000,
    reached_participants: 3_000,
    capacity_gap: 0,
    baseline_person_months: 36_000,
    alternative_person_months: 18_000,
    difference_person_months: 18_000,
    fixed_program_cost: 300_000,
    variable_program_cost: 900_000,
    program_resource_requirement: 1_200_000,
    target_pathway_step: "recognition-to-referral",
    target_mechanism: "navigation-support"
  });
});

test("capacity constrains reached participants and creates an explicit gap", () => {
  const result = calculateScenario({ ...base, capacity: 2_000 });
  assert.equal(result.intended_reach, 3_000);
  assert.equal(result.reached_participants, 2_000);
  assert.equal(result.capacity_gap, 1_000);
  assert.equal(result.program_resource_requirement, 900_000);
});

test("horizon caps unresolved-recognition exposure", () => {
  const result = calculateScenario({ ...base, horizon_months: 4, alternative_window_months: 3 });
  assert.equal(result.baseline_person_months, 12_000);
  assert.equal(result.alternative_person_months, 9_000);
  assert.equal(result.difference_person_months, 3_000);
});

test("invalid alternative window fails instead of silently producing negative exposure difference", () => {
  assert.throws(
    () => calculateScenario({ ...base, alternative_window_months: 13 }),
    InvalidScenarioError
  );
});

test("bounded effects cannot leak across pathway steps or mechanisms", () => {
  const result = calculateScenario(base);
  assert.throws(() => attachBoundedEffect(base, result, {
    parameter_id: "p",
    value_low: 0.1,
    value_high: 0.2,
    unit: "proportion",
    pathway_step: "specialist-treatment",
    target_mechanism: "navigation-support",
    evidence_id: "e"
  }), /pathway_step/);

  assert.throws(() => attachBoundedEffect(base, result, {
    parameter_id: "p",
    value_low: 0.1,
    value_high: 0.2,
    unit: "proportion",
    pathway_step: "recognition-to-referral",
    target_mechanism: "telehealth",
    evidence_id: "e"
  }), /target_mechanism/);
});

test("one-way sensitivity changes exactly the requested input", () => {
  const points: SensitivityPoint[] = oneWaySensitivity(base, "capacity", [1000, 3000, 5000]);
  assert.deepEqual(points.map(point => point.result.reached_participants), [1000, 3000, 3000]);
  assert.deepEqual(points.map(point => point.result.target_pathway_step), [
    base.target_pathway_step,
    base.target_pathway_step,
    base.target_pathway_step
  ]);
});
