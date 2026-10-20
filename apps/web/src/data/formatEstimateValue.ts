import type { Estimate } from "@diagnostic-odyssey/contracts";

const decimal = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });
// Preserve distinctions for small rate estimates, avoiding point/CI collisions.
const smallDecimal = new Intl.NumberFormat("en-US", {minimumFractionDigits: 2, maximumFractionDigits: 2});
const tinyDecimal = new Intl.NumberFormat("en-US", {maximumSignificantDigits: 2});
function decimalFor(reference: number | null): Intl.NumberFormat {
  if (reference === null || reference === 0 || Math.abs(reference) >= 1) return decimal;
  return Math.abs(reference) >= 0.01 ? smallDecimal : tinyDecimal;
}
/** Adapt percentage display so a released nonzero rate never rounds to 0.0%.
 * Values are already in 0–1 proportion units, and neither point nor CI is recomputed.
 */
function formatProportion(value: number): string {
  const magnitude = Math.abs(value * 100);
  if (magnitude > 0 && magnitude < 1e-8) return `${(value * 100).toExponential(2)}%`;
  const digits = magnitude === 0 || magnitude >= 0.1 ? 1
    : Math.min(8, Math.max(2, Math.ceil(-Math.log10(magnitude)) + 1));
  return new Intl.NumberFormat("en-US", {
    style: "percent", minimumFractionDigits: magnitude >= 0.1 || magnitude === 0 ? 1 : 0,
    maximumFractionDigits: digits
  }).format(value);
}
const compactCurrency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  minimumFractionDigits: 1,
  maximumFractionDigits: 1
});
const personCurrency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0
});
const compactPeople = new Intl.NumberFormat("en-US", {
  notation: "compact",
  minimumFractionDigits: 1,
  maximumFractionDigits: 1
});

export function formatNativeValue(value: number, unit: string): string {
  if (unit === "proportion") return formatProportion(value);
  if (unit === "USD/year") return compactCurrency.format(value);
  if (unit === "USD/person/year") return personCurrency.format(value);
  if (unit === "people") return compactPeople.format(value);
  return `${decimalFor(value).format(value)} ${unit}`;
}

export function formatIntervalLabel(intervalType: string | null): string {
  const confidenceLevel = intervalType?.match(/(\d+(?:\.\d+)?)%/)?.[1];
  return confidenceLevel ? `${confidenceLevel}% CI` : "CI";
}

export function formatEstimateValue(
  estimate: Pick<Estimate, "value" | "unit" | "release_status">
): string {
  if (estimate.value === null) {
    return estimate.release_status === "suppressed" ? "Suppressed" : "Not released";
  }

  return formatNativeValue(estimate.value, estimate.unit);
}

export function formatEstimateInterval(
  estimate: Pick<Estimate, "interval_low" | "interval_high" | "interval_type" | "unit"> & { value?: number | null }
): string {
  const label = formatIntervalLabel(estimate.interval_type);

  if (estimate.interval_low === null || estimate.interval_high === null) {
    return `${label} not available`;
  }

  if (
    estimate.unit !== "proportion" &&
    estimate.unit !== "USD/year" &&
    estimate.unit !== "USD/person/year" &&
    estimate.unit !== "people"
  ) {
    const precision = decimalFor(typeof estimate.value === "number" ? estimate.value : estimate.interval_low);
    return `${label} ${precision.format(estimate.interval_low)}–${precision.format(estimate.interval_high)} ${estimate.unit}`;
  }

  return `${label} ${formatNativeValue(estimate.interval_low, estimate.unit)}–${formatNativeValue(estimate.interval_high, estimate.unit)}`;
}
