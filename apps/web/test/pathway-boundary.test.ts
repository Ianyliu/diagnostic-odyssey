import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";
import type { Scenario } from "@diagnostic-odyssey/contracts";
import {
  formatMechanismLabel,
  formatPathwayStepLabel,
  getPathwayBoundaryPresentation,
  humanizeBoundaryId
} from "../src/data/pathwayBoundary.ts";

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

const readSource = (path: string) =>
  readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8");

test("pathway boundary helper derives readable labels from authoritative Scenario ids", () => {
  const model = getPathwayBoundaryPresentation(scenario);

  assert.equal(model.pathwayStepId, "recognition-to-referral");
  assert.equal(model.pathwayStepLabel, "Recognition → referral");
  assert.equal(model.mechanismId, "navigation-support");
  assert.equal(model.mechanismLabel, "Navigation support");
  assert.match(model.assumptionBoundaryStatement, /apply only within this modeled step and mechanism/i);
  assert.deepEqual(model.outsideModelItems, [
    "Reviewed national burden estimates",
    "Unrelated care-pathway stages",
    "Treatment effectiveness",
    "Clinical outcomes"
  ]);
});

test("pathway boundary helper has deterministic readable fallback for unknown ids", () => {
  assert.equal(formatPathwayStepLabel("future-care-step"), "Future care step");
  assert.equal(formatMechanismLabel("new_support-model"), "New support model");
  assert.equal(humanizeBoundaryId(""), "Not specified");
});

test("Pilot renders the committed Scenario boundary beside assumptions with descriptive follow-up links", () => {
  const pilot = readSource("../src/pages/PilotPage.tsx");
  const assumptionsIndex = pilot.indexOf("<h2>Planning assumptions</h2>");
  const boundaryIndex = pilot.indexOf("Modeled pathway boundary");
  const resultsIndex = pilot.indexOf("Baseline vs recognition/");

  assert.ok(assumptionsIndex >= 0);
  assert.ok(boundaryIndex > assumptionsIndex);
  assert.ok(resultsIndex >= 0 && resultsIndex < assumptionsIndex, "mobile summary precedes editable assumptions");
  assert.match(pilot, /Target step/);
  assert.match(pilot, /Assumed mechanism/);
  assert.match(pilot, /Outside this model:/);
  assert.match(pilot, /Stress-test these assumptions/);
  assert.match(pilot, /to="\/pilot#sensitivity"/);
  assert.match(pilot, /Review evidence limits/);
  assert.match(pilot, /to="\/evidence"/);
  assert.doesNotMatch(pilot, /select[^>]*(pathway|mechanism)/i);
  assert.doesNotMatch(pilot, /target-box/);
  assert.match(pilot, /not a prediction or causal ROI estimate/i);
});

test("Data Requests renders mechanism only when the request carries it", () => {
  const source = readSource("../src/pages/DataRequestsPage.tsx");
  assert.match(source, /formatPathwayStepLabel\(request\.pathway_step\)/);
  assert.match(source, /request\.target_mechanism &&/);
  assert.match(source, /Target mechanism/);
  assert.match(source, /formatMechanismLabel\(request\.target_mechanism\)/);
});

test("Planning Brief explicitly renders scenario and selected-request boundary trace", () => {
  const source = readSource("../src/pages/BriefPage.tsx");
  assert.match(source, /getPathwayBoundaryPresentation\(brief\.scenario\.input\)/);
  assert.match(source, /Modeled pathway step/);
  assert.match(source, /Assumed mechanism/);
  assert.match(source, /Outside this model:/);
  assert.match(source, /Pathway:/);
  assert.match(source, /Mechanism:/);
  assert.match(source, /not observed evidence/i);
});
