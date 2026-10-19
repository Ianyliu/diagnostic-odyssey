import { formatMetricTick, formatMetricValue } from "../data/metricFormatting";
import "./MetricVisual.css";

export function MetricVisual({
  label,
  value,
  unit,
  low = null,
  high = null,
  intervalLabel,
  pointLabel = "Published value",
  source,
  universe,
  intervalStyle = "confidence"
}: {
  label: string;
  value: number;
  unit: string;
  low?: number | null;
  high?: number | null;
  intervalLabel?: string | null;
  pointLabel?: string;
  source?: string | null;
  universe?: string | null;
  /** Descriptive spread is never encoded as a sampling confidence interval. */
  intervalStyle?: "confidence" | "range";
}) {
  const observedLow = typeof low === "number" ? low : value;
  const observedHigh = typeof high === "number" ? high : value;
  // All proportions share the honest 0–100% visual scale.
  const min = unit === "proportion" ? 0 : Math.min(0, observedLow, value);
  const rawMax = Math.max(0, observedHigh, value);
  const padding = Math.max(Math.abs(rawMax - min) * 0.08, Math.abs(rawMax) * 0.04, 1e-9);
  const max = unit === "proportion" ? 1 : rawMax + padding;
  const span = Math.max(max - min, 1e-9);
  const pct = (x: number) => Math.max(0, Math.min(100, ((x - min) / span) * 100));
  const intervalLeft = pct(observedLow);
  const intervalWidth = Math.max(1.5, pct(observedHigh) - intervalLeft);
  const hasInterval = typeof low === "number" && typeof high === "number";
  const aria = hasInterval
    ? `${label}: ${pointLabel} ${formatMetricValue(value, unit)}; ${intervalLabel ?? "published interval"} ${formatMetricValue(observedLow, unit)} to ${formatMetricValue(observedHigh, unit)}.`
    : `${label}: ${pointLabel} ${formatMetricValue(value, unit)}. No uncertainty interval is displayed.`;

  return <div className="metric-visual">
    <div className="metric-visual-track" role="img" aria-label={aria}>
      <span className="metric-visual-zero" style={{left: `${pct(0)}%`}} />
      {hasInterval && <span className={"metric-visual-interval" + (intervalStyle === "range" ? " is-range" : "")} style={{left: `${intervalLeft}%`, width: `${intervalWidth}%`}} />}
      <span className="metric-visual-point" style={{left: `${pct(value)}%`}} />
    </div>
    <div className="metric-visual-axis" aria-hidden="true">
      <span>{formatMetricTick(min, unit, false)}</span>
      <span>{formatMetricTick(max, unit, true)}</span>
    </div>
    <div className="metric-visual-meta">
      <span>{pointLabel}{hasInterval ? ` · ${intervalLabel ?? "Published interval"}` : " · Interval not available"}</span>
      {source && <span>{source}</span>}
      {universe && <span>{universe}</span>}
    </div>
  </div>;
}
