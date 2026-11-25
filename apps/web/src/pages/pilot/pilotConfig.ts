import type { PilotNumericField } from "../../data/pilotInputDraft";

export interface SliderSpec {
  key: PilotNumericField;
  shortLabel: string;
  min: number;
  max: number;
  step: number;
}

export const SLIDERS: readonly SliderSpec[] = [
  { key: "reach", shortLabel: "Intended reach", min: 0, max: 100, step: 1 },
  { key: "capacity", shortLabel: "Program capacity", min: 200, max: 8000, step: 100 },
  { key: "alternative_window_months", shortLabel: "Planning recognition window", min: 1, max: 12, step: 1 },
  { key: "per_participant_cost", shortLabel: "Cost per participant", min: 50, max: 1000, step: 25 }
];

export const EXTRA_FIELDS: readonly PilotNumericField[] = [
  "eligible_population",
  "baseline_window_months",
  "horizon_months",
  "fixed_cost"
];

export type BottomTab = "sensitivity" | "compare" | "quantities" | "context";
export const BOTTOM_TABS: readonly { id: BottomTab; label: string }[] = [
  { id: "sensitivity", label: "Sensitivity" },
  { id: "compare", label: "Compare Strategies" },
  { id: "quantities", label: "All Quantities" },
  { id: "context", label: "Context & Requests" }
];
