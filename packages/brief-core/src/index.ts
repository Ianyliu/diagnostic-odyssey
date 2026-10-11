import {
  canExportEstimate,
  validateScenario,
  validateScenarioResult,
  type AnalysisContext,
  type DataRequest,
  type Estimate,
  type EvidenceRecord,
  type LocalContextRecord,
  type Scenario,
  type ScenarioResult
} from "@diagnostic-odyssey/contracts";
import {
  acquisitionResolver, isDataRequestCurrentForScenario, sanitizeBaseDataRequest,
  type AcquisitionGuidance, type AcquisitionResolver
} from "@diagnostic-odyssey/acquisition-hints";

export interface PlanningBrief {
  title: string;
  context: AnalysisContext;
  burden_findings: Estimate[];
  local_context: LocalContextRecord[];
  scenario: { input: Scenario; result: ScenarioResult } | null;
  evidence: EvidenceRecord[];
  data_requests: DataRequest[];
  warnings: string[];
  artifact_version: string;
  generated_at: string;
  acquisition_guidance?: AcquisitionGuidance[];
}

export interface BriefInput {
  context: AnalysisContext;
  estimates: Estimate[];
  localContext: LocalContextRecord[];
  scenario?: { input: Scenario; result: ScenarioResult } | null;
  evidence: EvidenceRecord[];
  dataRequests: DataRequest[];
  generatedAt?: string;
}

function constructBrief(input: BriefInput, resolver: AcquisitionResolver): PlanningBrief {
  assertValidBriefScenario(input.scenario);
  const burdenFindings = input.estimates.filter(canExportEstimate);
  const warnings = [
    "Gross burden is not attributable burden.",
    "Local context informs implementation and does not modify national burden.",
    "Scenario outputs are deterministic planning quantities, not savings, ROI, causal benefit, or observed improvement."
  ];

  if (burdenFindings.some(estimate => estimate.component_of_measure_id)) {
    warnings.push(
      "Out-of-pocket/self-family-paid spending is nested within total spending and must not be added to it."
    );
  }

  if (burdenFindings.some(estimate => /k6|phq2/i.test(estimate.measure_id))) {
    warnings.push(
      "K6 measures nonspecific psychological distress and PHQ-2 is a depressive-symptom screen; neither is a psychiatric diagnosis."
    );
  }

  if (burdenFindings.some(estimate => estimate.weight_variable === "ESAQWT24F")) {
    warnings.push(
      "ESAQ time measures are AHRQ annualized hours-per-year measures; later ESAQ responses do not establish continued current Long COVID after the earlier Round 3/1 status anchor."
    );
  }

  const requests = resolveBriefRequests(input.dataRequests, input.context, input.scenario?.input ?? null, resolver);
  if (requests.withheld) warnings.push(acquisitionWithheldWarning);
  const staleWarning = staleSelectedDataRequestExclusionWarning(requests.staleCount);
  if (staleWarning) warnings.push(staleWarning);
  return {
    title: "Diagnostic Odyssey planning brief",
    context: input.context,
    burden_findings: burdenFindings,
    local_context: input.localContext.filter(record =>
      record.release_status === "reviewed_released" &&
      (record.state === "loaded" || record.state === "partial")
    ),
    scenario: input.scenario ?? null,
    evidence: input.evidence.filter(record => record.reviewer_status === "approved"),
    data_requests: requests.dataRequests,
    warnings,
    artifact_version: input.context.artifact_version,
    generated_at: input.generatedAt ?? new Date().toISOString(),
    ...(requests.guidance.length ? {acquisition_guidance: requests.guidance} : {})
  };
}

function serializeBrief(brief: PlanningBrief, resolver: AcquisitionResolver): string {
  assertValidBriefScenario(brief.scenario);
  const requests = resolveBriefRequests(brief.data_requests, brief.context, brief.scenario?.input ?? null, resolver);
  // Never trust previously resolved companion snapshots, including constructed ones.
  const warnings = [...brief.warnings];
  if (requests.withheld && !warnings.includes(acquisitionWithheldWarning)) warnings.push(acquisitionWithheldWarning);
  const staleWarning = staleSelectedDataRequestExclusionWarning(requests.staleCount);
  if (staleWarning && !warnings.includes(staleWarning)) warnings.push(staleWarning);
  const sanitized: PlanningBrief = {
    title: brief.title, context: brief.context, burden_findings: brief.burden_findings,
    local_context: brief.local_context, scenario: brief.scenario, evidence: brief.evidence,
    data_requests: requests.dataRequests, warnings, artifact_version: brief.artifact_version,
    generated_at: brief.generated_at, ...(requests.guidance.length ? {acquisition_guidance: requests.guidance} : {})
  };
  return JSON.stringify(sanitized, (key: string, value: unknown) => {
    if (typeof value === "number" && !Number.isFinite(value)) {
      throw new Error(`Cannot export Planning Brief: ${key || "value"} must be a finite number. Correct the invalid value before exporting.`);
    }
    return value;
  }, 2);
}

export const acquisitionWithheldWarning = "Optional acquisition guidance was withheld because its reference, release identity or current applicability could not be verified. Valid base requests are retained.";
export function staleSelectedDataRequestExclusionWarning(count: number): string | null {
  if (count <= 0) return null;
  if (count === 1) return "1 selected data request is stale for the current scenario and has been excluded from this Planning Brief until explicitly refreshed.";
  return `${count} selected data requests are stale for the current scenario and have been excluded from this Planning Brief until explicitly refreshed.`;
}

function resolveBriefRequests(requests: DataRequest[], context: AnalysisContext, scenario: Scenario | null, resolver: AcquisitionResolver) {
  const dataRequests: DataRequest[] = [];
  const guidance: AcquisitionGuidance[] = [];
  let withheld = false;
  let staleCount = 0;
  for (const raw of requests) {
    const base = sanitizeBaseDataRequest(raw); // Invalid base throws even when optional guidance is invalid.
    if (!isDataRequestCurrentForScenario(base, scenario)) {staleCount++; continue;}
    const resolved = resolver.resolve(raw, context, scenario);
    dataRequests.push(resolved.request);
    if (resolved.guidance) guidance.push(resolved.guidance);
    else if (Object.hasOwn(raw, "acquisition_hint")) withheld = true;
  }
  return {dataRequests, guidance, withheld, staleCount};
}

/** Trusted composition-root injection, never read from a Brief or request payload. */
export function createBriefCodec(resolver: AcquisitionResolver) {
  return Object.freeze({
    buildPlanningBrief: (input: BriefInput) => constructBrief(input, resolver),
    serializeBriefJson: (brief: PlanningBrief) => serializeBrief(brief, resolver)
  });
}
const productionCodec = createBriefCodec(acquisitionResolver);
export const buildPlanningBrief = productionCodec.buildPlanningBrief;
export const serializeBriefJson = productionCodec.serializeBriefJson;

function assertValidBriefScenario(scenario: BriefInput["scenario"]): void {
  if (scenario == null) return;
  const issues = [
    ...validateScenario(scenario.input),
    ...validateScenarioResult(scenario.result)
  ];
  if (issues.length > 0) {
    throw new Error(`Cannot export Planning Brief: ${issues.map(issue => `${issue.path}: ${issue.message}`).join("; ")}. Correct the planning inputs before exporting.`);
  }
}
