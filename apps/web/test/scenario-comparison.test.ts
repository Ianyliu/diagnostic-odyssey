import test from "node:test";
import assert from "node:assert/strict";
import { calculateScenario } from "@diagnostic-odyssey/scenario-engine";
import { buildPlanningBrief, serializeBriefJson } from "@diagnostic-odyssey/brief-core";
import { createPlanningScenarioDefaults, PILOT_STRATEGY_PRESETS } from "../src/data/planningScenarioDefaults.ts";
import { buildScenarioComparisonRows } from "../src/data/scenarioComparison.ts";
import type { AnalysisContext } from "@diagnostic-odyssey/contracts";

/** Minimal, fully typed context; only used to compare two serializations of the same Brief. */
const fixtureContext: AnalysisContext = {
  condition_id: "long-covid",
  cohort_id: "fixture-cohort",
  age_range: "all ages",
  evidence_year: 2024,
  geography_scope: "United States",
  local_context_id: null,
  severity_filter: null,
  artifact_version: "v1"
};

test("scenarioComparison computes canonical engine rows and identifies matching preset", () => {
  const defaults = createPlanningScenarioDefaults();
  const rows = buildScenarioComparisonRows(defaults);

  assert.equal(rows.length, PILOT_STRATEGY_PRESETS.length);
  const current = rows.find(row => row.isCurrent);
  assert.ok(current);
  assert.equal(current.id, "regional-navigation-program");
  assert.equal(current.deltaReached, 0);

  for (const row of rows) {
    assert.ok(row.result);
    assert.deepEqual(row.result, calculateScenario(row.scenario));
  }
});

test("scenarioComparison prepends custom active scenario row and computes signed deltas", () => {
  const custom = { ...createPlanningScenarioDefaults(), capacity: 2000 };
  const rows = buildScenarioComparisonRows(custom);

  assert.equal(rows.length, PILOT_STRATEGY_PRESETS.length + 1);
  assert.equal(rows[0]!.id, "current-applied");
  assert.equal(rows[0]!.isCurrent, true);
  assert.equal(rows[0]!.result?.reached_participants, 2000);
  assert.equal(rows[0]!.result?.capacity_gap, 1000);

  const regional = rows.find(row => row.id === "regional-navigation-program")!;
  assert.equal(regional.isCurrent, false);
  assert.equal(regional.deltaReached, 1000);
  assert.equal(regional.deltaGap, -1000);
});

test("scenarioComparison fails closed without throwing on overflowing finite inputs and never mutates Brief", () => {
  const baseline = createPlanningScenarioDefaults();
  const overflowed = { ...baseline, fixed_cost: Number.MAX_VALUE, per_participant_cost: Number.MAX_VALUE };
  const briefBefore = serializeBriefJson(buildPlanningBrief({
    context: fixtureContext,
    estimates: [],
    localContext: [],
    scenario: { input: baseline, result: calculateScenario(baseline) },
    evidence: [],
    dataRequests: []
  }));

  const rows = buildScenarioComparisonRows(overflowed);
  assert.equal(rows[0]!.id, "current-applied");
  assert.equal(rows[0]!.result, null);
  assert.ok(rows[0]!.error);

  const briefAfter = serializeBriefJson(buildPlanningBrief({
    context: fixtureContext,
    estimates: [],
    localContext: [],
    scenario: { input: baseline, result: calculateScenario(baseline) },
    evidence: [],
    dataRequests: []
  }));
  assert.equal(
    JSON.stringify({ ...JSON.parse(briefAfter), generated_at: null }),
    JSON.stringify({ ...JSON.parse(briefBefore), generated_at: null })
  );
});
