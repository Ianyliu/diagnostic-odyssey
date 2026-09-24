import type { SensitivityField } from "./decisionVisuals";

const integer = new Intl.NumberFormat("en-US", {maximumFractionDigits: 0});
const decimal = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 8,
  useGrouping: false
});

export function formatSensitivityInput(
  field: SensitivityField,
  value: number
): string {
  if (field === "reach") {
    return `${decimal.format(value * 100)}% (${value.toString()})`;
  }
  if (field === "alternative_window_months") {
    return `${decimal.format(value)} mo`;
  }
  return integer.format(value);
}
