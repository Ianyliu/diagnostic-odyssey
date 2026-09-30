import {
  canDisplayDistributionSummary,
  type Estimate
} from "@diagnostic-odyssey/contracts";
import { formatNativeValue } from "../data/formatEstimateValue";

export function DistributionSummaryText({estimate}: {estimate: Estimate}) {
  if (!canDisplayDistributionSummary(estimate)) return null;

  const summary = estimate.distribution_summary;
  if (!summary) return null;

  return <span className="distribution-summary">
    <span className="distribution-mean"><strong>Mean:</strong> {formatNativeValue(estimate.value as number, estimate.unit)}</span>
    <span className="distribution-range">
      <strong>Typical Range (25th–75th percentile):</strong>{" "}
      {formatNativeValue(summary.p25, estimate.unit)}–{formatNativeValue(summary.p75, estimate.unit)}
    </span>
    <span className="distribution-median"><strong>Median:</strong> {formatNativeValue(summary.p50, estimate.unit)}</span>
  </span>;
}
