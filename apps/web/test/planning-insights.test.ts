import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { buildPlanningBrief, serializeBriefJson } from "@diagnostic-odyssey/brief-core";
import { calculateScenario } from "@diagnostic-odyssey/scenario-engine";
import { buildPlanningInsights, type PlanningInsightsSources } from "../src/data/planningInsights.ts";
import { loadReviewedMepsArtifact } from "../src/data/reviewedArtifact.ts";
import { loadReviewedWvLocalContextArtifact } from "../src/data/reviewedLocalContext.ts";
import { createPlanningScenarioDefaults } from "../src/data/planningScenarioDefaults.ts";
import { createSensitivityDataRequest } from "../src/data/dataRequestTemplates.ts";
import type { LocalContextRecord, Scenario } from "@diagnostic-odyssey/contracts";

function fixture(scenario: Scenario | null = createPlanningScenarioDefaults(), selected: LocalContextRecord[] = []) {
  const national = structuredClone(loadReviewedMepsArtifact());
  const local = structuredClone(loadReviewedWvLocalContextArtifact());
  const brief = buildPlanningBrief({
    context: {...national.context, local_context_id: selected.length ? local.manifest.artifact_version : null},
    estimates: national.burden_domains.flatMap(domain => domain.measures),
    localContext: selected, scenario: scenario ? {input: scenario, result: calculateScenario(scenario)} : null,
    evidence: national.evidence, dataRequests: [], generatedAt: "2026-10-14T00:00:00.000Z"
  });
  const sources: PlanningInsightsSources = {national, local, localStatus: "loaded", availableDataRequests: []};
  return {brief, sources};
}

test("insights are deterministic, detached, and leave canonical Brief and trusted sources unchanged", () => {
  const {brief, sources} = fixture();
  const before = JSON.stringify({brief, sources});
  const exported = serializeBriefJson(brief);
  const first = buildPlanningInsights(brief, sources);
  assert.deepEqual(first, buildPlanningInsights({...brief, generated_at: "2026-10-15T00:00:00.000Z"}, sources));
  assert.equal(first.national.findingsCount, 21);
  assert.equal(first.national.highlights.length, 3);
  assert.equal(first.national.highlights.find(row => row.domainId === "mental-human")?.estimate.estimate_id, "meps24-k6-serious-distress");
  assert.equal(first.interventions.availability, "unavailable");
  assert.equal(first.investigations.prompts.length, 3);
  first.national.highlights[0].estimate.value = -1;
  first.scenario.applied!.input.capacity = -1;
  first.investigations.prompts[0].request.fields_needed.push("synthetic mutation");
  assert.equal(JSON.stringify({brief, sources}), before);
  assert.equal(serializeBriefJson(brief), exported);
  assert.equal(brief.data_requests.length, 0);
});

test("highlights use validated available domains with deterministic fallbacks, never magnitude ranking", () => {
  const {brief, sources} = fixture();
  const withDistributions = buildPlanningInsights(brief, sources);
  assert.ok(withDistributions.national.highlights[0].estimate.distribution_summary);
  const preferredIds = new Set(withDistributions.national.highlights.map(row => row.estimate.estimate_id));
  brief.burden_findings = brief.burden_findings.filter(record => !preferredIds.has(record.estimate_id));
  const fallback = buildPlanningInsights(brief, sources);
  assert.equal(fallback.national.highlights.length, 3);
  assert.ok(fallback.national.highlights.every(row => !preferredIds.has(row.estimate.estimate_id)));
  const lastDomain = sources.national.burden_domains.at(-1)!;
  brief.burden_findings = brief.burden_findings.filter(record => lastDomain.measures.some(item => item.estimate_id === record.estimate_id));
  assert.equal(buildPlanningInsights(brief, sources).national.highlights.length, 1);
  brief.burden_findings = [];
  const empty = buildPlanningInsights(brief, sources);
  assert.equal(empty.national.availability, "withheld");
  assert.equal(empty.national.highlights.length, 0);
  assert.ok(empty.scenario.applied);
});

test("Pilot changes copy current deterministic outputs and only modeled capacity gaps affect prompt ordering", () => {
  for (const capacity of [0, 2000, 3000, 5000]) {
    const input = {...createPlanningScenarioDefaults(), capacity};
    const {brief, sources} = fixture(input);
    const model = buildPlanningInsights(brief, sources);
    assert.deepEqual(model.scenario.applied?.result, calculateScenario(input));
    assert.equal(model.investigations.capacitySignal, capacity < 3000);
    assert.equal(model.investigations.prompts[0].field, "capacity");
    assert.match(model.investigations.explanation, capacity < 3000 ? /not an empirical priority/ : /not.*priority|No empirically established priority/);
  }
  const {brief, sources} = fixture();
  sources.templateFields = ["alternative_window_months", "reach"];
  assert.deepEqual(buildPlanningInsights(brief, sources).investigations.prompts.map(row => row.field), sources.templateFields);
  assert.equal(buildPlanningInsights(brief, sources).investigations.capacitySignal, false);
});

test("explicit local selections retain source, native uncertainty and compatibility; absence is not local burden", () => {
  const selected = loadReviewedWvLocalContextArtifact().indicators.filter(record => record.indicator_id === "wv.acs.uninsured_pct");
  const {brief, sources} = fixture(undefined, selected);
  const model = buildPlanningInsights(brief, sources);
  assert.equal(model.local.availability, "available");
  assert.deepEqual(model.local.records, selected);
  assert.match(model.local.explanation, /do not rescale national burden/);
  brief.context.local_context_id = "stale-local-version";
  assert.equal(buildPlanningInsights(brief, sources).local.availability, "withheld");
  assert.equal(buildPlanningInsights(brief, sources).local.records.length, 0);
  assert.equal(buildPlanningInsights(fixture().brief, sources).local.availability, "unselected");
  for (const localStatus of ["loading", "error"] as const) {
    assert.equal(buildPlanningInsights(brief, {...sources, localStatus}).local.availability, "unavailable");
  }
  sources.local!.manifest.artifact_version = "unknown-local-version";
  assert.equal(buildPlanningInsights(brief, sources).local.availability, "withheld");
});

test("unreleased, suppressed, illustrative, invalid, forged and mismatched findings cannot leak into highlights", () => {
  const {brief, sources} = fixture();
  for (const state of ["preliminary", "not_released", "suppressed", "unavailable"] as const) {
    const candidate = structuredClone(brief);
    candidate.burden_findings = [{...candidate.burden_findings[0], release_status: state, label: "SENTINEL UNRELEASED"}];
    assert.equal(buildPlanningInsights(candidate, sources).national.highlights.length, 0);
    assert.doesNotMatch(JSON.stringify(buildPlanningInsights(candidate, sources)), /SENTINEL UNRELEASED/);
  }
  for (const changed of [
    {...brief.burden_findings[0], value: Number.NaN},
    {...brief.burden_findings[0], value: 1234567},
    {...brief.burden_findings[0], display_status: "illustrative" as const},
    {...brief.burden_findings[0], source_ref: "fabricated-source"},
    {...brief.burden_findings[0], artifact_version: "candidate"},
    {...brief.burden_findings[0], estimate_id: "u09_linked_service_use_person_share"}
  ]) assert.equal(buildPlanningInsights({...brief, burden_findings: [changed]}, sources).national.highlights.length, 0);
  const stale = buildPlanningInsights({...brief, artifact_version: "unknown-main-version"}, sources);
  assert.equal(stale.national.availability, "withheld");
  assert.ok(stale.scenario.applied);
});

test("unreleased, suppressed, invalid and changed selected local records are withheld independently", () => {
  const selected = loadReviewedWvLocalContextArtifact().indicators.filter(record => record.indicator_id === "wv.acs.uninsured_pct");
  const {brief, sources} = fixture(undefined, selected);
  for (const changed of [
    {...selected[0], release_status: "preliminary" as const},
    {...selected[0], state: "suppressed" as const},
    {...selected[0], value: Number.NaN},
    {...selected[0], source_ref: "unreleased-source"}
  ]) {
    const model = buildPlanningInsights({...brief, local_context: [changed]}, sources);
    assert.equal(model.local.records.length, 0);
    assert.equal(model.local.availability, "withheld");
    assert.equal(model.national.findingsCount, 21);
    assert.doesNotMatch(JSON.stringify(model), /unreleased-source/);
  }
});

test("every highlighted number and citation is copied from its authoritative reviewed record", () => {
  const {brief, sources} = fixture();
  for (const row of buildPlanningInsights(brief, sources).national.highlights) {
    assert.deepEqual(row.estimate, brief.burden_findings.find(record => record.estimate_id === row.estimate.estimate_id));
    assert.deepEqual(row.source, sources.national.sources.find(source => source.source_ref === row.estimate.source_ref));
  }
});

test("invalid or mismatched scenario withholds planning and requests while retaining reviewed findings", () => {
  const {brief, sources} = fixture();
  for (const changed of [
    {...brief.scenario!, result: {...brief.scenario!.result, scenario_id: "old-scenario"}},
    {...brief.scenario!, result: {...brief.scenario!.result, target_mechanism: "old-mechanism"}},
    {...brief.scenario!, input: {...brief.scenario!.input, capacity: -1}},
    {...brief.scenario!, result: {...brief.scenario!.result, reached_participants: Infinity}}
  ]) {
    const model = buildPlanningInsights({...brief, scenario: changed}, sources);
    assert.equal(model.scenario.availability, "withheld");
    assert.equal(model.investigations.prompts.length, 0);
    assert.equal(model.national.findingsCount, 21);
  }
});

test("missing templates or unsupported scopes never manufacture requests or imply scientific insufficiency", () => {
  const {brief, sources} = fixture();
  for (const model of [
    buildPlanningInsights(brief, {...sources, templateFields: []}),
    buildPlanningInsights(fixture(null).brief, sources),
    buildPlanningInsights(fixture({...createPlanningScenarioDefaults(), mechanism: "unsupported-mechanism"}).brief, sources)
  ]) {
    assert.equal(model.investigations.availability, "unavailable");
    assert.equal(model.investigations.prompts.length, 0);
    assert.equal(model.interventions.availability, "unavailable");
    assert.equal(model.national.findingsCount, 21);
  }
});

test("existing current and stale request bindings survive inspection without selection, refresh or acceptance", () => {
  const {brief, sources} = fixture();
  const current = createSensitivityDataRequest(brief.scenario!.input, "capacity");
  const stale = createSensitivityDataRequest({...brief.scenario!.input, reach: .6}, "reach");
  sources.availableDataRequests = [current, stale];
  const before = JSON.stringify(sources.availableDataRequests);
  const model = buildPlanningInsights(brief, sources);
  assert.deepEqual(model.investigations.prompts.map(row => row.status), ["current", "stale", "absent"]);
  assert.match(model.investigations.prompts[1].href, /^\/data-requests#request-title-/);
  assert.equal(brief.data_requests.length, 0);
  assert.equal(JSON.stringify(sources.availableDataRequests), before);
});

test("offline inference contract and candidate catalogs are never imported by the preview", () => {
  for (const path of ["../src/data/planningInsights.ts", "../src/components/PlanningInsights.tsx"]) {
    const source = readFileSync(new URL(path, import.meta.url), "utf8");
    assert.doesNotMatch(source, /from ["'][^"']*(?:planning-guidance|narrative-references|review-inputs|generated)[^"']*["']/);
    assert.doesNotMatch(source, /fetch\(|upsertAnalystDataRequest|toggleDataRequestForBrief/);
  }
});
