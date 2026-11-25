import type { Scenario, ScenarioResult } from "@diagnostic-odyssey/contracts";
import { calculateScenario } from "@diagnostic-odyssey/scenario-engine";
import { PILOT_STRATEGY_PRESETS, type PilotStrategyPreset } from "./planningScenarioDefaults.ts";

export interface ScenarioComparisonRow {
  readonly id: string;
  readonly label: string;
  readonly summary: string;
  readonly isPreset: boolean;
  readonly isCurrent: boolean;
  readonly preset: PilotStrategyPreset | null;
  readonly scenario: Scenario;
  readonly result: ScenarioResult | null;
  readonly error: string | null;
  readonly deltaReached: number | null;
  readonly deltaGap: number | null;
  readonly deltaExposure: number | null;
  readonly deltaCost: number | null;
}

function cloneAndFreezeScenario(scenario: Scenario): Scenario {
  return Object.freeze({
    ...scenario,
    assumption_refs: Object.freeze([...scenario.assumption_refs]) as string[]
  });
}

function cloneAndFreezeResult(result: ScenarioResult | null): ScenarioResult | null {
  if (result === null) return null;
  return Object.freeze({
    ...result,
    ...(result.bounded_effect !== undefined
      ? { bounded_effect: Object.freeze({ ...result.bounded_effect }) }
      : {})
  });
}

function cloneAndFreezePreset(preset: PilotStrategyPreset): PilotStrategyPreset {
  return Object.freeze({
    ...preset,
    values: Object.freeze({ ...preset.values })
  });
}

export function presetMatchesScenario(preset: PilotStrategyPreset, scenario: Scenario): boolean {
  return (
    scenario.eligible_population === preset.values.eligible_population &&
    scenario.reach === preset.values.reach &&
    scenario.capacity === preset.values.capacity &&
    scenario.baseline_window_months === preset.values.baseline_window_months &&
    scenario.alternative_window_months === preset.values.alternative_window_months &&
    scenario.horizon_months === preset.values.horizon_months &&
    scenario.fixed_cost === preset.values.fixed_cost &&
    scenario.per_participant_cost === preset.values.per_participant_cost
  );
}

function safeCalculate(scenario: Scenario): { result: ScenarioResult | null; error: string | null } {
  try {
    return { result: cloneAndFreezeResult(calculateScenario(scenario)), error: null };
  } catch (err) {
    return {
      result: null,
      error: err instanceof Error ? err.message : "Scenario calculation failed"
    };
  }
}

function finiteDelta(candidate: number | undefined, baseline: number | undefined): number | null {
  if (candidate === undefined || baseline === undefined) return null;
  const diff = candidate - baseline;
  return Number.isFinite(diff) ? diff : null;
}

/** Build deeply immutable deterministic comparison rows for Strategy Lab presets and active inputs. */
export function buildScenarioComparisonRows(appliedScenario: Scenario): readonly ScenarioComparisonRow[] {
  const frozenApplied = cloneAndFreezeScenario(appliedScenario);
  const appliedEval = safeCalculate(frozenApplied);
  const appliedResult = appliedEval.result;

  const presetRows: ScenarioComparisonRow[] = PILOT_STRATEGY_PRESETS.map(preset => {
    const frozenPreset = cloneAndFreezePreset(preset);
    const candidateScenario = cloneAndFreezeScenario({
      ...frozenApplied,
      ...frozenPreset.values,
      scenario_id: frozenPreset.id
    });
    const evaluated = safeCalculate(candidateScenario);
    const isCurrent = presetMatchesScenario(frozenPreset, frozenApplied);
    const res = evaluated.result;

    return Object.freeze({
      id: frozenPreset.id,
      label: frozenPreset.label,
      summary: frozenPreset.summary,
      isPreset: true,
      isCurrent,
      preset: frozenPreset,
      scenario: candidateScenario,
      result: res,
      error: evaluated.error,
      deltaReached: isCurrent ? 0 : finiteDelta(res?.reached_participants, appliedResult?.reached_participants),
      deltaGap: isCurrent ? 0 : finiteDelta(res?.capacity_gap, appliedResult?.capacity_gap),
      deltaExposure: isCurrent ? 0 : finiteDelta(res?.difference_person_months, appliedResult?.difference_person_months),
      deltaCost: isCurrent ? 0 : finiteDelta(res?.program_resource_requirement, appliedResult?.program_resource_requirement)
    });
  });

  if (presetRows.some(row => row.isCurrent)) {
    return Object.freeze(presetRows);
  }

  const customRow: ScenarioComparisonRow = Object.freeze({
    id: "current-applied",
    label: "Current Applied Scenario",
    summary: "Custom active Strategy Lab assumptions",
    isPreset: false,
    isCurrent: true,
    preset: null,
    scenario: frozenApplied,
    result: appliedResult,
    error: appliedEval.error,
    deltaReached: appliedResult ? 0 : null,
    deltaGap: appliedResult ? 0 : null,
    deltaExposure: appliedResult ? 0 : null,
    deltaCost: appliedResult ? 0 : null
  });

  return Object.freeze([customRow, ...presetRows]);
}
