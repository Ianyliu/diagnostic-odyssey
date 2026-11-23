import type { Scenario } from "@diagnostic-odyssey/contracts";

export const PLANNING_DEFAULTS_LABEL =
  "Illustrative planning defaults — edit before use";

export const PLANNING_DEFAULTS_DESCRIPTION =
  "Analyst-supplied planning assumptions. They are not reviewed MEPS findings, local prevalence estimates, evidence-derived effects, or predicted outcomes.";

export interface PilotStrategyPreset {
  readonly id: string;
  readonly label: string;
  readonly summary: string;
  readonly values: Pick<
    Scenario,
    | "eligible_population"
    | "reach"
    | "capacity"
    | "baseline_window_months"
    | "alternative_window_months"
    | "horizon_months"
    | "fixed_cost"
    | "per_participant_cost"
  >;
}

export const PILOT_STRATEGY_PRESETS: readonly PilotStrategyPreset[] = Object.freeze([
  Object.freeze({
    id: "focused-clinic-pilot",
    label: "Focused Clinic Pilot",
    summary: "4,000 eligible · 15% reach · 600 capacity · 8 mo window",
    values: Object.freeze({
      eligible_population: 4000,
      reach: 0.15,
      capacity: 600,
      baseline_window_months: 12,
      alternative_window_months: 8,
      horizon_months: 12,
      fixed_cost: 120000,
      per_participant_cost: 220
    })
  }),
  Object.freeze({
    id: "regional-navigation-program",
    label: "Regional Navigation Program",
    summary: "12,000 eligible · 25% reach · 3,000 capacity · 6 mo window",
    values: Object.freeze({
      eligible_population: 12000,
      reach: 0.25,
      capacity: 3000,
      baseline_window_months: 12,
      alternative_window_months: 6,
      horizon_months: 12,
      fixed_cost: 300000,
      per_participant_cost: 300
    })
  }),
  Object.freeze({
    id: "high-demand-stress-test",
    label: "High-Demand Stress Test",
    summary: "18,000 eligible · 35% reach · 3,000 capacity · shows capacity gap",
    values: Object.freeze({
      eligible_population: 18000,
      reach: 0.35,
      capacity: 3000,
      baseline_window_months: 12,
      alternative_window_months: 6,
      horizon_months: 12,
      fixed_cost: 300000,
      per_participant_cost: 300
    })
  })
]);

const defaults: Scenario = {
  scenario_id: "illustrative-navigation-pilot-default",
  eligible_population: 12000,
  reach: 0.25,
  capacity: 3000,
  baseline_window_months: 12,
  alternative_window_months: 6,
  horizon_months: 12,
  fixed_cost: 300000,
  per_participant_cost: 300,
  target_pathway_step: "recognition-to-referral",
  mechanism: "navigation-support",
  assumption_refs: ["illustrative-planning-defaults-2026-09-v1"],
  artifact_version: "planning-assumptions-2026-09-v1"
};

export function createPlanningScenarioDefaults(): Scenario {
  return {
    ...defaults,
    assumption_refs: [...defaults.assumption_refs]
  };
}
