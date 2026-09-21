import {
  validateScenario,
  type BoundedEffect,
  type Scenario,
  type ScenarioResult
} from "@diagnostic-odyssey/contracts";

export class InvalidScenarioError extends Error {
  constructor(public readonly issues: ReturnType<typeof validateScenario>) {
    super(issues.map(issue => `${issue.path}: ${issue.message}`).join("; "));
    this.name = "InvalidScenarioError";
  }
}

const participantCount = (value: number): number => Math.max(0, Math.round(value));

export function intendedReach(scenario: Scenario): number {
  return participantCount(scenario.eligible_population * scenario.reach);
}

export function reachedParticipants(scenario: Scenario): number {
  return Math.min(intendedReach(scenario), participantCount(scenario.capacity));
}

export function capacityGap(scenario: Scenario): number {
  return Math.max(0, intendedReach(scenario) - participantCount(scenario.capacity));
}

export function personMonthExposure(participants: number, windowMonths: number, horizonMonths: number): number {
  const boundedWindow = Math.min(windowMonths, horizonMonths);
  return participants * boundedWindow;
}

export function programResourceRequirement(scenario: Scenario, participants: number): {
  fixed: number;
  variable: number;
  total: number;
} {
  const fixed = scenario.fixed_cost;
  const variable = scenario.per_participant_cost * participants;
  return { fixed, variable, total: fixed + variable };
}

export function calculateScenario(scenario: Scenario): ScenarioResult {
  const issues = validateScenario(scenario);
  if (issues.length > 0) throw new InvalidScenarioError(issues);

  const intended = intendedReach(scenario);
  const reached = reachedParticipants(scenario);
  const gap = capacityGap(scenario);
  const baseline = personMonthExposure(
    reached,
    scenario.baseline_window_months,
    scenario.horizon_months
  );
  const alternative = personMonthExposure(
    reached,
    scenario.alternative_window_months,
    scenario.horizon_months
  );
  const resources = programResourceRequirement(scenario, reached);

  return {
    scenario_id: scenario.scenario_id,
    intended_reach: intended,
    reached_participants: reached,
    capacity_gap: gap,
    baseline_person_months: baseline,
    alternative_person_months: alternative,
    difference_person_months: baseline - alternative,
    fixed_program_cost: resources.fixed,
    variable_program_cost: resources.variable,
    program_resource_requirement: resources.total,
    target_pathway_step: scenario.target_pathway_step,
    target_mechanism: scenario.mechanism
  };
}

export function attachBoundedEffect(
  scenario: Scenario,
  result: ScenarioResult,
  effect: BoundedEffect
): ScenarioResult {
  if (effect.pathway_step !== scenario.target_pathway_step) {
    throw new Error("Bounded effect pathway_step does not match the scenario target pathway step.");
  }
  if (effect.target_mechanism !== scenario.mechanism) {
    throw new Error("Bounded effect target_mechanism does not match the scenario mechanism.");
  }
  return { ...result, bounded_effect: effect };
}

export interface SensitivityPoint {
  label: string;
  input_value: number;
  result: ScenarioResult;
}

export function oneWaySensitivity(
  scenario: Scenario,
  field: "reach" | "capacity" | "alternative_window_months",
  values: number[]
): SensitivityPoint[] {
  return values.map(inputValue => ({
    label: `${field}=${inputValue}`,
    input_value: inputValue,
    result: calculateScenario({ ...scenario, [field]: inputValue })
  }));
}
