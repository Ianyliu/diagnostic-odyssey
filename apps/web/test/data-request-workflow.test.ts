import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { validateScenario, type Scenario } from "@diagnostic-odyssey/contracts";
import { buildPlanningBrief, serializeBriefJson } from "@diagnostic-odyssey/brief-core";
import { calculateScenario, oneWaySensitivity } from "@diagnostic-odyssey/scenario-engine";
import { buildSensitivityValues } from "../src/data/decisionVisuals.ts";
import {
  createSensitivityDataRequest,
  getSensitivityDataRequestStatus,
  isDataRequestCurrentForScenario,
  sensitivityDataRequestId
} from "../src/data/dataRequestTemplates.ts";
import {
  staleSelectedDataRequestExclusionWarning,
  withStaleSelectedDataRequestWarning
} from "../src/data/briefDataRequestWarnings.ts";

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

test("sensitivity data-request templates are deterministic and preserve pathway step and mechanism", () => {
  const capacity = createSensitivityDataRequest(scenario, "capacity");
  assert.equal(capacity.request_id, "session.sensitivity.capacity");
  assert.equal(capacity.pathway_step, scenario.target_pathway_step);
  assert.equal(capacity.target_mechanism, scenario.mechanism);
  assert.match(capacity.target_question, /capacity/i);
  assert.match(capacity.rationale, /3,000/);
  assert.ok(capacity.fields_needed.some(field => /slots|capacity/i.test(field)));

  const reach = createSensitivityDataRequest(scenario, "reach");
  assert.equal(reach.request_id, sensitivityDataRequestId("reach"));
  assert.equal(reach.pathway_step, scenario.target_pathway_step);
  assert.equal(reach.target_mechanism, scenario.mechanism);
  assert.match(reach.rationale, /25%/);

  const window = createSensitivityDataRequest(scenario, "alternative_window_months");
  assert.equal(window.pathway_step, scenario.target_pathway_step);
  assert.equal(window.target_mechanism, scenario.mechanism);
  assert.match(window.rationale, /6-month/);
  assert.match(window.rationale, /12-month/);
  assert.match(window.feasibility_privacy_notes, /do not by themselves establish a causal/i);
});

test("analyst-created requests require explicit Planning Brief opt-in", () => {
  const context = readSource("../src/data/ArtifactContext.tsx");
  const requests = readSource("../src/pages/DataRequestsPage.tsx");
  const brief = readSource("../src/pages/BriefPage.tsx");
  const sensitivity = readSource("../src/components/SensitivityExplorer.tsx");

  assert.match(context, /briefDataRequestIds/);
  assert.match(context, /toggleDataRequestForBrief/);
  assert.match(context, /selectedDataRequests/);
  assert.match(requests, /Include in Planning Brief/);
  assert.match(requests, /Explicit opt-in/);
  assert.match(brief, /dataRequests:\s*selectedDataRequests/);
  assert.doesNotMatch(brief, /dataRequests:\s*bundle\.data_requests/);
  assert.match(sensitivity, /does not automatically include it in the Planning Brief/);
});


test("sensitivity requests become stale after relevant scenario values change and refresh to current", () => {
  const storedCapacity = createSensitivityDataRequest(scenario, "capacity");
  assert.equal(
    getSensitivityDataRequestStatus(scenario, "capacity", [storedCapacity]),
    "current"
  );
  assert.equal(isDataRequestCurrentForScenario(storedCapacity, scenario), true);

  const changedCapacity = {...scenario, capacity: 2400};
  assert.equal(
    getSensitivityDataRequestStatus(changedCapacity, "capacity", [storedCapacity]),
    "stale"
  );
  assert.equal(
    isDataRequestCurrentForScenario(storedCapacity, changedCapacity),
    false
  );

  const refreshed = createSensitivityDataRequest(changedCapacity, "capacity");
  assert.equal(
    getSensitivityDataRequestStatus(changedCapacity, "capacity", [refreshed]),
    "current"
  );
  assert.equal(isDataRequestCurrentForScenario(refreshed, changedCapacity), true);
});

test("planning-horizon changes make every sensitivity-derived request stale", () => {
  const fields = ["reach", "capacity", "alternative_window_months"] as const;
  const changedHorizon = {...scenario, horizon_months: 18};

  for (const field of fields) {
    const stored = createSensitivityDataRequest(scenario, field);
    assert.equal(
      getSensitivityDataRequestStatus(changedHorizon, field, [stored]),
      "stale"
    );
    assert.equal(isDataRequestCurrentForScenario(stored, changedHorizon), false);
  }
});

test("stale selected sensitivity requests are excluded from Brief/export until refreshed", () => {
  const context = readSource("../src/data/ArtifactContext.tsx");
  const requests = readSource("../src/pages/DataRequestsPage.tsx");
  const sensitivity = readSource("../src/components/SensitivityExplorer.tsx");
  const brief = readSource("../src/pages/BriefPage.tsx");
  const warnings = readSource("../src/data/briefDataRequestWarnings.ts");

  assert.match(context, /isDataRequestCurrentForScenario\(request, scenario\)/);
  assert.match(context, /\[availableDataRequests, briefDataRequestIds, scenario\]/);
  assert.match(sensitivity, /Refresh data request/);
  assert.match(requests, /Stale for applied scenario/);
  assert.match(requests, /Selected state is preserved/);
  assert.match(requests, /this stale request is excluded from export until refreshed/);
  assert.match(requests, /createSensitivityDataRequest\(scenario, sensitivityField\)/);
  assert.match(brief, /withStaleSelectedDataRequestWarning/);
  assert.match(warnings, /stale for the current scenario/);
});


test("mixed current and stale selected requests remain explicit in rendered and serialized Brief state", () => {
  const storedCapacity = createSensitivityDataRequest(scenario, "capacity");
  const storedReach = createSensitivityDataRequest(scenario, "reach");
  const selectedIds = [storedCapacity.request_id, storedReach.request_id];
  const changedScenario = {...scenario, capacity: 2400};
  const available = [storedCapacity, storedReach];

  const currentSelected = available.filter(
    request =>
      selectedIds.includes(request.request_id) &&
      isDataRequestCurrentForScenario(request, changedScenario)
  );
  const staleCount = selectedIds.length - currentSelected.length;

  assert.equal(staleCount, 1);
  assert.deepEqual(
    currentSelected.map(request => request.request_id),
    [storedReach.request_id]
  );

  const baseBrief = buildPlanningBrief({
    context: {
      condition_id: "long-covid",
      cohort_id: "test",
      age_range: "18–64",
      evidence_year: 2024,
      geography_scope: "United States",
      local_context_id: null,
      severity_filter: null,
      artifact_version: "test"
    },
    estimates: [],
    localContext: [],
    scenario: null,
    evidence: [],
    dataRequests: currentSelected,
    generatedAt: "2026-09-24T00:00:00Z"
  });
  const finalBrief = withStaleSelectedDataRequestWarning(baseBrief, staleCount);
  const warning = staleSelectedDataRequestExclusionWarning(staleCount);

  assert.equal(finalBrief.data_requests.length, 1);
  assert.equal(finalBrief.data_requests[0]?.request_id, storedReach.request_id);
  assert.ok(warning);
  assert.equal(finalBrief.warnings.filter(item => item === warning).length, 1);

  const serialized = JSON.parse(serializeBriefJson(finalBrief));
  assert.ok(serialized.warnings.includes(warning));

  const briefSource = readSource("../src/pages/BriefPage.tsx");
  assert.match(briefSource, /withStaleSelectedDataRequestWarning/);
  assert.match(briefSource, /brief\.warnings\.map/);
});

test("stale-selection warning helper does not duplicate an existing warning", () => {
  const warning = staleSelectedDataRequestExclusionWarning(1);
  assert.ok(warning);
  const baseBrief = buildPlanningBrief({
    context: {
      condition_id: "long-covid",
      cohort_id: "test",
      age_range: "18–64",
      evidence_year: 2024,
      geography_scope: "United States",
      local_context_id: null,
      severity_filter: null,
      artifact_version: "test"
    },
    estimates: [],
    localContext: [],
    scenario: null,
    evidence: [],
    dataRequests: [],
    generatedAt: "2026-09-24T00:00:00Z"
  });
  const once = withStaleSelectedDataRequestWarning(baseBrief, 1);
  const twice = withStaleSelectedDataRequestWarning(once, 1);
  assert.equal(twice.warnings.filter(item => item === warning).length, 1);
});


test("capacity request rationale stays conditional when the tested capacity range is flat", () => {
  const flatScenario = {...scenario, capacity: 10000};
  const values = buildSensitivityValues(flatScenario, "capacity");
  const points = oneWaySensitivity(flatScenario, "capacity", values);

  assert.ok(points.length > 0);
  assert.ok(points.every(point => point.result.capacity_gap === 0));

  const request = createSensitivityDataRequest(flatScenario, "capacity");
  assert.doesNotMatch(
    request.rationale,
    /sensitivity shows capacity directly changes/i
  );
  assert.match(request.rationale, /Capacity can constrain reached participants/i);
  assert.match(
    request.rationale,
    /when intended demand exceeds available capacity/i
  );
  assert.match(
    request.rationale,
    /local capacity should be verified before operational planning/i
  );
});


test("reach request freshness distinguishes exact assumptions that share the same rounded percent", () => {
  const original = {...scenario, reach: 0.251};
  const changed = {...scenario, reach: 0.254};
  const stored = createSensitivityDataRequest(original, "reach");

  assert.equal(stored.request_id, "session.sensitivity.reach");
  assert.match(stored.rationale, /25%/);
  assert.match(stored.rationale, /planning fraction 0\.251/);

  assert.equal(
    getSensitivityDataRequestStatus(original, "reach", [stored]),
    "current"
  );
  assert.equal(
    getSensitivityDataRequestStatus(changed, "reach", [stored]),
    "stale"
  );
  assert.equal(isDataRequestCurrentForScenario(stored, changed), false);

  const refreshed = createSensitivityDataRequest(changed, "reach");
  assert.match(refreshed.rationale, /planning fraction 0\.254/);
  assert.equal(
    getSensitivityDataRequestStatus(changed, "reach", [refreshed]),
    "current"
  );
  assert.equal(isDataRequestCurrentForScenario(refreshed, changed), true);
});


test("invalid scenarios fail closed for sensitivity-request currency and Brief eligibility", () => {
  const invalidScenario = {
    ...scenario,
    baseline_window_months: 6,
    alternative_window_months: 7
  };
  assert.ok(validateScenario(invalidScenario).length > 0);

  const storedCapacity = createSensitivityDataRequest(scenario, "capacity");
  const storedReach = createSensitivityDataRequest(scenario, "reach");

  for (const [field, stored] of [
    ["capacity", storedCapacity],
    ["reach", storedReach]
  ] as const) {
    assert.equal(
      getSensitivityDataRequestStatus(invalidScenario, field, [stored]),
      "stale"
    );
    assert.equal(
      isDataRequestCurrentForScenario(stored, invalidScenario),
      false
    );
  }

  const selectedIds = [storedCapacity.request_id, storedReach.request_id];
  const currentSelected = [storedCapacity, storedReach].filter(
    request =>
      selectedIds.includes(request.request_id) &&
      isDataRequestCurrentForScenario(request, invalidScenario)
  );
  assert.deepEqual(currentSelected, []);

  assert.equal(
    isDataRequestCurrentForScenario(storedCapacity, scenario),
    true
  );
  assert.equal(
    getSensitivityDataRequestStatus(scenario, "reach", [storedReach]),
    "current"
  );
});

test("DataRequestsPage blocks sensitivity-request refresh while scenario result is invalid", () => {
  const requests = readSource("../src/pages/DataRequestsPage.tsx");

  assert.match(requests, /scenarioResult/);
  assert.match(
    requests,
    /stale && sensitivityField && scenario && scenarioResult/
  );
    assert.match(
      requests,
      /Fix the Pilot planner inputs before refreshing this request\./
  );
  assert.match(
    requests,
    /stale && sensitivityField && scenario && !scenarioResult/
  );
});


test("sensitivity request freshness becomes stale when target mechanism differs", () => {
  const fields = ["reach", "capacity", "alternative_window_months"] as const;
  const changedMechanism = {...scenario, mechanism: "future-mechanism"};

  for (const field of fields) {
    const stored = createSensitivityDataRequest(scenario, field);
    assert.equal(stored.request_id, `session.sensitivity.${field}`);
    assert.equal(stored.pathway_step, scenario.target_pathway_step);
    assert.equal(stored.target_mechanism, scenario.mechanism);
    assert.equal(
      getSensitivityDataRequestStatus(changedMechanism, field, [stored]),
      "stale"
    );
    assert.equal(isDataRequestCurrentForScenario(stored, changedMechanism), false);
  }
});

test("Planning Brief and JSON preserve scenario and selected-request pathway trace", () => {
  const request = createSensitivityDataRequest(scenario, "reach");
  const result = calculateScenario(scenario);
  const built = buildPlanningBrief({
    context: {
      condition_id: "long-covid",
      cohort_id: "test",
      age_range: "18–64",
      evidence_year: 2024,
      geography_scope: "United States",
      local_context_id: null,
      severity_filter: null,
      artifact_version: "test"
    },
    estimates: [],
    localContext: [],
    scenario: {input: scenario, result},
    evidence: [],
    dataRequests: [request],
    generatedAt: "2026-09-24T00:00:00Z"
  });

  assert.equal(built.scenario?.input.target_pathway_step, scenario.target_pathway_step);
  assert.equal(built.scenario?.input.mechanism, scenario.mechanism);
  assert.equal(built.data_requests[0]?.pathway_step, scenario.target_pathway_step);
  assert.equal(built.data_requests[0]?.target_mechanism, scenario.mechanism);

  const serialized = JSON.parse(serializeBriefJson(built));
  assert.equal(serialized.scenario.input.target_pathway_step, scenario.target_pathway_step);
  assert.equal(serialized.scenario.input.mechanism, scenario.mechanism);
  assert.equal(serialized.data_requests[0].pathway_step, scenario.target_pathway_step);
  assert.equal(serialized.data_requests[0].target_mechanism, scenario.mechanism);

  const briefSource = readSource("../src/pages/BriefPage.tsx");
  assert.match(briefSource, /Modeled pathway step/);
  assert.match(briefSource, /Assumed mechanism/);
  assert.match(briefSource, /brief-request-trace/);
  assert.match(briefSource, /request\.target_mechanism/);
});
