import assert from "node:assert/strict";
import test from "node:test";
import type { Scenario } from "@diagnostic-odyssey/contracts";
import { buildSensitivityValues } from "../src/data/decisionVisuals.ts";

const scenario: Scenario = {
  scenario_id: "test",
  eligible_population: 12000,
  reach: 0.25,
  capacity: 3000,
  baseline_window_months: 12,
  alternative_window_months: 6,
  horizon_months: 12,
  fixed_cost: 300000,
  per_participant_cost: 300,
  target_pathway_step: "recognition-to-referral",
  mechanism: "navigation-support",
  assumption_refs: [],
  artifact_version: "test"
};

test("reach sensitivity is bounded and includes the current assumption", () => {
  const values = buildSensitivityValues(scenario, "reach");
  assert.deepEqual(values, [0.15, 0.2, 0.25, 0.3, 0.35]);
  assert.ok(values.every(value => value >= 0 && value <= 1));
});

test("capacity sensitivity uses a mechanical range around the current assumption", () => {
  assert.deepEqual(
    buildSensitivityValues(scenario, "capacity"),
    [1500, 2250, 3000, 3750, 4500]
  );
});

test("recognition-window sensitivity stays within baseline window", () => {
  const values = buildSensitivityValues(scenario, "alternative_window_months");
  assert.deepEqual(values, [4, 5, 6, 7, 8]);
  assert.ok(values.every(value => value >= 0 && value <= scenario.baseline_window_months));
});


test("capacity sensitivity keeps zero/current capacity when intended reach is positive", () => {
  const zeroCapacityScenario = {...scenario, capacity: 0};
  const values = buildSensitivityValues(zeroCapacityScenario, "capacity");

  assert.deepEqual(values, [0, 1500, 2250, 3000, 3750, 4500]);
  assert.ok(values.includes(zeroCapacityScenario.capacity));
});
