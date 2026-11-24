import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  dataStates,
  releaseStatuses,
  type EvidenceRecord
} from "@diagnostic-odyssey/contracts";
import {
  canDriveScenarioParameter,
  evidenceClaimLabel
} from "@diagnostic-odyssey/evidence-core";
import {
  formatDataStateLabel,
  formatReleaseStatusLabel
} from "../src/data/presentationLabels.ts";

const readSource = (path: string) =>
  readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8");

test("presentation labels cover every current DataState and ReleaseStatus without raw tokens", () => {
  const expectedData = new Map([
    ["loading", "Loading"],
    ["loaded", "Available"],
    ["partial", "Partially available"],
    ["empty", "No data available"],
    ["suppressed", "Suppressed"],
    ["error", "Unavailable"],
    ["stale_fallback", "Older fallback data"],
    ["unsupported_combination", "Not supported for this combination"]
  ]);
  const expectedRelease = new Map([
    ["preliminary", "Preliminary — not released"],
    ["reviewed_released", "Reviewed and released"],
    ["not_released", "Not released"],
    ["suppressed", "Suppressed"],
    ["unavailable", "Unavailable"]
  ]);

  assert.deepEqual([...dataStates], [...expectedData.keys()]);
  assert.deepEqual([...releaseStatuses], [...expectedRelease.keys()]);

  for (const state of dataStates) {
    const label = formatDataStateLabel(state);
    assert.equal(label, expectedData.get(state));
    assert.doesNotMatch(label, /_/);
  }
  for (const status of releaseStatuses) {
    const label = formatReleaseStatusLabel(status);
    assert.equal(label, expectedRelease.get(status));
    assert.doesNotMatch(label, /_/);
  }
});

test("Overview presents Apple-concise copy with explicit edition and boundary labels", () => {
  const source = readSource("../src/pages/OverviewPage.tsx");

  for (const phrase of [
    "Edition 01 · Long COVID · West Virginia",
    "Health costs, finally clear.",
    "Start Exploring",
    "Try Simulator",
    "National descriptive · Not causal",
    "Planning math · Not savings",
    "Zero cross-condition borrowing"
  ]) {
    assert.ok(source.includes(phrase), phrase);
  }
});

test("DecisionStateRail reuses the readable pathway formatter", () => {
  const source = readSource("../src/components/DecisionStateRail.tsx");
  assert.match(source, /formatPathwayStepLabel\(scenario\.target_pathway_step\)/);
  assert.ok(!source.includes("Target: ${scenario.target_pathway_step}"));
});

test("Local Context humanizes statuses and preserves interpretation boundaries", () => {
  const source = readSource("../src/pages/LocalContextPage.tsx");

  assert.match(source, /formatReleaseStatusLabel\(inspectingRecord\.release_status\)/);
  assert.match(source, /formatDataStateLabel\(inspectingRecord\.state\)/);
  assert.doesNotMatch(source, /<small>\{record\.release_status\} · \{record\.state\}<\/small>/);
  assert.match(source, /Missing data does not mean zero constraint/);
  assert.match(source, /HPSA counts describe designations, not patients or clinicians/);
  assert.match(source, /Include in Planning Brief/);
});

test("Pilot interpretation describes planning arithmetic cleanly", () => {
  const source = readSource("../src/pages/PilotPage.tsx");

  assert.match(source, /Planning math · Not savings or ROI/);
  assert.match(source, /Draft not applied/);
  assert.match(source, /Sensitivity analysis paused/);
  assert.match(source, /disabled>Review planning brief<\/button>/);
});

test("Evidence uses existing admissibility and current-scenario eligibility semantics", () => {
  const source = readSource("../src/pages/EvidencePage.tsx");
  assert.match(source, /evidenceClaimLabel\(record\)/);
  assert.match(source, /canDriveScenarioParameter\(record, scenario\)/);
  assert.match(source, /Absence of a reviewed parameter is not evidence of no effect/);
  assert.match(source, /Return to Simulator/);
  assert.match(source, /Review data requests/);

  const base: EvidenceRecord = {
    evidence_id: "test",
    source: "Test source",
    locator: "test",
    population: "Test population",
    condition_definition: "Test definition",
    outcome: "Test outcome",
    effect_or_parameter: null,
    uncertainty: null,
    system_boundary: "Test boundary",
    pathway_step: "recognition-to-referral",
    target_mechanism: "navigation-support",
    geography: "United States",
    payer: "all",
    year: 2026,
    limitations: ["Test limitation."],
    reviewer_status: "approved",
    admissibility_status: "supported",
    allowed_use: "Test use"
  };

  const expected = new Map([
    ["supported", "Supported"],
    ["supported_with_bounds", "Supported with bounds"],
    ["limited_use", "Limited use"],
    ["insufficient", "Insufficient evidence"]
  ] as const);

  for (const [status, label] of expected) {
    assert.equal(evidenceClaimLabel({...base, admissibility_status: status}), label);
  }

  const scenario = {
    scenario_id: "test",
    eligible_population: 100,
    reach: 0.5,
    capacity: 50,
    baseline_window_months: 12,
    alternative_window_months: 6,
    horizon_months: 12,
    fixed_cost: 1,
    per_participant_cost: 1,
    target_pathway_step: "recognition-to-referral",
    mechanism: "navigation-support",
    assumption_refs: [],
    artifact_version: "test"
  };

  assert.equal(canDriveScenarioParameter(base, scenario).allowed, true);
  assert.equal(
    canDriveScenarioParameter({...base, admissibility_status: "limited_use"}, scenario).allowed,
    false
  );
});
