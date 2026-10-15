import type { PlanningBrief } from "@diagnostic-odyssey/brief-core";
import {
  canExportEstimate, canDisplayDistributionSummary, validateEstimate,
  validateLocalContextRecord, validateScenario, validateScenarioResult,
  type ArtifactBundle, type Estimate, type LocalContextArtifact, type LocalContextRecord,
  type SourceManifestEntry
} from "@diagnostic-odyssey/contracts";
import { groupBriefBurdenFindings } from "../data/briefBurdenPresentation.ts";
import { REVIEWED_MEPS_ARTIFACT_VERSION } from "../data/reviewedArtifact.ts";
import { assertReviewedWvLocalContextArtifact, assertReviewedWvLocalContextRuntimeCompatibility } from "../data/reviewedLocalContextValidation.ts";

export interface BriefHighlight { domain: string; estimate: Estimate; source: SourceManifestEntry }
/** Read-only presentation contract; no fixture, request, provider, or action capabilities. */
export interface ConceptBriefSnapshot {
  artifactVersion: string;
  highlights: BriefHighlight[];
  nationalStatus: "available" | "withheld";
  local: {status: "selected" | "unselected" | "unavailable" | "withheld"; artifactVersion: string | null; records: LocalContextRecord[]};
  scenario: PlanningBrief["scenario"];
  warnings: string[];
}

function sameValue(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((value, i) => sameValue(value, b[i]));
  if (a && b && typeof a === "object" && typeof b === "object" && !Array.isArray(a) && !Array.isArray(b)) {
    const left = a as Record<string, unknown>, right = b as Record<string, unknown>;
    return Object.keys(left).length === Object.keys(right).length && Object.keys(left).every(key => Object.hasOwn(right, key) && sameValue(left[key], right[key]));
  }
  return false;
}

/** Selection/identity rules follow PR #105 at c176e884, without depending on its pending UI. */
export function projectConceptBrief(brief: PlanningBrief, source: ArtifactBundle, local: LocalContextArtifact | null, localStatus: "loading" | "loaded" | "error"): ConceptBriefSnapshot {
  const sourceMatches = source.manifest.artifact_version === REVIEWED_MEPS_ARTIFACT_VERSION &&
    brief.artifact_version === source.manifest.artifact_version && sameValue({...brief.context, local_context_id: null}, source.context);
  const sourceById = new Map(source.burden_domains.flatMap(domain => domain.measures).map(record => [record.estimate_id, record]));
  const sources = new Map(source.sources.map(record => [record.source_ref, record]));
  const eligible = sourceMatches ? brief.burden_findings.filter(record => canExportEstimate(record) &&
    !validateEstimate(record).length && record.artifact_version === brief.artifact_version &&
    sameValue(record, sourceById.get(record.estimate_id)) && sources.has(record.source_ref)) : [];
  const highlights = groupBriefBurdenFindings(source.burden_domains, eligible).slice(0, 3).flatMap(group => {
    const estimate = group.findings.find(canDisplayDistributionSummary) ?? group.findings.find(record => !record.component_of_measure_id) ?? group.findings[0];
    const citation = estimate && sources.get(estimate.source_ref);
    return estimate && citation ? [{domain: group.label, estimate: structuredClone(estimate), source: structuredClone(citation)}] : [];
  });
  let selected: ConceptBriefSnapshot["local"] = {status: "unavailable", artifactVersion: null, records: []};
  if (localStatus === "loaded" && local) {
    try {
      assertReviewedWvLocalContextRuntimeCompatibility(brief.artifact_version);
      assertReviewedWvLocalContextArtifact(local);
      const records = local.indicators.filter(record => record.release_status === "reviewed_released" &&
        (record.state === "loaded" || record.state === "partial") && !validateLocalContextRecord(record).length &&
        brief.local_context.some(item => sameValue(item, record)));
      const current = brief.context.local_context_id === local.manifest.artifact_version;
      selected = brief.local_context.length === 0 ? {status: "unselected", artifactVersion: null, records: []} :
        current && records.length === brief.local_context.length ? {status: "selected", artifactVersion: local.manifest.artifact_version, records: structuredClone(records)} :
        {status: "withheld", artifactVersion: null, records: []};
    } catch { selected = {status: "withheld", artifactVersion: null, records: []}; }
  }
  const scenario = brief.scenario;
  const validScenario = scenario && !validateScenario(scenario.input).length && !validateScenarioResult(scenario.result).length &&
    scenario.input.scenario_id === scenario.result.scenario_id && scenario.input.target_pathway_step === scenario.result.target_pathway_step &&
    scenario.input.mechanism === scenario.result.target_mechanism;
  return {artifactVersion: brief.artifact_version, highlights, nationalStatus: highlights.length ? "available" : "withheld",
    local: selected, scenario: validScenario ? structuredClone(scenario) : null, warnings: [...brief.warnings]};
}
