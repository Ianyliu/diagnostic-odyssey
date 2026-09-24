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
      ariaLabel: `No intended participants under the current planning assumptions; capacity gap ${integer.format(result.capacity_gap)}.`,
      noDemandCopy: "No intended participants under the current reach assumption."
    };
  }

  const coveragePercent = clampPercent(
    (result.reached_participants / result.intended_reach) * 100
  );
  return {
    headline: `${coveragePercent.toFixed(0)}%`,
    coveragePercent,
    ariaLabel: `${integer.format(result.reached_participants)} of ${integer.format(result.intended_reach)} intended participants fit within the current program capacity assumption; capacity gap ${integer.format(result.capacity_gap)}.`,
    noDemandCopy: null
  };
}


export function formatRecognitionWindowDifference(
  baselineMonths: number,
  alternativeMonths: number
): string {
  return windowDelta.format(baselineMonths - alternativeMonths);
}
