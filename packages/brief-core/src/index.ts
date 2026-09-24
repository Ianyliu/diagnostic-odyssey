import {
  canExportEstimate,
  type AnalysisContext,
  type DataRequest,
  type Estimate,
  type EvidenceRecord,
  type LocalContextRecord,
  type Scenario,
  type ScenarioResult
} from "@diagnostic-odyssey/contracts";

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

export function buildPlanningBrief(input: BriefInput): PlanningBrief {
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

  return {
    title: "Diagnostic Odyssey planning brief",
    context: input.context,
    burden_findings: burdenFindings,
    local_context: input.localContext.filter(record =>\n      record.release_status === "reviewed_released" &&\n      (record.state === "loaded" || record.state === "partial")\n    ),
    scenario: input.scenario ?? null,
    evidence: input.evidence.filter(record => record.reviewer_status === "approved"),
    data_requests: input.dataRequests,
    warnings,
    artifact_version: input.context.artifact_version,
    generated_at: input.generatedAt ?? new Date().toISOString()
  };
}

export function serializeBriefJson(brief: PlanningBrief): string {
  return JSON.stringify(brief, null, 2);
}
