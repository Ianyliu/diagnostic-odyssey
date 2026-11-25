import test from "node:test";
import assert from "node:assert/strict";
import { calculateScenario } from "@diagnostic-odyssey/scenario-engine";
import { createPlanningScenarioDefaults, PILOT_STRATEGY_PRESETS } from "../src/data/planningScenarioDefaults.ts";
import { buildScenarioComparisonRows } from "../src/data/scenarioComparison.ts";
import { buildCapacityThresholdCurve, buildCapacityThresholdCurveResult } from "../src/data/capacityThresholdCurve.ts";
import { formatPlanningPercent } from "../src/data/planningNumberFormatting.ts";

test("WS5 comparison rows deep-clone and freeze scenarios/results across mutations (SA-08)", () => {
  const custom = createPlanningScenarioDefaults();
  custom.capacity = 2700;
  const rows = buildScenarioComparisonRows(custom);

  assert.equal(Object.isFrozen(rows), true);
  assert.notEqual(rows[0]!.scenario, custom);
  assert.notEqual(rows[1]!.scenario.assumption_refs, custom.assumption_refs);
  assert.equal(Object.isFrozen(rows[0]!.scenario), true);
  assert.equal(Object.isFrozen(rows[0]!.scenario.assumption_refs), true);
  assert.equal(Object.isFrozen(rows[1]!.scenario.assumption_refs), true);
  if (rows[0]!.result) assert.equal(Object.isFrozen(rows[0]!.result), true);

  custom.capacity = 1;
  assert.equal(rows[0]!.scenario.capacity, 2700);
  assert.equal(rows.length, PILOT_STRATEGY_PRESETS.length + 1);
});

test("WS5 reach percent formatting preserves fractional precision instead of rounding 0.1% to 0%", () => {
  assert.equal(formatPlanningPercent(0.001), "0.1%");
  assert.equal(formatPlanningPercent(0.25), "25%");
  assert.equal(formatPlanningPercent(0.49), "49%");
  assert.equal(formatPlanningPercent(0.0005), "0.05%");
});

test("WS5 threshold curve models effective integer slots matching scenario-engine rounding (SA-09)", () => {
  const scenario = { ...createPlanningScenarioDefaults(), eligible_population: 3, reach: 0.49, capacity: 0.5 };
  const engine = calculateScenario(scenario);
  assert.equal(engine.intended_reach, 1);
  assert.equal(engine.reached_participants, 1);
  assert.equal(engine.capacity_gap, 0);

  const res = buildCapacityThresholdCurveResult(scenario);
  assert.equal(res.status, "available");
  if (res.status !== "available") return;
  const c = res.curve;
  assert.equal(c.rawCurrentCapacity, 0.5);
  assert.equal(c.currentCapacity, 1);
  assert.equal(c.breakEvenCapacity, 1);
  assert.equal(c.firstSufficientRawCapacity, 0.5);
  assert.equal(c.hasFractionalRounding, true);
  assert.equal(c.currentReached, 1);
  assert.equal(c.currentGap, 0);
  assert.ok(c.maxCapacity <= 10, `small scenario should not inflate to 100: ${c.maxCapacity}`);

  const exactActive = c.points.find(p => p.isCurrent);
  const exactBreakEven = c.points.find(p => p.isBreakEven);
  assert.ok(exactActive && exactBreakEven);
  assert.equal(exactActive.capacity, 1);
  assert.equal(exactActive.capacityGap, 0);
  assert.equal(buildCapacityThresholdCurve({ ...scenario, reach: 0, capacity: 0 }), null);
  assert.equal(buildCapacityThresholdCurveResult({ ...scenario, reach: 0, capacity: 0 }).status, "unavailable");
  assert.equal(buildCapacityThresholdCurveResult({ ...scenario, capacity: Number.MAX_VALUE }).status, "unavailable");
});
