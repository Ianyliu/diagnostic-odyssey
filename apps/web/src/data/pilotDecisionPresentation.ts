import { formatPlanningNumber } from "./planningNumberFormatting.ts";
import type { ScenarioResult } from "@diagnostic-odyssey/contracts";

const integer = new Intl.NumberFormat("en-US", {maximumFractionDigits: 0});
const windowDelta = new Intl.NumberFormat("en-US", {maximumFractionDigits: 2});

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, value));
}

export interface CapacityCoveragePresentation {
  headline: string;
  coveragePercent: number | null;
  ariaLabel: string;
  noDemandCopy: string | null;
}

export function getCapacityCoveragePresentation(
  result: ScenarioResult
): CapacityCoveragePresentation {
  if (result.intended_reach === 0) {
    return {
      headline: "N/A",
      coveragePercent: null,
      ariaLabel: `No intended participants under the current planning assumptions; capacity gap ${formatPlanningNumber(result.capacity_gap, integer)}.`,
      noDemandCopy: "No intended participants under the current reach assumption."
    };
  }

  const coveragePercent = clampPercent(
    (result.reached_participants / result.intended_reach) * 100
  );
  return {
    headline: `${coveragePercent.toFixed(0)}%`,
    coveragePercent,
    ariaLabel: `${formatPlanningNumber(result.reached_participants, integer)} of ${formatPlanningNumber(result.intended_reach, integer)} intended participants fit within the current program capacity assumption; capacity gap ${formatPlanningNumber(result.capacity_gap, integer)}.`,
    noDemandCopy: null
  };
}


export function formatRecognitionWindowDifference(
  baselineMonths: number,
  alternativeMonths: number
): string {
  return formatPlanningNumber(baselineMonths - alternativeMonths, windowDelta);
}
