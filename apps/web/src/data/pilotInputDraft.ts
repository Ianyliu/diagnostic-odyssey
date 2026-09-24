import {
  validateScenario,
  type Scenario,
  type ScenarioResult
} from "@diagnostic-odyssey/contracts";

export type PilotNumericField =
  | "eligible_population"
  | "reach"
  | "capacity"
  | "baseline_window_months"
  | "alternative_window_months"
  | "horizon_months"
  | "fixed_cost"
  | "per_participant_cost";

export interface PilotInputFieldDefinition {
  key: PilotNumericField;
  label: string;
  scale: number;
  suffix: string | null;
}

export const pilotInputFields: readonly PilotInputFieldDefinition[] = [
  {key: "eligible_population", label: "Potentially eligible", scale: 1, suffix: null},
  {key: "reach", label: "Intended reach", scale: 100, suffix: "%"},
  {key: "capacity", label: "Program capacity", scale: 1, suffix: null},
  {key: "baseline_window_months", label: "Baseline recognition window", scale: 1, suffix: "mo"},
  {key: "alternative_window_months", label: "Planning recognition window", scale: 1, suffix: "mo"},
  {key: "horizon_months", label: "Planning horizon", scale: 1, suffix: "mo"},
  {key: "fixed_cost", label: "Fixed program cost", scale: 1, suffix: "USD"},
  {key: "per_participant_cost", label: "Cost per participant", scale: 1, suffix: "USD"}
];

export type PilotInputDraft = Record<PilotNumericField, string>;
export type PilotDraftErrors = Partial<Record<PilotNumericField, string>>;

export interface PilotDraftEvaluation {
  candidate: Scenario | null;
  errors: PilotDraftErrors;
  formError: string | null;
}

type ParsedDraftNumber =
  | {ok: true; value: number}
  | {ok: false; message: string};

const completeNumberPattern =
  /^[+-]?(?:\d+(?:\.\d+)?|\.\d+)(?:[eE][+-]?\d+)?$/;

const readableNumber = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 10
});

const readableCurrency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2
});

const readableInteger = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 0
});

function parseNumericDraft(raw: string): ParsedDraftNumber {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return {ok: false, message: "Enter a value."};
  }
  if (!completeNumberPattern.test(trimmed)) {
    return {ok: false, message: "Enter a valid number."};
  }
  const value = Number(trimmed);
  if (!Number.isFinite(value)) {
    return {ok: false, message: "Enter a valid finite number."};
  }
  return {ok: true, value};
}

function isPilotNumericField(value: string): value is PilotNumericField {
  return pilotInputFields.some(field => field.key === value);
}

function presentValidationMessage(
  field: PilotNumericField,
  message: string
): string {
  if (field === "reach" && message === "must be a proportion between 0 and 1") {
    return "Enter a percentage from 0 to 100.";
  }
  if (
    field === "alternative_window_months" &&
    message === "cannot exceed baseline window"
  ) {
    return "Planning recognition window cannot exceed baseline recognition window.";
  }
  if (message === "must be a non-negative finite number") {
    return "Enter a non-negative number.";
  }
  const sentence = message.charAt(0).toUpperCase() + message.slice(1);
  return sentence.endsWith(".") ? sentence : sentence + ".";
}

export function createPilotInputDraft(scenario: Scenario): PilotInputDraft {
  const draft = {} as PilotInputDraft;
  for (const field of pilotInputFields) {
    draft[field.key] = String(scenario[field.key] * field.scale);
  }
  return draft;
}

export function evaluatePilotInputDraft(
  draft: PilotInputDraft,
  baseScenario: Scenario
): PilotDraftEvaluation {
  const parsed = {} as Record<PilotNumericField, number>;
  const errors: PilotDraftErrors = {};

  for (const field of pilotInputFields) {
    const result = parseNumericDraft(draft[field.key]);
    if (!result.ok) {
      errors[field.key] = result.message;
      continue;
    }
    parsed[field.key] = result.value / field.scale;
  }

  if (Object.keys(errors).length > 0) {
    return {candidate: null, errors, formError: null};
  }

  const candidate: Scenario = {
    ...baseScenario,
    eligible_population: parsed.eligible_population,
    reach: parsed.reach,
    capacity: parsed.capacity,
    baseline_window_months: parsed.baseline_window_months,
    alternative_window_months: parsed.alternative_window_months,
    horizon_months: parsed.horizon_months,
    fixed_cost: parsed.fixed_cost,
    per_participant_cost: parsed.per_participant_cost
  };

  const issues = validateScenario(candidate);
  let formError: string | null = null;

  for (const issue of issues) {
    const pathPart = issue.path.startsWith("scenario.")
      ? issue.path.slice("scenario.".length)
      : issue.path;
    if (isPilotNumericField(pathPart)) {
      errors[pathPart] = presentValidationMessage(pathPart, issue.message);
    } else if (!formError) {
      formError = issue.message;
    }
  }

  return {
    candidate: issues.length === 0 ? candidate : null,
    errors,
    formError
  };
}

export function formatPilotInputHelper(
  field: PilotNumericField,
  raw: string
): string | null {
  const parsed = parseNumericDraft(raw);
  if (!parsed.ok) return null;

  const value = parsed.value;
  switch (field) {
    case "eligible_population":
      return readableNumber.format(value) + " people";
    case "reach":
      return readableNumber.format(value) + "% intended reach";
    case "capacity":
      return readableNumber.format(value) + " participants capacity";
    case "baseline_window_months":
    case "alternative_window_months":
    case "horizon_months":
      return readableNumber.format(value) + (value === 1 ? " month" : " months");
    case "fixed_cost":
      return readableCurrency.format(value);
    case "per_participant_cost":
      return readableCurrency.format(value) + " per participant";
  }
}

export function getPilotResultSignature(result: ScenarioResult): string {
  return JSON.stringify(result);
}

export function formatPilotResultAnnouncement(result: ScenarioResult): string {
  return [
    "Planning results updated.",
    "Reached participants " + readableInteger.format(result.reached_participants) + ".",
    "Capacity gap " + readableInteger.format(result.capacity_gap) + ".",
    "Program-resource requirement " + readableCurrency.format(result.program_resource_requirement) + "."
  ].join(" ");
}
