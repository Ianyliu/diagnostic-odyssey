import { formatPlanningNumber } from "./planningNumberFormatting.ts";
import type { SensitivityField } from "./decisionVisuals";

const integer = new Intl.NumberFormat("en-US", {maximumFractionDigits: 0});
const decimal = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 8,
  useGrouping: false
});

function exactDecimal(value: number): string {
  const raw = value.toString();
  if (!/[eE]/.test(raw)) return raw;

  const sign = raw.startsWith("-") ? "-" : "";
  const unsigned = sign ? raw.slice(1) : raw;
  const [coefficient = "", exponentText = "0"] =
    unsigned.toLowerCase().split("e");
  const exponent = Number(exponentText);
  const [integerPart = "", fractionalPart = ""] = coefficient.split(".");
  const digits = integerPart + fractionalPart;
  const decimalIndex = integerPart.length + exponent;

  if (decimalIndex <= 0) {
    return `${sign}0.${"0".repeat(-decimalIndex)}${digits}`;
  }
  if (decimalIndex >= digits.length) {
    return `${sign}${digits}${"0".repeat(decimalIndex - digits.length)}`;
  }
  return `${sign}${digits.slice(0, decimalIndex)}.${digits.slice(decimalIndex)}`;
}

export function formatSensitivityInput(
  field: SensitivityField,
  value: number
): string {
  if (!Number.isFinite(value) || value < 0 || (field === "reach" && value > 1)) {
    throw new Error("Cannot display an invalid sensitivity input. Correct the planning inputs first.");
  }
  if (field === "reach") {
    return `${formatPlanningNumber(value * 100, decimal)}% (${exactDecimal(value)})`;
  }
  if (field === "alternative_window_months") {
    return `${formatPlanningNumber(value, decimal)} mo`;
  }
  return formatPlanningNumber(value, integer);
}


export function getSensitivityBarWidth(
  output: number,
  maxOutput: number
): number {
  if (!Number.isFinite(output) || !Number.isFinite(maxOutput)) {
    throw new Error("Cannot display a non-finite sensitivity result. Correct the planning inputs first.");
  }
  if (output <= 0 || maxOutput <= 0) return 0;
  return Math.max(0, Math.min(100, (output / maxOutput) * 100));
}
