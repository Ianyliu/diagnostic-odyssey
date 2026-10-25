import assert from "node:assert/strict";
import test from "node:test";
import { buildDataRequestHandoff } from "../src/data/dataRequestHandoff.ts";
import { createSensitivityDataRequest } from "../src/data/dataRequestTemplates.ts";
import { createPlanningScenarioDefaults } from "../src/data/planningScenarioDefaults.ts";
import { buildPlanningBrief, serializeBriefJson } from "@diagnostic-odyssey/brief-core";
import { calculateScenario } from "@diagnostic-odyssey/scenario-engine";

const scenario = {...createPlanningScenarioDefaults(), reach: 0.251, alternative_window_months: 6.125};

test("each supported sensitivity request names an operational decision and exact applied inputs", () => {
  for (const field of ["capacity", "reach", "alternative_window_months"] as const) {
    const request = createSensitivityDataRequest(scenario, field);
    const model = buildDataRequestHandoff(request, scenario)!;
    assert.ok(model.decisionQuestion.endsWith("?"));
    assert.equal(model.current, true);
    assert.equal(model.appliedInputs.length, 8);
    assert.equal(model.appliedInputs.find(input => input.key === "reach")?.value, "25.1% (0.251)");
    assert.equal(model.appliedInputs.find(input => input.key === "alternative_window_months")?.value, "6.125 months");
    assert.equal(model.appliedInputs.find(input => input.key === "capacity")?.value, "3,000");
  }
});

test("stale or unavailable scenarios never relabel current inputs as the request's original assumptions", () => {
  const request = createSensitivityDataRequest(scenario, "capacity");
  for (const input of [null, {...scenario, capacity: 2000}, {...scenario, reach: 2}]) {
    const model = buildDataRequestHandoff(request, input)!;
    assert.equal(model.current, false);
    assert.deepEqual(model.appliedInputs, []);
    assert.match(request.rationale, /3,000/);
  }
  const changed = {...scenario, capacity: 2000};
  const refreshed = buildDataRequestHandoff(createSensitivityDataRequest(changed, "capacity"), changed)!;
  assert.equal(refreshed.current, true);
  assert.equal(refreshed.appliedInputs.find(input => input.key === "capacity")?.value, "2,000");
});

test("loaded or unsupported request IDs get no invented sensitivity trace", () => {
  const request = createSensitivityDataRequest(scenario, "capacity");
  for (const request_id of ["loaded.capacity", "session.sensitivity.future"]) {
    assert.equal(buildDataRequestHandoff({...request, request_id}, scenario), null);
  }
});

test("presentation does not change request, scenario, selection or canonical serialization", () => {
  const request = createSensitivityDataRequest(scenario, "capacity");
  const snapshot = structuredClone({request, scenario});
  const brief = buildPlanningBrief({
    context: {condition_id: "long-covid", cohort_id: "test", age_range: "18–64", evidence_year: 2024,
      geography_scope: "United States", local_context_id: null, severity_filter: null, artifact_version: "test"},
    estimates: [], localContext: [], scenario: {input: scenario, result: calculateScenario(scenario)}, evidence: [], dataRequests: [request],
    generatedAt: "2026-10-25T15:00:00Z"
  });
  const before = serializeBriefJson(brief);
  const model = buildDataRequestHandoff(request, scenario)!;
  model.appliedInputs[0].value = "presentation-only edit";
  assert.deepEqual({request, scenario}, snapshot);
  assert.equal(serializeBriefJson(brief), before);
  assert.equal(brief.data_requests.length, 1);
  assert.equal(Object.hasOwn(brief.data_requests[0], "appliedInputs"), false);
});
