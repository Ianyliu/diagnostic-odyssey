import type { PlanningBrief } from "@diagnostic-odyssey/brief-core";
import {
  canExportEstimate, canDisplayDistributionSummary, validateEstimate,
  validateLocalContextRecord, validateScenario, validateScenarioResult, validateDataRequest,
  type ArtifactBundle, type DataRequest, type Estimate, type LocalContextArtifact,
  type LocalContextRecord, type SourceManifestEntry
} from "@diagnostic-odyssey/contracts";
import {
  createSensitivityDataRequest, getSensitivityDataRequestStatus,
  type SensitivityField, type SensitivityDataRequestStatus
} from "./dataRequestTemplates.ts";
import { groupBriefBurdenFindings } from "./briefBurdenPresentation.ts";
import { REVIEWED_MEPS_ARTIFACT_VERSION } from "./reviewedArtifact.ts";
import {
  assertReviewedWvLocalContextArtifact, assertReviewedWvLocalContextRuntimeCompatibility
} from "./reviewedLocalContextValidation.ts";

export type InsightAvailability = "available" | "unselected" | "unavailable" | "withheld";
export type InsightRole = "reviewed" | "context" | "assumption" | "result" | "prompt";
export interface InsightSection {
  availability: InsightAvailability;
  explanation: string;
}
export interface InsightFinding {
  domainId: string;
  domainLabel: string;
  estimate: Estimate;
  source: SourceManifestEntry;
}
export interface InvestigationPrompt {
  field: SensitivityField;
  label: string;
  basis: string;
  request: DataRequest;
  status: SensitivityDataRequestStatus;
  href: string;
  actionLabel: string;
}
/** Presentation only. This is neither an inference wire contract nor scientific authority. */
export interface PlanningInsightsModelV1 {
  version: "presentation.v1";
  artifactVersion: string;
  national: InsightSection & { findingsCount: number; highlights: InsightFinding[]; context: {population: InsightFinding | null; allCauseSpending: InsightFinding | null} };
  local: InsightSection & { artifactVersion: string | null; records: LocalContextRecord[] };
  scenario: InsightSection & { applied: PlanningBrief["scenario"] };
  interventions: { availability: "unavailable"; explanation: string };
  investigations: InsightSection & { prompts: InvestigationPrompt[]; capacitySignal: boolean };
  warnings: string[];
}
export interface PlanningInsightsSources {
  national: ArtifactBundle;
  local: LocalContextArtifact | null;
  localStatus: "loading" | "loaded" | "error";
  availableDataRequests: readonly DataRequest[];
  /** Trusted composition-root capability list; never read from a record or provider. */
  templateFields?: readonly SensitivityField[];
}

// Compare supplied Brief records with the authoritative loader's records, including
// provenance/limits. Key order is irrelevant; no hashes here confer admission.
function sameValue(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (Array.isArray(left) && Array.isArray(right)) {
    return left.length === right.length && left.every((value, index) => sameValue(value, right[index]));
  }
  if (left && right && typeof left === "object" && typeof right === "object" &&
      !Array.isArray(left) && !Array.isArray(right)) {
    const a = left as Record<string, unknown>, b = right as Record<string, unknown>;
    const keys = Object.keys(a);
    return keys.length === Object.keys(b).length && keys.every(key => Object.hasOwn(b, key) && sameValue(a[key], b[key]));
  }
  return false;
}

function nationalSection(brief: PlanningBrief, source: ArtifactBundle): PlanningInsightsModelV1["national"] {
  if (source.manifest.artifact_version !== REVIEWED_MEPS_ARTIFACT_VERSION ||
      brief.artifact_version !== source.manifest.artifact_version ||
      !sameValue({...brief.context, local_context_id: null}, source.context)) {
    return {availability: "withheld", explanation: "National source identity does not match this Brief. Open the reviewed burden source to resolve it.", findingsCount: 0, highlights: [], context: {population: null, allCauseSpending: null}};
  }
  const sourceById = new Map(source.burden_domains.flatMap(domain => domain.measures).map(record => [record.estimate_id, record]));
  const sourceRefs = new Map(source.sources.map(record => [record.source_ref, record]));
  const seen = new Set<string>();
  const eligible = brief.burden_findings.filter(record => {
    if (seen.has(record.estimate_id)) return false;
    seen.add(record.estimate_id);
    return canExportEstimate(record) && validateEstimate(record).length === 0 &&
      record.artifact_version === brief.artifact_version &&
      sameValue(record, sourceById.get(record.estimate_id)) && sourceRefs.has(record.source_ref);
  });
  // Named headline records may enter the projection only after the same exact-identity,
  // release and provenance checks as every other eligible Brief finding.
  const eligibleById = new Map(eligible.map(record => [record.estimate_id, record]));
  const pickHeadline = (estimateId: string): InsightFinding | null => {
    const estimate = eligibleById.get(estimateId);
    const citation = estimate && sourceRefs.get(estimate.source_ref);
    return estimate && citation ? {domainId: "national-context", domainLabel: "National descriptive context", estimate: structuredClone(estimate), source: structuredClone(citation)} : null;
  };
  const context = {
    population: pickHeadline("meps24-current-long-covid-population"),
    allCauseSpending: pickHeadline("meps24-gross-all-cause-spending-total")
  };
  // One representative per available domain, in the existing artifact's order.
  // Prefer an approved distribution, then a non-nested measure, then any eligible
  // finding. Never rank magnitudes across heterogeneous units or require an ID.
  const highlights = groupBriefBurdenFindings(source.burden_domains, eligible).slice(0, 3).flatMap(group => {
    const estimate = group.findings.find(record => record.estimate_id === "meps24-k6-serious-distress") ??
      group.findings.find(canDisplayDistributionSummary) ??
      group.findings.find(record => !record.component_of_measure_id) ?? group.findings[0];
    const citation = estimate && sourceRefs.get(estimate.source_ref);
    return estimate && citation ? [{domainId: group.group_id, domainLabel: group.label, estimate: structuredClone(estimate), source: structuredClone(citation)}] : [];
  });
  const withheld = brief.burden_findings.length - eligible.length;
  return {
    availability: eligible.length ? "available" : "withheld",
    explanation: eligible.length
      ? `One finding per available domain; descriptive highlights, not a ranking of burden.${withheld ? " Some findings were withheld because their release or source identity could not be verified." : ""}`
      : "No validated released finding can be summarized for this Brief. Missing or withheld evidence is not zero burden.",
    findingsCount: eligible.length, highlights, context
  };
}

function localSection(brief: PlanningBrief, sources: PlanningInsightsSources): PlanningInsightsModelV1["local"] {
  const empty = {artifactVersion: null, records: []};
  if (sources.localStatus !== "loaded" || !sources.local) {
    return {...empty, availability: "unavailable", explanation: sources.localStatus === "loading"
      ? "Reviewed local context is loading. No location-specific conclusion is inferred."
      : "Reviewed local context is unavailable. National burden remains unchanged."};
  }
  try {
    assertReviewedWvLocalContextRuntimeCompatibility(brief.artifact_version);
    assertReviewedWvLocalContextArtifact(sources.local);
  } catch {
    return {...empty, availability: "withheld", explanation: "Local source version or national compatibility could not be verified. Reselect current reviewed context before using it."};
  }
  if (brief.local_context.length === 0) {
    return {...empty, availability: "unselected", explanation: "Reviewed West Virginia context is available. Select only the indicators relevant to your implementation decision."};
  }
  if (brief.context.local_context_id !== sources.local.manifest.artifact_version) {
    return {...empty, availability: "withheld", explanation: "Selected context belongs to a different source version. Reselect current reviewed context."};
  }
  const records = sources.local.indicators.filter(record =>
    record.release_status === "reviewed_released" && (record.state === "loaded" || record.state === "partial") &&
    validateLocalContextRecord(record).length === 0 &&
    brief.local_context.some(selected => sameValue(selected, record))
  );
  return {
    availability: records.length ? "available" : "withheld",
    artifactVersion: records.length ? sources.local.manifest.artifact_version : null,
    records: structuredClone(records),
    explanation: records.length
      ? "Reviewed implementation context included in this Brief (eligible indicators start selected by default, and an active Pilot-used record can also be included). These indicators do not rescale national burden or establish local Long COVID prevalence."
      : "Selected records could not be verified against the current reviewed context. No substitute values are shown."
  };
}

function scenarioSection(brief: PlanningBrief): PlanningInsightsModelV1["scenario"] {
  const applied = brief.scenario;
  if (!applied) return {availability: "unavailable", applied: null, explanation: "Apply a valid Pilot scenario to inspect its planning implications."};
  if (validateScenario(applied.input).length || validateScenarioResult(applied.result).length ||
      applied.input.scenario_id !== applied.result.scenario_id ||
      applied.input.target_pathway_step !== applied.result.target_pathway_step ||
      applied.input.mechanism !== applied.result.target_mechanism) {
    return {availability: "withheld", applied: null, explanation: "The scenario and its deterministic result could not be validated together. Review the applied Pilot inputs."};
  }
  return {availability: "available", applied: structuredClone(applied), explanation: "Copied from the applied Pilot result. These are assumption-based planning quantities, not forecasts, causal effects, or savings."};
}

const promptLabels: Record<SensitivityField, string> = {
  capacity: "Verify available capacity", reach: "Verify the outreach and enrollment funnel",
  alternative_window_months: "Verify pathway timing"
};
function investigationSection(scenario: PlanningBrief["scenario"], sources: PlanningInsightsSources): PlanningInsightsModelV1["investigations"] {
  const empty = {prompts: [], capacitySignal: false};
  if (!scenario) return {...empty, availability: "unavailable", explanation: "A valid applied scenario is needed to bind an operational request to its pathway and mechanism."};
  // These are the existing product's supported scope, not general clinical rules.
  if (scenario.input.target_pathway_step !== "recognition-to-referral" || scenario.input.mechanism !== "navigation-support") {
    return {...empty, availability: "unavailable", explanation: "No existing request template is verified for this pathway and mechanism. Review Data Requests without manufacturing a new request."};
  }
  const fields: SensitivityField[] = [...new Set<SensitivityField>(sources.templateFields ?? ["capacity", "reach", "alternative_window_months"])];
  const requests = sources.availableDataRequests.filter(request => validateDataRequest(request).length === 0);
  const prompts: InvestigationPrompt[] = fields.flatMap(field => {
    const request = createSensitivityDataRequest(scenario.input, field);
    if (validateDataRequest(request).length) return [];
    const status = getSensitivityDataRequestStatus(scenario.input, field, requests);
    return [{
      field, label: promptLabels[field], request, status,
      basis: field === "capacity" && scenario.result.capacity_gap > 0
        ? "The applied assumptions produce a positive capacity gap. Verify the capacity assumption before treating this modeled constraint as an operational fact."
        : field === "capacity"
          ? "Capacity is an analyst assumption. No positive modeled gap does not establish that staffed local capacity is sufficient."
          : field === "reach"
            ? "Intended reach is an analyst assumption. Local aggregate funnel counts could test whether identification, contact, and enrollment are feasible."
            : "Both recognition windows are analyst assumptions. Observed milestone intervals could inform feasibility; they would not establish intervention effectiveness.",
      href: status === "absent" ? "/pilot#sensitivity" : `/data-requests#request-title-${request.request_id}`,
      actionLabel: status === "absent" ? "Investigate in Pilot sensitivity" : status === "stale" ? "Review stale request" : "Review existing request"
    }];
  });
  const capacitySignal = scenario.result.capacity_gap > 0 && prompts.some(prompt => prompt.field === "capacity");
  if (capacitySignal) prompts.sort((a, b) => Number(b.field === "capacity") - Number(a.field === "capacity"));
  return {
    availability: prompts.length ? "available" : "unavailable", prompts, capacitySignal,
    explanation: prompts.length
      ? capacitySignal
        ? "Capacity is surfaced first because this applied scenario has a modeled gap. Other prompts are not ranked. This is a planning rule, not an empirical priority assessment."
        : "No empirically established priority is available. These prompts are shown in a stable template order; choose according to your planning decision."
      : "No eligible operational request template is available. No request has been generated or accepted."
  };
}

export function buildPlanningInsights(brief: PlanningBrief, sources: PlanningInsightsSources): PlanningInsightsModelV1 {
  const scenario = scenarioSection(brief);
  return {
    version: "presentation.v1", artifactVersion: brief.artifact_version,
    national: nationalSection(brief, sources.national), local: localSection(brief, sources), scenario,
    interventions: {availability: "unavailable", explanation: "No independently released, context-applicable narrative intervention reference is available. This does not establish that an intervention has no effect."},
    investigations: investigationSection(scenario.applied, sources),
    warnings: [...brief.warnings]
  };
}
