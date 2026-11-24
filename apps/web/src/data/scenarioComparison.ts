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
    return { result: calculateScenario(scenario), error: null };
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

/** Build read-only deterministic comparison rows for Strategy Lab presets and active inputs. */
export function buildScenarioComparisonRows(appliedScenario: Scenario): readonly ScenarioComparisonRow[] {
  const appliedEval = safeCalculate(appliedScenario);
  const appliedResult = appliedEval.result;

  const presetRows: ScenarioComparisonRow[] = PILOT_STRATEGY_PRESETS.map(preset => {
    const candidateScenario: Scenario = {
      ...appliedScenario,
      ...preset.values,
      scenario_id: preset.id
    };
    const evaluated = safeCalculate(candidateScenario);
    const isCurrent = presetMatchesScenario(preset, appliedScenario);
    const res = evaluated.result;

    return {
      id: preset.id,
      label: preset.label,
      summary: preset.summary,
      isPreset: true,
      isCurrent,
      preset,
      scenario: candidateScenario,
      result: res,
      error: evaluated.error,
      deltaReached: isCurrent ? 0 : finiteDelta(res?.reached_participants, appliedResult?.reached_participants),
      deltaGap: isCurrent ? 0 : finiteDelta(res?.capacity_gap, appliedResult?.capacity_gap),
      deltaExposure: isCurrent ? 0 : finiteDelta(res?.difference_person_months, appliedResult?.difference_person_months),
      deltaCost: isCurrent ? 0 : finiteDelta(res?.program_resource_requirement, appliedResult?.program_resource_requirement)
    };
  });

  if (presetRows.some(row => row.isCurrent)) {
    return presetRows;
  }

  const customRow: ScenarioComparisonRow = {
    id: "current-applied",
    label: "Current Applied Scenario",
    summary: "Custom active Strategy Lab assumptions",
    isPreset: false,
    isCurrent: true,
    preset: null,
    scenario: appliedScenario,
    result: appliedResult,
    error: appliedEval.error,
    deltaReached: appliedResult ? 0 : null,
    deltaGap: appliedResult ? 0 : null,
    deltaExposure: appliedResult ? 0 : null,
    deltaCost: appliedResult ? 0 : null
  };

  return [customRow, ...presetRows];
}
