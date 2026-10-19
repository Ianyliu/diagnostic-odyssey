import assert from "node:assert/strict";
import test from "node:test";
import {readFileSync} from "node:fs";
import {buildPlanningBrief, serializeBriefJson} from "@diagnostic-odyssey/brief-core";
import {canExportEstimate} from "@diagnostic-odyssey/contracts";
import {loadReviewedMepsArtifact} from "../src/data/reviewedArtifact.ts";
import {loadReviewedWvLocalContextArtifact} from "../src/data/reviewedLocalContext.ts";
import {buildPlanningInsights} from "../src/data/planningInsights.ts";
import {selectBriefLocalContextPreview} from "../src/data/briefLocalContextPreview.ts";
import {
  clearLocalContextSelection, createLocalContextSelectionForArtifact,
  isSelectableLocalContextRecord, resolveSelectedLocalContext, updateLocalContextSelection
} from "../src/data/localContextSelection.ts";

const national = loadReviewedMepsArtifact();
const local = loadReviewedWvLocalContextArtifact();
const eligible = local.indicators.filter(isSelectableLocalContextRecord);
function makeBrief(selected = eligible) {
  return buildPlanningBrief({
    context: {...national.context, local_context_id: selected.length ? local.manifest.artifact_version : null},
    estimates: national.burden_domains.flatMap(domain => domain.measures),
    localContext: selected, scenario: null, evidence: national.evidence, dataRequests: [],
    generatedAt: "2026-10-19T00:00:00.000Z"
  });
}
const source = {national, local, localStatus: "loaded" as const, availableDataRequests: []};

test("all 34 reviewed eligible WV indicators remain selected by default and canonically export", () => {
  const selection = createLocalContextSelectionForArtifact(local);
  assert.equal(eligible.length, 34);
  assert.deepEqual(selection.indicatorIds, eligible.map(item => item.indicator_id));
  const selected = resolveSelectedLocalContext(selection, "loaded", local);
  assert.deepEqual(selected, eligible);
  const brief = makeBrief(selected);
  assert.equal(brief.local_context.length, 34);
  assert.equal(brief.context.local_context_id, local.manifest.artifact_version);
  assert.deepEqual(brief.local_context, eligible);
  assert.deepEqual(JSON.parse(serializeBriefJson(brief)).local_context, eligible);
});

test("none and individual/category selections preserve exactly the chosen records and IDs", () => {
  let selection = clearLocalContextSelection(local);
  let selected = resolveSelectedLocalContext(selection, "loaded", local);
  assert.equal(makeBrief(selected).local_context.length, 0);
  assert.equal(makeBrief(selected).context.local_context_id, null);
  for (const row of eligible.filter(item => item.indicator_id.startsWith("wv.acs."))) {
    selection = updateLocalContextSelection(selection, local, row.indicator_id, true);
  }
  selected = resolveSelectedLocalContext(selection, "loaded", local);
  assert.equal(selected.length, 4);
  assert.deepEqual(makeBrief(selected).local_context, selected);
  const first = selected[0]!;
  selection = updateLocalContextSelection(selection, local, first.indicator_id, false);
  assert.equal(resolveSelectedLocalContext(selection, "loaded", local).length, 3);
  selection = createLocalContextSelectionForArtifact(local);
  assert.equal(resolveSelectedLocalContext(selection, "loaded", local).length, 34);
});

test("preview is a separate projection: priority is comprehensible, custom selections remain represented", () => {
  const brief = makeBrief();
  const json = serializeBriefJson(brief);
  const top = selectBriefLocalContextPreview(brief.local_context);
  assert.equal(top.length, 4);
  assert.ok(top.every(row => row.indicator_id.startsWith("wv.acs.")));
  assert.deepEqual(top.map(row => row.indicator_id), [
    "wv.acs.no_vehicle_pct", "wv.acs.uninsured_pct",
    "wv.acs.broadband_pct", "wv.acs.poverty_pct"
  ]);
  const custom = [eligible.find(row => row.indicator_id.includes("rural-status"))!];
  assert.deepEqual(selectBriefLocalContextPreview(custom), custom);
  assert.deepEqual(selectBriefLocalContextPreview([], 4), []);
  assert.deepEqual(selectBriefLocalContextPreview(custom, 0), []);
  assert.equal(serializeBriefJson(brief), json);
  assert.equal(brief.local_context.length, 34);
});

test("national summary uses exact verified export-eligible records and withholds tampering", () => {
  const brief = makeBrief();
  const original = serializeBriefJson(brief);
  const insights = buildPlanningInsights(brief, source);
  for (const [kind, id] of [
    ["population", "meps24-current-long-covid-population"],
    ["allCauseSpending", "meps24-gross-all-cause-spending-total"]
  ] as const) {
    const finding = insights.national.context[kind];
    assert.equal(finding?.estimate.estimate_id, id);
    assert.ok(finding && canExportEstimate(finding.estimate));
    assert.deepEqual(finding.estimate, brief.burden_findings.find(row => row.estimate_id === id));
    assert.deepEqual(finding.source, national.sources.find(row => row.source_ref === finding.estimate.source_ref));
  }
  assert.ok(insights.national.highlights.some(row => row.estimate.estimate_id === "meps24-k6-serious-distress"));
  assert.equal(serializeBriefJson(brief), original);
  const tampered = structuredClone(brief);
  tampered.burden_findings = tampered.burden_findings.map(row =>
    row.estimate_id === "meps24-gross-all-cause-spending-total" ? {...row, value: 1} : row
  );
  assert.equal(buildPlanningInsights(tampered, source).national.context.allCauseSpending, null);
  assert.equal(buildPlanningInsights({...brief, artifact_version: "wrong"}, source).national.context.population, null);
  const absent = {...brief, burden_findings: []};
  assert.equal(buildPlanningInsights(absent, source).national.context.population, null);
});

test("print and selection copy distinguish default inclusion, optional detail and data-request status", () => {
  const read = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");
  const preview = read("../src/components/PlanningInsights.tsx");
  const page = read("../src/pages/BriefPage.tsx");
  const css = read("../src/pages/BriefPage.css");
  const localPage = read("../src/pages/LocalContextPage.tsx");
  const provider = read("../src/data/ArtifactContext.tsx");
  const decisions = read("../../../docs/decision-workspace-design-decisions.md");
  assert.doesNotMatch(preview, /explicitly selected/);
  assert.doesNotMatch(preview, /remain separate choices/);
  assert.match(preview, /newly created requests start included/);
  assert.match(page, /includeContextAppendixInPrint/);
  assert.match(css, /\.brief-local-context-list \{ display: none !important; \}/);
  assert.match(css, /\.brief-include-context-appendix \.brief-local-context-list \{ display: block !important; \}/);
  assert.match(localPage, /Eligible reviewed indicators start selected by default/);
  assert.match(provider, /createLocalContextSelectionForArtifact\(candidate\)/);
  assert.match(provider, /setBriefDataRequestIds\(current => current.includes\(request.request_id\)/);
  assert.match(provider, /isDataRequestCurrentForScenario\(request, scenario\)/);
  assert.match(decisions, /start included in the Planning Brief/);
});
