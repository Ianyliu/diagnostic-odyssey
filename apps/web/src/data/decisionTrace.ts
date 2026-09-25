import type {
  EvidenceRecord,
  LocalContextRecord,
  Scenario
} from "@diagnostic-odyssey/contracts";
import { canDriveScenarioParameter } from "@diagnostic-odyssey/evidence-core";
import { formatLocalContextValue } from "./formatLocalContextValue";
import {
  formatMechanismLabel,
  formatPathwayStepLabel
} from "./pathwayBoundary";

export interface DecisionTraceItem {
  key: "burden" | "local-context" | "pathway" | "mechanism" | "measurement" | "claim-boundary";
  label: string;
  detail: string;
}

export interface DecisionTraceInput {
  burdenEstimateCount: number;
  pilotLocalContext: LocalContextRecord | null;
  scenario: Scenario;
  currentDataRequestCount: number;
  evidence: EvidenceRecord[];
}

export function describeSupportedClaimBoundary(
  evidence: EvidenceRecord[],
  scenario: Scenario
): string {
  const applicable = evidence.filter(
    record => canDriveScenarioParameter(record, scenario).allowed
  );

  if (applicable.length === 0) {
    return "No reviewed intervention-effect parameter is available. The scenario remains assumption-based; causal benefit, savings, ROI, and preventable-cost claims remain unavailable.";
  }

  const boundaries = Array.from(
    new Set(applicable.map(record => record.allowed_use))
  );

  return boundaries.length === 1
    ? "Reviewed supported-use boundary: " + boundaries[0]
    : "Reviewed supported-use boundaries: " + boundaries.join("; ");
}

export function buildDecisionTrace({
  burdenEstimateCount,
  pilotLocalContext,
  scenario,
  currentDataRequestCount,
  evidence
}: DecisionTraceInput): DecisionTraceItem[] {
  return [
    {
      key: "burden",
      label: "Released observed burden",
      detail:
        "Reviewed national MEPS burden · " +
        burdenEstimateCount +
        " reviewed estimates · national descriptive evidence"
    },
    {
      key: "local-context",
      label: "Explicitly selected reviewed local constraint/context",
      detail: pilotLocalContext
        ? pilotLocalContext.label +
          ": " +
          formatLocalContextValue(pilotLocalContext) +
          " · " +
          pilotLocalContext.geography_name +
          " " +
          pilotLocalContext.geography_type +
          " context"
        : "No explicit local constraint selected"
    },
    {
      key: "pathway",
      label: "Target pathway step",
      detail: formatPathwayStepLabel(scenario.target_pathway_step)
    },
    {
      key: "mechanism",
      label: "Planning mechanism",
      detail: formatMechanismLabel(scenario.mechanism)
    },
    {
      key: "measurement",
      label: "Measurement / data request needed",
      detail:
        currentDataRequestCount === 0
          ? "No current operational data request attached"
          : currentDataRequestCount +
            " current operational data " +
            (currentDataRequestCount === 1 ? "request" : "requests")
    },
    {
      key: "claim-boundary",
      label: "Supported claim boundary",
      detail: describeSupportedClaimBoundary(evidence, scenario)
    }
  ];
}
