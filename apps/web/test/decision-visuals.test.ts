import assert from "node:assert/strict";
import test from "node:test";
import type { Scenario } from "@diagnostic-odyssey/contracts";
import { oneWaySensitivity } from "@diagnostic-odyssey/scenario-engine";
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


test("high-precision reach keeps the exact current value in values and evaluation", () => {
  const highPrecisionReach = 0.251234567;
  const highPrecisionScenario = {...scenario, reach: highPrecisionReach};
  const values = buildSensitivityValues(highPrecisionScenario, "reach");

  assert.ok(values.includes(highPrecisionReach));
  assert.equal(values.includes(0.251235), false);

  const currentValues = values.filter(
    value => Math.abs(value - highPrecisionReach) < 1e-9
  );
  assert.deepEqual(currentValues, [highPrecisionReach]);

  const points = oneWaySensitivity(
    highPrecisionScenario,
    "reach",
    values
  );
  const exactCurrentPoints = points.filter(
    point => point.input_value === highPrecisionReach
  );
  assert.equal(exactCurrentPoints.length, 1);
  assert.equal(exactCurrentPoints[0]?.input_value, 0.251234567);
  assert.equal(
    points.some(point => point.input_value === 0.251235),
    false
  );
});


test("near-zero reach preserves both exact current and zero boundary", () => {
  const currentReach = 0.0000004;
  const boundaryScenario = {
    ...scenario,
    eligible_population: 1_000_000_000,
    reach: currentReach
  };
  const values = buildSensitivityValues(boundaryScenario, "reach");

  assert.ok(values.includes(0));
  assert.ok(values.includes(currentReach));
  assert.notEqual(0, currentReach);
  assert.equal(values.filter(value => value === currentReach).length, 1);

  const points = oneWaySensitivity(boundaryScenario, "reach", values);
  assert.ok(points.some(point => point.input_value === 0));
  assert.ok(points.some(point => point.input_value === currentReach));
  assert.equal(
    points.filter(point => point.input_value === currentReach).length,
    1
  );
  assert.equal(
    points.find(point => point.input_value === 0)?.result.intended_reach,
    0
  );
  assert.equal(
    points.find(point => point.input_value === currentReach)?.result.intended_reach,
    400
  );
});

test("near-one reach preserves both exact current and one boundary", () => {
  const currentReach = 0.9999996;
  const boundaryScenario = {...scenario, reach: currentReach};
  const values = buildSensitivityValues(boundaryScenario, "reach");

  assert.ok(values.includes(currentReach));
  assert.ok(values.includes(1));
  assert.equal(values.filter(value => value === currentReach).length, 1);

  const points = oneWaySensitivity(boundaryScenario, "reach", values);
  assert.ok(points.some(point => point.input_value === currentReach));
  assert.ok(points.some(point => point.input_value === 1));
});

test("invalid sensitivity calculations are explicit without suppressing or replacing bad points", async () => {
  const {evaluateScenarioSensitivity} = await import("../src/data/decisionVisuals.ts");
  const overflowingNeighbor = {
    ...scenario, eligible_population: 100, capacity: 1, reach: 1,
    fixed_cost: 0, per_participant_cost: Number.MAX_VALUE
  };
  const evaluation = evaluateScenarioSensitivity(overflowingNeighbor, "capacity");
  assert.deepEqual(evaluation.points, []);
  assert.match(evaluation.error ?? "", /outside the supported numeric range/);
  const valid = evaluateScenarioSensitivity(scenario, "capacity");
  assert.equal(valid.error, null);
  assert.equal(valid.points.length, 5);
});

test("mechanical sensitivity range overflow rejects the range instead of clamping it", async () => {
  const {evaluateScenarioSensitivity} = await import("../src/data/decisionVisuals.ts");
  const hugeCapacity = {...scenario, capacity: Number.MAX_VALUE};
  assert.throws(() => buildSensitivityValues(hugeCapacity, "capacity"), {name: "InvalidScenarioResultError"});
  assert.match(evaluateScenarioSensitivity(hugeCapacity, "capacity").error ?? "", /Reduce/);
});
