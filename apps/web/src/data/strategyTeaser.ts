import type { Scenario } from "@diagnostic-odyssey/contracts";
import { createPlanningScenarioDefaults, type PilotStrategyPreset } from "./planningScenarioDefaults.ts";

/** Independent preview. Only an explicit UI action can apply this to workspace state. */
export function createTeaserScenario(preset: PilotStrategyPreset, reachPercent: number): Scenario {
  if (!Number.isFinite(reachPercent) || reachPercent < 0 || reachPercent > 100) {
    throw new RangeError("Intended reach must be between 0 and 100 percent.");
  }
  const base = createPlanningScenarioDefaults();
  return { ...base, ...preset.values, scenario_id: preset.id, reach: reachPercent / 100,
    assumption_refs: [...base.assumption_refs] };
}
