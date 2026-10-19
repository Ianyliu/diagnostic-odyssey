import type { Estimate } from "@diagnostic-odyssey/contracts";

/** Use extra decimals for genuinely small nonzero values so they never display as zero. */
function precision(value: number, unit: "native" | "percent"): number {
  const magnitude = Math.abs(unit === "percent" ? value * 100 : value);
  if (magnitude === 0 || magnitude >= 1) return 1;
  if (magnitude >= .1) return 2;
  if (magnitude >= .01) return unit === "percent" ? 2 : 3;
  if (magnitude >= .001) return 3;
  if (magnitude >= .0001) return 4;
  if (magnitude >= .00001) return 5;
  return 8;
}

function formatDecimal(value: number) {
  return new Intl.NumberFormat("en-US", {maximumFractionDigits: precision(value, "native")}).format(value);
}

function formatProportion(value: number) {
  const magnitude = Math.abs(value * 100);
  if (magnitude > 0 && magnitude < 1e-8) return `${(value * 100).toExponential(2)}%`;
  return new Intl.NumberFormat("en-US", {
    style: "percent", maximumFractionDigits: precision(value, "percent")
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
  return `${formatDecimal(value)} ${unit}`;
}

function intervalLabel(intervalType: string | null): string {
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
  estimate: Pick<Estimate, "interval_low" | "interval_high" | "interval_type" | "unit">
): string {
  const label = intervalLabel(estimate.interval_type);

  if (estimate.interval_low === null || estimate.interval_high === null) {
    return `${label} not available`;
  }

  if (
    estimate.unit !== "proportion" &&
    estimate.unit !== "USD/year" &&
    estimate.unit !== "USD/person/year" &&
    estimate.unit !== "people"
  ) {
    return `${label} ${formatDecimal(estimate.interval_low)}–${formatDecimal(estimate.interval_high)} ${estimate.unit}`;
  }

  return `${label} ${formatNativeValue(estimate.interval_low, estimate.unit)}–${formatNativeValue(estimate.interval_high, estimate.unit)}`;
}
