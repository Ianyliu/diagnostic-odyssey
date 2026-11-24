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
  readonly currentCapacity: number;
  readonly currentReached: number;
  readonly currentGap: number;
  readonly breakEvenCapacity: number;
  readonly maxCapacity: number;
  readonly maxY: number;
  readonly points: readonly CapacityThresholdPoint[];
}

const MAX_CURVE_SCALE = 1e12;

/**
 * Build deterministic capacity-sufficiency curve points via canonical calculateScenario.
 * Returns null on invalid, zero-span, or extreme-scale inputs so extreme scenarios fail closed.
 */
export function buildCapacityThresholdCurve(scenario: Scenario): CapacityThresholdCurve | null {
  let baseline;
  try {
    baseline = calculateScenario(scenario);
  } catch {
    return null;
  }

  const intendedReach = baseline.intended_reach;
  const currentCapacity = scenario.capacity;

  if (
    !Number.isFinite(intendedReach) ||
    !Number.isFinite(currentCapacity) ||
    intendedReach < 0 ||
    currentCapacity < 0 ||
    intendedReach > MAX_CURVE_SCALE ||
    currentCapacity > MAX_CURVE_SCALE ||
    (intendedReach === 0 && currentCapacity === 0)
  ) {
    return null;
  }

  const breakEvenCapacity = intendedReach;
  const maxCapacity = Math.max(
    Math.round(breakEvenCapacity * 1.5),
    Math.round(currentCapacity * 1.5),
    100
  );
  if (!Number.isFinite(maxCapacity) || maxCapacity <= 0 || maxCapacity > MAX_CURVE_SCALE) {
    return null;
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
      return null;
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
    intendedReach,
    currentCapacity,
    currentReached: baseline.reached_participants,
    currentGap: baseline.capacity_gap,
    breakEvenCapacity,
    maxCapacity,
    maxY,
    points
  };
}
