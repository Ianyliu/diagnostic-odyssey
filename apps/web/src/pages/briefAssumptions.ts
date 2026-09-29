import type { Scenario } from "@diagnostic-odyssey/contracts";
import type { PilotInputFieldDefinition } from "../data/pilotInputDraft";
import { formatSensitivityInput } from "../data/sensitivityPresentation.ts";

const readableNumber = new Intl.NumberFormat("en-US", { maximumFractionDigits: 20 });

function exactReadableNumber(value: number): string {
  const formatted = readableNumber.format(value);
  return Number(formatted.replaceAll(",", "")) === value ? formatted : value.toString();
}

/** Display every applied input without silently rounding a high-precision draft. */
export function formatAppliedAssumption(
  input: Scenario,
  field: PilotInputFieldDefinition
): string {
  if (field.suffix === "%") return formatSensitivityInput("reach", input.reach);
  const value = input[field.key] * field.scale;
  const formatted = exactReadableNumber(value);
  if (field.suffix === "USD") return `$${formatted}`;
  if (field.suffix === "mo") return `${formatted} months`;
  return formatted;
}
