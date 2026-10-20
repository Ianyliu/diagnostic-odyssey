import { formatMetricTick } from "../data/metricFormatting";
import { metricGeometry, metricAriaDescription } from "../data/metricGeometry";
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
  const geometry = metricGeometry(value, unit, low, high);
  const aria = metricAriaDescription({
    label, value, unit, low, high, intervalLabel, pointLabel, intervalStyle,
    narrowInterval: geometry.narrowInterval
  });

  return <div className="metric-visual">
    <div className="metric-visual-track" role="img" aria-label={aria}>
      <span className="metric-visual-zero" style={{left: `${geometry.zeroPercent}%`}} />
      {geometry.hasInterval && (geometry.narrowInterval
        ? <span aria-hidden="true" className={"metric-visual-narrow-interval" + (intervalStyle === "range" ? " is-range" : "")} style={{left: `${geometry.intervalMidpointPercent}%`}} />
        : <span aria-hidden="true" className={"metric-visual-interval" + (intervalStyle === "range" ? " is-range" : "")} style={{left: `${geometry.intervalLeftPercent}%`, width: `${geometry.intervalWidthPercent}%`}} />)}
      <span className="metric-visual-point" style={{left: `${geometry.pointPercent}%`}} />
    </div>
    <div className="metric-visual-axis" aria-hidden="true">
      <span>{formatMetricTick(geometry.min, unit, false)}</span>
      <span>{formatMetricTick(geometry.max, unit, true)}</span>
    </div>
    <div className="metric-visual-meta">
      <span>{pointLabel}{geometry.hasInterval ? ` · ${intervalLabel ?? "Published interval"}` : " · Interval not available"}</span>
      {source && <span>{source}</span>}
      {universe && <span>{universe}</span>}
    </div>
  </div>;
}
