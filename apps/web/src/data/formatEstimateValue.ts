import type { Estimate } from "@diagnostic-odyssey/contracts";

const decimal = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });

export function formatEstimateValue(
  estimate: Pick<Estimate, "value" | "unit" | "release_status">
): string {
  if (estimate.value === null) {
    return estimate.release_status === "suppressed" ? "Suppressed" : "Not released";
  }

  if (estimate.unit === "proportion") {
    return new Intl.NumberFormat("en-US", {
      style: "percent",
      maximumFractionDigits: 1
    }).format(estimate.value);
  }

  if (estimate.unit === "USD/year") {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      notation: "compact",
      maximumFractionDigits: 1
    }).format(estimate.value);
  }

  if (estimate.unit === "USD/person/year") {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0
    }).format(estimate.value);
  }

  if (estimate.unit === "people") {
    return new Intl.NumberFormat("en-US", {
      notation: "compact",
      maximumFractionDigits: 1
    }).format(estimate.value);
  }

  return `${decimal.format(estimate.value)} ${estimate.unit}`;
}
