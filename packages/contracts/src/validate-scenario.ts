import { isRecord, isNonEmptyString } from "./guards.ts";
import type { ValidationIssue } from "./types.ts";

export function validateScenario(value: unknown, path = "scenario"): ValidationIssue[] {
  if (!isRecord(value)) return [{ path, message: "must be an object" }];
  const issues: ValidationIssue[] = [];
  for (const key of ["scenario_id", "target_pathway_step", "mechanism", "artifact_version"]) {
    if (!isNonEmptyString(value[key])) issues.push({ path: `${path}.${key}`, message: "must be a non-empty string" });
  }

  const nonNegative = [
    "eligible_population", "capacity", "baseline_window_months", "alternative_window_months",
    "horizon_months", "fixed_cost", "per_participant_cost"
  ];
  for (const key of nonNegative) {
    if (typeof value[key] !== "number" || !Number.isFinite(value[key]) || (value[key] as number) < 0) {
      issues.push({ path: `${path}.${key}`, message: "must be a non-negative finite number" });
    }
  }

  if (typeof value.reach !== "number" || !Number.isFinite(value.reach) || value.reach < 0 || value.reach > 1) {
    issues.push({ path: `${path}.reach`, message: "must be a proportion between 0 and 1" });
  }
  if (typeof value.alternative_window_months === "number" &&
      typeof value.baseline_window_months === "number" &&
      value.alternative_window_months > value.baseline_window_months) {
    issues.push({ path: `${path}.alternative_window_months`, message: "cannot exceed baseline window" });
  }
  return issues;
}

/** Reject invalid calculated quantities before presentation or JSON serialization. */
export function validateScenarioResult(value: unknown, path = "scenario_result"): ValidationIssue[] {
  if (!isRecord(value)) return [{ path, message: "must be an object" }];
  const issues: ValidationIssue[] = [];
  for (const key of [
    "intended_reach", "reached_participants", "capacity_gap", "baseline_person_months",
    "alternative_person_months", "difference_person_months", "fixed_program_cost",
    "variable_program_cost", "program_resource_requirement"
  ]) {
    if (typeof value[key] !== "number" || !Number.isFinite(value[key]) || (value[key] as number) < 0) {
      issues.push({ path: `${path}.${key}`, message: "must be a non-negative finite calculated number" });
    }
  }
  if (value.bounded_effect !== undefined) {
    if (!isRecord(value.bounded_effect)) {
      issues.push({ path: `${path}.bounded_effect`, message: "must be an object" });
    } else {
      for (const key of ["value_low", "value_high"]) {
        if (typeof value.bounded_effect[key] !== "number" || !Number.isFinite(value.bounded_effect[key])) {
          issues.push({ path: `${path}.bounded_effect.${key}`, message: "must be a finite number" });
        }
      }
    }
  }
  return issues;
}
