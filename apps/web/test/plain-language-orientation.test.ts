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

test("Overview keeps the workflow visual and narrative-led across four stages", () => {
  const source = readSource("../src/pages/OverviewPage.tsx");
  const journey = readSource("../src/components/LandingJourney.tsx");

  for (const phrase of [
    "What does chronic illness",
    "From data to",
    "Never blended",
    "National descriptive · Not causal"
  ]) {
    assert.ok(source.includes(phrase), phrase);
  }
  assert.match(source, /to="\/evidence"/);
  for (const label of ["Burden", "Local context", "Strategy Lab", "Data requests", "Planning Brief"]) {
    assert.ok(journey.includes(label), label);
  }
});

test("DecisionStateRail reuses the readable pathway formatter", () => {
  const source = readSource("../src/components/DecisionStateRail.tsx");
  assert.match(source, /formatPathwayStepLabel\(scenario\.target_pathway_step\)/);
  assert.ok(!source.includes("Target: ${scenario.target_pathway_step}"));
});

test("Local Context humanizes statuses and preserves interpretation boundaries in DetailDrawer", () => {
  const source = readSource("../src/pages/LocalContextPage.tsx");

  assert.match(source, /formatReleaseStatusLabel\(inspectRecord\.release_status\)/);
  assert.match(source, /formatDataStateLabel\(inspectRecord\.state\)/);
  assert.doesNotMatch(source, /<small>\{record\.release_status\} · \{record\.state\}<\/small>/);
  assert.match(source, /Access conditions, not prevalence/);
  assert.match(source, /<DetailDrawer/);
  assert.match(source, /Include in Brief/);
  assert.match(source, /Use in Strategy Lab/);
});

test("Pilot simulator keeps draft boundaries and opens pathway boundary in a drawer", () => {
  const source = readSource("../src/pages/PilotPage.tsx");

  assert.match(source, /Modeled pathway boundary/);
  assert.match(source, /<DetailDrawer/);
  assert.match(source, /Draft not applied/);
  assert.match(source, /last valid planning assumptions/);
  assert.match(source, /Sensitivity analysis paused/);
  assert.match(source, /disabled>Open Brief<\/button>/);
});

test("Evidence uses existing admissibility and current-scenario eligibility semantics", () => {
  const source = readSource("../src/pages/EvidencePage.tsx");
  assert.match(source, /evidenceClaimLabel\(record\)/);
  assert.match(source, /canDriveScenarioParameter\(record, scenario\)/);
  assert.match(source, /currentUse\?\.reason/);
  assert.match(source, /Absence of a reviewed effect parameter is not evidence that an intervention has no effect/);
  assert.match(source, /Return to Simulate/);
  assert.match(source, /Review Data Requests/);

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
