import type { Scenario } from "@diagnostic-odyssey/contracts";

export const PLANNING_DEFAULTS_LABEL =
  "Illustrative planning defaults — edit before use";

export const PLANNING_DEFAULTS_DESCRIPTION =
  "Analyst-supplied planning assumptions. They are not reviewed MEPS findings, local prevalence estimates, evidence-derived effects, or predicted outcomes.";

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
