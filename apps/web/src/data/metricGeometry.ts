import { formatMetricValue } from "./metricFormatting.ts";

/** The interval width is a true percentage of the plotted scale, with no minimum. */
export const NARROW_INTERVAL_THRESHOLD_PERCENT = 1.5;

export function metricGeometry(value: number, unit: string, low: number | null = null, high: number | null = null) {
  const lower = low ?? value, upper = high ?? value;
  const min = unit === "proportion" ? 0 : Math.min(0, lower, value);
  const rawMax = Math.max(0, upper, value);
  const padding = Math.max(Math.abs(rawMax - min) * 0.08, Math.abs(rawMax) * 0.04, 1e-9);
  const max = unit === "proportion" ? 1 : rawMax + padding;
  const span = Math.max(max - min, 1e-9);
  const pct = (x: number) => Math.max(0, Math.min(100, (x - min) / span * 100));
  const left = pct(lower);
  const width = Math.max(0, pct(upper) - left);
  const hasInterval = low !== null && high !== null;
  return {
    min, max, hasInterval,
    zeroPercent: pct(0), pointPercent: pct(value),
    intervalLeftPercent: left, intervalWidthPercent: width,
    intervalMidpointPercent: left + width / 2,
    narrowInterval: hasInterval && width < NARROW_INTERVAL_THRESHOLD_PERCENT
  };
}

function preciseBound(value: number, unit: string): string {
  const n = (unit === "proportion" ? value * 100 : value)
    .toLocaleString("en-US", {maximumSignificantDigits: 15});
  return unit === "proportion" ? `${n}%` : `${n} ${unit}`;
}

export function metricAriaDescription({
  label, value, unit, low = null, high = null, intervalLabel,
  pointLabel = "Published value", intervalStyle = "confidence", narrowInterval = false
}: {
  label: string; value: number; unit: string; low?: number | null; high?: number | null;
  intervalLabel?: string | null; pointLabel?: string;
  intervalStyle?: "confidence" | "range"; narrowInterval?: boolean;
}): string {
  if (low === null || high === null)
    return `${label}: ${pointLabel} ${formatMetricValue(value, unit)}. No uncertainty interval is displayed.`;
  const kind = intervalLabel ??
    (intervalStyle === "range" ? "descriptive interquartile range (not a confidence interval)" : "published confidence interval");
  const format = narrowInterval ? preciseBound : formatMetricValue;
  const qualifier = narrowInterval
    ? " Interval too narrow to show as a bar on this scale; a tick marks its position." : "";
  return `${label}: ${pointLabel} ${format(value, unit)}; ${kind} ${format(low, unit)} to ${format(high, unit)}.${qualifier}`;
}
