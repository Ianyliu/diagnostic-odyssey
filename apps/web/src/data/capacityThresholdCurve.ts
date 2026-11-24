import type { Scenario } from "@diagnostic-odyssey/contracts";
import { calculateScenario } from "@diagnostic-odyssey/scenario-engine";

export interface CapacityThresholdPoint {
  readonly capacity: number;
  readonly reachedParticipants: number;
  readonly capacityGap: number;
  readonly isBreakEven: boolean;
  readonly isCurrent: boolean;
}

export interface CapacityThresholdCurve {
  readonly intendedReach: number;
  readonly rawCurrentCapacity: number;
  readonly currentCapacity: number;
  readonly hasFractionalRounding: boolean;
  readonly firstSufficientRawCapacity: number;
  readonly currentReached: number;
  readonly currentGap: number;
  readonly breakEvenCapacity: number;
  readonly maxCapacity: number;
  readonly maxY: number;
  readonly points: readonly CapacityThresholdPoint[];
}

export type CapacityThresholdUnavailableReason =
  | "invalid_scenario"
  | "zero_span"
  | "extreme_scale";

export type CapacityThresholdCurveResult =
  | { readonly status: "available"; readonly curve: CapacityThresholdCurve }
  | {
      readonly status: "unavailable";
      readonly reason: CapacityThresholdUnavailableReason;
      readonly message: string;
    };

const MAX_CURVE_SCALE = 1e12;

export function effectiveCapacitySlots(rawCapacity: number): number {
  return Math.max(0, Math.round(rawCapacity));
}

export function firstSufficientRawCapacity(breakEvenEffectiveSlots: number): number {
  if (breakEvenEffectiveSlots <= 0) return 0;
  return Math.max(0, breakEvenEffectiveSlots - 0.5);
}

/**
 * Evaluate capacity-sufficiency curve state using effective integer slots matching
 * `@diagnostic-odyssey/scenario-engine` (`Math.max(0, Math.round(capacity))`).
 * Distinguishes invalid inputs, zero-span inputs, and extreme-scale bounds explicitly.
 */
export function buildCapacityThresholdCurveResult(scenario: Scenario): CapacityThresholdCurveResult {
  let baseline;
  try {
    baseline = calculateScenario(scenario);
  } catch (err) {
    return {
      status: "unavailable",
      reason: "invalid_scenario",
      message: err instanceof Error ? err.message : "Resolve invalid planning inputs to render the threshold curve."
    };
  }

  const intendedReach = baseline.intended_reach;
  const rawCurrentCapacity = scenario.capacity;
  const currentCapacity = effectiveCapacitySlots(rawCurrentCapacity);

  if (
    !Number.isFinite(intendedReach) ||
    !Number.isFinite(rawCurrentCapacity) ||
    intendedReach < 0 ||
    rawCurrentCapacity < 0 ||
    intendedReach > MAX_CURVE_SCALE ||
    rawCurrentCapacity > MAX_CURVE_SCALE
  ) {
    return {
      status: "unavailable",
      reason: "extreme_scale",
      message: "Threshold curve omitted above 1 trillion slots/participants to keep axis scaling exact; inspect headline scenario values directly."
    };
  }

  if (intendedReach === 0 && rawCurrentCapacity === 0) {
    return {
      status: "unavailable",
      reason: "zero_span",
      message: "Threshold curve omitted when both intended reach and capacity are zero. Increase reach or capacity to plot a capacity span."
    };
  }

  const breakEvenCapacity = intendedReach;
  const peakSlot = Math.max(breakEvenCapacity, currentCapacity);
  const maxCapacity =
    peakSlot <= 10
      ? Math.max(peakSlot + 2, 4)
      : Math.max(Math.round(breakEvenCapacity * 1.5), Math.round(currentCapacity * 1.5), 10);

  if (!Number.isFinite(maxCapacity) || maxCapacity <= 0 || maxCapacity > MAX_CURVE_SCALE) {
    return {
      status: "unavailable",
      reason: "extreme_scale",
      message: "Threshold span exceeds chart precision bounds; rely on exact headline scenario outputs."
    };
  }

  const candidates = new Set<number>([
    0,
    Math.round(maxCapacity * 0.25),
    Math.round(maxCapacity * 0.5),
    Math.round(maxCapacity * 0.75),
    maxCapacity,
    breakEvenCapacity,
    currentCapacity
  ]);

  const sorted = Array.from(candidates)
    .filter(value => Number.isFinite(value) && value >= 0)
    .sort((a, b) => a - b);

  const points: CapacityThresholdPoint[] = [];
  for (const cap of sorted) {
    let result;
    try {
      result = calculateScenario({ ...scenario, capacity: cap });
    } catch {
      return {
        status: "unavailable",
        reason: "extreme_scale",
        message: "Capacity sweep exceeded numeric limits on an evaluated slot point."
      };
    }
    points.push({
      capacity: cap,
      reachedParticipants: result.reached_participants,
      capacityGap: result.capacity_gap,
      isBreakEven: cap === breakEvenCapacity,
      isCurrent: cap === currentCapacity
    });
  }

  const maxY = Math.max(
    intendedReach,
    ...points.map(point => Math.max(point.reachedParticipants, point.capacityGap)),
    1
  );

  return {
    status: "available",
    curve: {
      intendedReach,
      rawCurrentCapacity,
      currentCapacity,
      hasFractionalRounding: rawCurrentCapacity !== currentCapacity,
      firstSufficientRawCapacity: firstSufficientRawCapacity(breakEvenCapacity),
      currentReached: baseline.reached_participants,
      currentGap: baseline.capacity_gap,
      breakEvenCapacity,
      maxCapacity,
      maxY,
      points
    }
  };
}

export function buildCapacityThresholdCurve(scenario: Scenario): CapacityThresholdCurve | null {
  const outcome = buildCapacityThresholdCurveResult(scenario);
  return outcome.status === "available" ? outcome.curve : null;
}
