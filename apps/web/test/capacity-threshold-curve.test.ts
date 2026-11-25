import test from "node:test";
import assert from "node:assert/strict";
import { calculateScenario } from "@diagnostic-odyssey/scenario-engine";
import { createPlanningScenarioDefaults } from "../src/data/planningScenarioDefaults.ts";
import { buildCapacityThresholdCurve } from "../src/data/capacityThresholdCurve.ts";

test("capacityThresholdCurve plots canonical engine values and hits zero gap at break-even", () => {
  const scenario = { ...createPlanningScenarioDefaults(), capacity: 1800 };
  const curve = buildCapacityThresholdCurve(scenario);
  assert.ok(curve);
  assert.equal(curve.intendedReach, 3000);
  assert.equal(curve.breakEvenCapacity, 3000);
  assert.equal(curve.currentCapacity, 1800);
  assert.equal(curve.currentReached, 1800);
  assert.equal(curve.currentGap, 1200);

  const breakEvenPoint = curve.points.find(p => p.isBreakEven);
  assert.ok(breakEvenPoint);
  assert.equal(breakEvenPoint.capacityGap, 0);
  assert.equal(breakEvenPoint.reachedParticipants, 3000);

  for (const point of curve.points) {
    const exact = calculateScenario({ ...scenario, capacity: point.capacity });
    assert.equal(point.reachedParticipants, exact.reached_participants);
    assert.equal(point.capacityGap, exact.capacity_gap);
  }
});

test("capacityThresholdCurve handles zero intended reach when positive capacity exists", () => {
  const zeroReach = { ...createPlanningScenarioDefaults(), reach: 0, capacity: 1000 };
  const curve = buildCapacityThresholdCurve(zeroReach);
  assert.ok(curve);
  assert.equal(curve.breakEvenCapacity, 0);
  assert.equal(curve.currentGap, 0);
  assert.equal(curve.currentReached, 0);
});

test("capacityThresholdCurve fails closed on extreme finite overflow and zero-span inputs", () => {
  const defaults = createPlanningScenarioDefaults();
  assert.equal(buildCapacityThresholdCurve({ ...defaults, capacity: Number.MAX_VALUE }), null);
  assert.equal(buildCapacityThresholdCurve({ ...defaults, eligible_population: Number.MAX_VALUE }), null);
  assert.equal(buildCapacityThresholdCurve({ ...defaults, reach: 0, capacity: 0 }), null);
});
