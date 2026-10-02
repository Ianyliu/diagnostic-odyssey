import { formatNativeValue } from "./formatEstimateValue.ts";

/** A chart tick must preserve the source's native scale, especially 0–1 proportions. */
export function formatMetricValue(value: number, unit: string): string {
  if (unit === "proportion") {
    const magnitude = Math.abs(value * 100);
    if (magnitude > 0 && magnitude < 1e-8) return `${(value * 100).toExponential(2)}%`;
    const digits = magnitude >= 1 ? 1 : magnitude >= .01 ? 2 : magnitude >= .0001 ? 4 : 8;
    return new Intl.NumberFormat("en-US", {
      style: "percent",
      maximumFractionDigits: digits
    }).format(value);
  }
  if (unit === "percent") {
    return `${value.toLocaleString("en-US", {minimumFractionDigits: 1, maximumFractionDigits: 1})}%`;
  }
  if (unit === "designations") return value.toLocaleString("en-US", {maximumFractionDigits: 0});
  if (unit === "HPSA score points") return `${value.toLocaleString("en-US", {maximumFractionDigits: 1})} points`;
  if (unit === "USD/year" || unit === "USD/person/year" || unit === "people") {
    return formatNativeValue(value, unit);
  }
  if (Math.abs(value) > 0 && Math.abs(value) < 1e-6) {
    return `${value.toExponential(2)} ${unit}`;
  }
  const precision = Math.abs(value) < 1 ? 3 : 1;
  return `${value.toLocaleString("en-US", {maximumFractionDigits: precision})} ${unit}`;
}
