import type { Scenario } from "@diagnostic-odyssey/contracts";
import {
  calculateScenario,
  InvalidScenarioError,
  InvalidScenarioResultError,
  oneWaySensitivity,
  type SensitivityPoint
} from "@diagnostic-odyssey/scenario-engine";

export type SensitivityField = "reach" | "capacity" | "alternative_window_months";

const roundComparison = (value: number, digits = 6) =>
  Number(value.toFixed(digits));

function uniqueSortedWithCurrent(
  current: number,
  comparisonValues: number[]
): number[] {
  const seenComparisonValues = new Set<number>();
  const comparisons: number[] = [];

  for (const value of comparisonValues) {
    if (!Number.isFinite(value)) {
      throw new InvalidScenarioResultError([{
        path: "sensitivity.input_value",
        message: "comparison input must be a finite number"
      }]);
    }
    const normalized = roundComparison(value);
    if (
      normalized === current ||
      seenComparisonValues.has(normalized)
    ) {
      continue;
    }
    seenComparisonValues.add(normalized);
    comparisons.push(normalized);
  }

  return [current, ...comparisons].sort((a, b) => a - b);
}

export function buildSensitivityValues(
  scenario: Scenario,
  field: SensitivityField
): number[] {
  calculateScenario(scenario);
  if (field === "reach") {
    const current = scenario.reach;
    return uniqueSortedWithCurrent(current, [
      Math.max(0, current - 0.1),
      Math.max(0, current - 0.05),
      Math.min(1, current + 0.05),
      Math.min(1, current + 0.1)
    ]);
  }

  if (field === "capacity") {
    const current = Math.max(0, scenario.capacity);
    const intended = Math.max(0, Math.round(scenario.eligible_population * scenario.reach));
    const reference = current > 0 ? current : intended;
    if (reference <= 0) return [current];
    return uniqueSortedWithCurrent(
      current,
      [0.5, 0.75, 1, 1.25, 1.5].map(multiplier =>
        Math.max(0, Math.round(reference * multiplier))
      )
    );
  }

  const current = scenario.alternative_window_months;
  const upper = scenario.baseline_window_months;
  return uniqueSortedWithCurrent(current, [
    Math.max(0, current - 2),
    Math.max(0, current - 1),
    Math.min(upper, current + 1),
    Math.min(upper, current + 2)
  ]);
}

export function evaluateScenarioSensitivity(
  scenario: Scenario,
  field: SensitivityField
): {points: SensitivityPoint[]; error: string | null} {
  try {
    return {
      points: oneWaySensitivity(scenario, field, buildSensitivityValues(scenario, field)),
      error: null
    };
  } catch (error) {
    if (!(error instanceof InvalidScenarioError) && !(error instanceof InvalidScenarioResultError)) throw error;
    return {
      points: [],
      error: "Sensitivity analysis is unavailable because an input or comparison calculation is outside the supported numeric range. Reduce the applied population, capacity, recognition windows, or program costs, or choose another assumption to test."
    };
  }
}
