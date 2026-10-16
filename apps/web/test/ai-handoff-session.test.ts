import assert from "node:assert/strict";
import test from "node:test";
import { buildPlanningBrief } from "@diagnostic-odyssey/brief-core";
import { calculateScenario } from "@diagnostic-odyssey/scenario-engine";
import { loadReviewedMepsArtifact } from "../src/data/reviewedArtifact.ts";
import { createPlanningScenarioDefaults } from "../src/data/planningScenarioDefaults.ts";
import { aiHandoffQuestionLength, inspectAiHandoffSource, type AiHandoffSourceState } from "../src/data/aiHandoffSession.ts";

function fixture() {
  const national = loadReviewedMepsArtifact();
  const scenario = createPlanningScenarioDefaults();
  const brief = structuredClone(buildPlanningBrief({context: national.context,
    estimates: national.burden_domains.flatMap(domain => domain.measures),
    scenario: {input: scenario, result: calculateScenario(scenario)}, evidence: national.evidence,
    localContext: [], dataRequests: [], generatedAt: "2026-10-15T12:00:00.000Z"}));
  const state: AiHandoffSourceState = {status: "loaded", localContextStatus: "loaded", localArtifactVersion: "reviewed-local",
    scenario, scenarioValid: true, selectedLocalContextIds: [], pilotLocalContextId: null, briefDataRequestIds: []};
  return {brief, state};
}

test("source identity ignores only the volatile composition timestamp and object key order", () => {
  const {brief, state} = fixture();
  const before = JSON.stringify(brief);
  const original = inspectAiHandoffSource(brief, state);
  assert.equal(original.problem, null);
  assert.equal(inspectAiHandoffSource({...brief, generated_at: "2026-10-16T12:00:00.000Z"}, state).key, original.key);
  assert.equal(inspectAiHandoffSource(Object.fromEntries(Object.entries(brief).reverse()) as typeof brief, state).key, original.key);
  assert.equal(JSON.stringify(brief), before);
  for (const changed of [
    {...brief, warnings: [...brief.warnings, "new scientific limitation"]},
    {...brief, burden_findings: brief.burden_findings.map((record, i) => i ? record : {...record, label: "Updated construct"})}
  ]) assert.notEqual(inspectAiHandoffSource(changed, state).key, original.key);
});

test("scenario inputs, local selections, pilot context, request IDs and readiness invalidate an otherwise identical payload", () => {
  const {brief, state} = fixture();
  const original = inspectAiHandoffSource(brief, state).key;
  for (const changed of [
    {...state, scenario: {...state.scenario!, capacity: state.scenario!.capacity + 1}},
    {...state, selectedLocalContextIds: ["selected-record"]},
    {...state, pilotLocalContextId: "pilot-record"},
    {...state, briefDataRequestIds: ["stale-request-1"]},
    {...state, localArtifactVersion: "new-local-release"},
    {...state, localContextStatus: "loading" as const}
  ]) assert.notEqual(inspectAiHandoffSource(brief, changed).key, original);
  assert.notEqual(inspectAiHandoffSource(brief, {...state, briefDataRequestIds: ["stale-1"]}).key,
    inspectAiHandoffSource(brief, {...state, briefDataRequestIds: ["stale-2"]}).key);
});

test("unavailable artifacts and invalid applied scenarios fail closed without throwing", () => {
  const {brief, state} = fixture();
  assert.match(inspectAiHandoffSource(null, state).problem!, /unavailable/);
  assert.match(inspectAiHandoffSource(brief, {...state, status: "error"}).problem!, /unavailable/);
  assert.match(inspectAiHandoffSource(brief, {...state, localContextStatus: "error"}).problem!, /readiness/);
  assert.match(inspectAiHandoffSource(brief, {...state, scenarioValid: false}).problem!, /scenario is invalid/);
  brief.artifact_version = "mismatched-source";
  assert.match(inspectAiHandoffSource(brief, state).problem!, /failed AI handoff validation/);
});

test("suppressed, unreleased and illustrative constructed findings never become exportable previews", () => {
  for (const release of ["suppressed", "unreleased", "illustrative"]) {
    const {brief, state} = fixture();
    Object.assign(brief.burden_findings[0]!, {release_status: release});
    assert.match(inspectAiHandoffSource(brief, state).problem!, /validation/);
  }
});

test("question limit counts trimmed Unicode code points without truncating astral characters", () => {
  assert.equal(aiHandoffQuestionLength(`  ${"🧬".repeat(2000)}  `), 2000);
  assert.equal(aiHandoffQuestionLength("🧬".repeat(2001)), 2001);
  assert.equal(aiHandoffQuestionLength("e\u0301"), 2);
});
