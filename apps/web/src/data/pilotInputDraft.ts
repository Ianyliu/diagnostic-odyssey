import { calculateScenario } from "@diagnostic-odyssey/scenario-engine";
import { formatPlanningCurrency, formatPlanningNumber } from "./planningNumberFormatting.ts";
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
  if (trimmed.length > 1024) return {ok: false, message: "Enter a shorter number (at most 1,024 characters)."};
  if (!completeNumberPattern.test(trimmed)) {
    return {ok: false, message: "Enter a valid number."};
  }
  const value = Number(trimmed);
  if (!Number.isFinite(value)) {
    return {ok: false, message: "Enter a valid finite number."};
  }
  if (value === 0 && /[1-9]/.test(trimmed.split(/[eE]/)[0] ?? "")) {
    return {ok: false, message: "This nonzero value is too small to represent. Enter a larger value or an explicit zero."};
  }
  return {ok: true, value};
}

function shiftDecimalPoint(raw: string, places: number): string {
  const trimmed = raw.trim();
  const sign = trimmed.startsWith("-") ? "-" : "";
  const unsigned = trimmed.startsWith("-") || trimmed.startsWith("+")
    ? trimmed.slice(1)
    : trimmed;
  const [coefficient = "", exponentText = "0"] =
    unsigned.toLowerCase().split("e");
  const exponent = Number(exponentText) + places;
  const [integerPart = "", fractionalPart = ""] = coefficient.split(".");
  const digits = (integerPart + fractionalPart) || "0";
  if (!/[1-9]/.test(digits)) return "0";
  const decimalIndex = integerPart.length + exponent;
  if (decimalIndex < -324 || decimalIndex > 309) return `${sign}${digits}e${exponent - fractionalPart.length}`;

  let plain: string;
  if (decimalIndex <= 0) {
    plain = `0.${"0".repeat(-decimalIndex)}${digits}`;
  } else if (decimalIndex >= digits.length) {
    plain = `${digits}${"0".repeat(decimalIndex - digits.length)}`;
  } else {
    plain = `${digits.slice(0, decimalIndex)}.${digits.slice(decimalIndex)}`;
  }

  let [whole = "0", fraction = ""] = plain.split(".");
  whole = whole.replace(/^0+(?=\d)/, "");
  fraction = fraction.replace(/0+$/, "");
  const normalized = fraction ? `${whole}.${fraction}` : whole;

  return /^0(?:\.0*)?$/.test(normalized) ? "0" : sign + normalized;
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
    draft[field.key] = field.key === "reach"
      ? shiftDecimalPoint(scenario[field.key].toString(), 2)
      : String(scenario[field.key]);
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
    const scaled = field.key === "reach" ? parseNumericDraft(shiftDecimalPoint(draft[field.key], -2)) : result;
    if (!scaled.ok) { errors[field.key] = scaled.message; continue; }
    parsed[field.key] = scaled.value;
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

  if (issues.length === 0 && Object.values(calculateScenario(candidate)).some(value => typeof value === "number" && !Number.isFinite(value))) {
    formError = "Calculated planning quantities exceed the supported numeric range. Reduce population, recognition windows, or program costs and try again.";
  }

  return {
    candidate: issues.length === 0 && !formError ? candidate : null,
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
      return formatPlanningNumber(value, readableNumber) + " people";
    case "reach":
      return formatPlanningNumber(value, readableNumber) + "% intended reach";
    case "capacity":
      return formatPlanningNumber(value, readableNumber) + " participants capacity";
    case "baseline_window_months":
    case "alternative_window_months":
    case "horizon_months":
      return formatPlanningNumber(value, readableNumber) + (value === 1 ? " month" : " months");
    case "fixed_cost":
      return formatPlanningCurrency(value, readableCurrency);
    case "per_participant_cost":
      return formatPlanningCurrency(value, readableCurrency) + " per participant";
  }
}

export function getPilotResultSignature(result: ScenarioResult): string {
  return JSON.stringify(result);
}

export function formatPilotResultAnnouncement(result: ScenarioResult): string {
  return [
    "Planning results updated.",
    "Reached participants " + formatPlanningNumber(result.reached_participants, readableInteger) + ".",
    "Capacity gap " + formatPlanningNumber(result.capacity_gap, readableInteger) + ".",
    "Program-resource requirement " + formatPlanningCurrency(result.program_resource_requirement, readableCurrency) + "."
  ].join(" ");
}
