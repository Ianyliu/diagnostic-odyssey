import type { Scenario } from "@diagnostic-odyssey/contracts";

export interface PathwayBoundaryPresentation {
  pathwayStepId: string;
  pathwayStepLabel: string;
  mechanismId: string;
  mechanismLabel: string;
  modeledBoundaryStatement: string;
  assumptionBoundaryStatement: string;
  outsideModelItems: string[];
}

const pathwayStepLabels: Record<string, string> = {
  "recognition-to-referral": "Recognition → referral"
};

const mechanismLabels: Record<string, string> = {
  "navigation-support": "Navigation support"
};

export function humanizeBoundaryId(value: string): string {
  const normalized = value.trim().replace(/[-_]+/g, " ").replace(/\s+/g, " ");
  if (!normalized) return "Not specified";
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

export function formatPathwayStepLabel(value: string): string {
  return pathwayStepLabels[value] ?? humanizeBoundaryId(value);
}

export function formatMechanismLabel(value: string): string {
  return mechanismLabels[value] ?? humanizeBoundaryId(value);
}

export function getPathwayBoundaryPresentation(
  scenario: Pick<Scenario, "target_pathway_step" | "mechanism">
): PathwayBoundaryPresentation {
  const pathwayStepLabel = formatPathwayStepLabel(scenario.target_pathway_step);
  const mechanismLabel = formatMechanismLabel(scenario.mechanism);

  return {
    pathwayStepId: scenario.target_pathway_step,
    pathwayStepLabel,
    mechanismId: scenario.mechanism,
    mechanismLabel,
    modeledBoundaryStatement:
      `This scenario is scoped to the ${pathwayStepLabel} step via ${mechanismLabel}.`,
    assumptionBoundaryStatement:
      "Reach, capacity, recognition-window assumptions, and program-resource inputs apply only within this modeled step and mechanism.",
    outsideModelItems: [
      "Reviewed national burden estimates",
      "Unrelated care-pathway stages",
      "Treatment effectiveness",
      "Clinical outcomes"
    ]
  };
}
