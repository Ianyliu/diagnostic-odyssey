import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";
import type { Scenario } from "@diagnostic-odyssey/contracts";
import { calculateScenario } from "@diagnostic-odyssey/scenario-engine";
import {
  formatRecognitionWindowDifference,
  getCapacityCoveragePresentation
} from "../src/data/pilotDecisionPresentation.ts";

const baseScenario: Scenario = {
  scenario_id: "coverage-test",
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

const visualSource = readFileSync(
  fileURLToPath(new URL("../src/components/PilotDecisionVisuals.tsx", import.meta.url)),
  "utf8"
);

test("zero reach with positive eligible population renders no-demand capacity coverage", () => {
  const result = calculateScenario({...baseScenario, reach: 0});
  const presentation = getCapacityCoveragePresentation(result);

  assert.equal(result.intended_reach, 0);
  assert.equal(result.capacity_gap, 0);
  assert.equal(presentation.headline, "N/A");
  assert.equal(presentation.coveragePercent, null);
  assert.match(presentation.noDemandCopy ?? "", /No intended participants/i);
  assert.match(presentation.ariaLabel, /No intended participants/i);
  assert.match(presentation.ariaLabel, /capacity gap 0/i);
  assert.doesNotMatch(presentation.ariaLabel, /0 of 0|0% coverage/i);
});

test("zero eligible population renders no-demand capacity coverage", () => {
  const result = calculateScenario({...baseScenario, eligible_population: 0});
  const presentation = getCapacityCoveragePresentation(result);

  assert.equal(result.intended_reach, 0);
  assert.equal(result.capacity_gap, 0);
  assert.equal(presentation.headline, "N/A");
  assert.equal(presentation.coveragePercent, null);
  assert.match(presentation.ariaLabel, /No intended participants/i);
});

test("positive intended reach retains ordinary numeric capacity coverage", () => {
  const result = calculateScenario({...baseScenario, capacity: 1500});
  const presentation = getCapacityCoveragePresentation(result);

  assert.equal(result.intended_reach, 3000);
  assert.equal(result.reached_participants, 1500);
  assert.equal(result.capacity_gap, 1500);
  assert.equal(presentation.coveragePercent, 50);
  assert.equal(presentation.headline, "50%");
  assert.match(presentation.ariaLabel, /1,500 of 3,000 intended participants/i);
});

test("PilotDecisionVisuals renders the capacity presentation instead of a hard-coded zero-demand percentage", () => {
  assert.match(visualSource, /capacityCoverage\.headline/);
  assert.match(visualSource, /capacityCoverage\.ariaLabel/);
  assert.match(visualSource, /capacityCoverage\.coveragePercent \?\? 0/);
  assert.match(visualSource, /capacityCoverage\.noDemandCopy/);
  assert.doesNotMatch(visualSource, /coverage\.toFixed\(0\)/);
});


test("recognition-window difference formatting hides floating-point artifacts", () => {
  assert.equal(formatRecognitionWindowDifference(6.2, 5.1), "1.1");
  assert.equal(formatRecognitionWindowDifference(12, 6), "6");
});

test("PilotDecisionVisuals uses the recognition-window display formatter", () => {
  assert.match(visualSource, /formatRecognitionWindowDifference/);
  assert.doesNotMatch(
    visualSource,
    /scenario\.baseline_window_months - scenario\.alternative_window_months/
  );
});
