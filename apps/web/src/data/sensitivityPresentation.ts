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
  const [coefficient, exponentText] = unsigned.toLowerCase().split("e");
  const exponent = Number(exponentText);
  const [integerPart, fractionalPart = ""] = coefficient.split(".");
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
  if (field === "reach") {
    return `${decimal.format(value * 100)}% (${exactDecimal(value)})`;
  }
  if (field === "alternative_window_months") {
    return `${decimal.format(value)} mo`;
  }
  return integer.format(value);
}
