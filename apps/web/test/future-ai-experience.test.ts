import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import test from "node:test";
import { buildPlanningBrief, serializeBriefJson, type PlanningBrief } from "@diagnostic-odyssey/brief-core";
import { calculateScenario } from "@diagnostic-odyssey/scenario-engine";
import { loadReviewedMepsArtifact } from "../src/data/reviewedArtifact.ts";
import { loadReviewedWvLocalContextArtifact } from "../src/data/reviewedLocalContext.ts";
import { createPlanningScenarioDefaults } from "../src/data/planningScenarioDefaults.ts";
import { projectConceptBrief } from "../src/concept/conceptBrief.ts";
import { goals, researchTargets, gapExamples, strategyOptions } from "../src/concept/storyboard.ts";

const source = loadReviewedMepsArtifact();
const local = loadReviewedWvLocalContextArtifact();
function makeBrief(): PlanningBrief {
  const input = createPlanningScenarioDefaults();
  return buildPlanningBrief({context: source.context, estimates: source.burden_domains.flatMap(domain => domain.measures),
    localContext: [], scenario: {input, result: calculateScenario(input)}, evidence: source.evidence, dataRequests: [], generatedAt: "2026-10-15T00:00:00Z"});
}
function project(brief = makeBrief()) { return projectConceptBrief(brief, source, local, "loaded"); }

test("concept projects three distinct source-identical released domains with provenance", () => {
  const result = project();
  assert.equal(result.highlights.length, 3);
  assert.equal(new Set(result.highlights.map(item => item.domain)).size, 3);
  for (const item of result.highlights) {
    assert.deepEqual(item.estimate, source.burden_domains.flatMap(domain => domain.measures).find(record => record.estimate_id === item.estimate.estimate_id));
    assert.deepEqual(item.source, source.sources.find(record => record.source_ref === item.estimate.source_ref));
    assert.equal(item.estimate.release_status, "reviewed_released");
  }
});

test("altered values, denominators, provenance or interpretation never become highlights", () => {
  for (const change of [
    (brief: PlanningBrief) => { brief.burden_findings.forEach(item => { item.value = 123; }); },
    (brief: PlanningBrief) => { brief.burden_findings.forEach(item => { item.denominator = "invented population"; }); },
    (brief: PlanningBrief) => { brief.burden_findings.forEach(item => { item.source_locator = "invented locator"; }); },
    (brief: PlanningBrief) => { brief.burden_findings.forEach(item => { item.limitations = []; }); }
  ]) {
    const brief = structuredClone(makeBrief()); change(brief);
    assert.deepEqual(project(brief).highlights, []);
  }
});

test("unreleased, suppressed and unfamiliar findings are excluded without substitutes", () => {
  for (const release of ["candidate", "suppressed", "unreviewed"] as const) {
    const brief = structuredClone(makeBrief());
    for (const finding of brief.burden_findings) Object.assign(finding, {release_status: release});
    assert.deepEqual(project(brief).highlights, []);
  }
  const brief = structuredClone(makeBrief());
  brief.burden_findings.forEach(item => { item.estimate_id = "unreleased-candidate-a"; });
  assert.deepEqual(project(brief).highlights, []);
});

test("national artifact, context and source-manifest mismatches fail closed", () => {
  const brief = structuredClone(makeBrief()); brief.artifact_version = "different-version";
  assert.deepEqual(project(brief).highlights, []);
  const context = structuredClone(makeBrief()); context.context.artifact_version = "different-version";
  assert.deepEqual(project(context).highlights, []);
  const missingSources = structuredClone(source); missingSources.sources = [];
  assert.deepEqual(projectConceptBrief(makeBrief(), missingSources, local, "loaded").highlights, []);
});

test("empty Brief findings stay empty rather than loading fallback fixture numbers", () => {
  const brief = makeBrief(); brief.burden_findings = [];
  assert.equal(project(brief).nationalStatus, "withheld");
  assert.deepEqual(project(brief).highlights, []);
});

test("reviewed local context remains unselected until explicitly supplied by the Brief", () => {
  assert.deepEqual(project().local, {status: "unselected", artifactVersion: null, records: []});
  const brief = makeBrief();
  brief.local_context = [local.indicators.find(record => record.state === "loaded")!];
  brief.context = {...brief.context, local_context_id: local.manifest.artifact_version};
  const result = project(brief);
  assert.equal(result.local.status, "selected");
  assert.deepEqual(result.local.records, brief.local_context);
});

test("altered or stale local selections are withheld; unavailable is distinct from unselected", () => {
  const brief = structuredClone(makeBrief());
  brief.local_context = [structuredClone(local.indicators.find(record => record.state === "loaded")!)];
  brief.context = {...brief.context, local_context_id: "old-version"};
  assert.equal(project(brief).local.status, "withheld");
  brief.context.local_context_id = local.manifest.artifact_version;
  brief.local_context[0]!.value = 123456;
  assert.deepEqual(project(brief).local.records, []);
  for (const status of ["loading", "error"] as const) assert.equal(projectConceptBrief(makeBrief(), source, local, status).local.status, "unavailable");
});

test("invalid or mismatched scenario/result pairs are withheld", () => {
  assert.deepEqual(project().scenario, makeBrief().scenario);
  const missing = makeBrief(); missing.scenario = null; assert.equal(project(missing).scenario, null);
  const invalid = makeBrief(); invalid.scenario!.result.reached_participants = Infinity; assert.equal(project(invalid).scenario, null);
  for (const key of ["scenario_id", "target_pathway_step", "target_mechanism"] as const) {
    const brief = makeBrief(); brief.scenario!.result[key] = "mismatch";
    assert.equal(project(brief).scenario, null);
  }
});

function deepFreeze(value: unknown) {
  if (value && typeof value === "object") { Object.freeze(value); Object.values(value).forEach(deepFreeze); }
}
test("projection never mutates source, analyst requests or canonical JSON and returns isolated copies", () => {
  const brief = makeBrief(); const before = serializeBriefJson(brief);
  deepFreeze(brief); deepFreeze(source); deepFreeze(local);
  const projected = project(brief);
  projected.highlights[0]!.estimate.label = "presentation-only edit";
  projected.scenario!.input.capacity = 1;
  assert.equal(serializeBriefJson(brief), before);
  assert.notEqual(brief.burden_findings[0]!.label, "presentation-only edit");
  assert.equal(brief.scenario!.input.capacity, createPlanningScenarioDefaults().capacity);
});

test("committed research fixtures have no publications, locations, quantitative claims or recommendations", () => {
  assert.equal(goals.length, 4); assert.equal(new Set(goals.map(goal => goal.id)).size, 4);
  assert.equal(researchTargets.length, 3); assert.equal(gapExamples.length, 3); assert.equal(strategyOptions.length, 3);
  researchTargets.forEach(topic => {
    assert.equal(topic.kind, "research_topic_not_recommendation");
    for (const value of [topic.citation, topic.doi, topic.pmcid, topic.source_url, topic.effectiveness, topic.cost_savings]) assert.equal(value, null);
    assert.equal(topic.source_status, "not_reviewed"); assert.equal(topic.applicability, "not_evaluated");
  });
  strategyOptions.forEach(option => { assert.equal(option.effectiveness, "not_established"); assert.equal(option.cost_effect, "not_established"); assert.equal(option.fit, "not_evaluated"); });
});

test("concept presentation has no provider, prompt, storage, export or analyst mutation capability", () => {
  const directory = new URL("../src/concept/", import.meta.url);
  const files = readdirSync(directory).filter(file => /\.tsx?$/.test(file));
  for (const file of files) {
    const content = readFileSync(new URL(file, directory), "utf8");
    assert.doesNotMatch(content, /\bfetch\s*\(|\b(XMLHttpRequest|WebSocket|EventSource|localStorage|sessionStorage|serializeBriefJson|upsertAnalystDataRequest|toggleDataRequestForBrief|setScenario|setLocalContextSelected|attachAcquisitionHint)\b/, file);
    assert.doesNotMatch(content, /<textarea|contentEditable|type=["']file/, file);
  }
});
