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
  intervalStyle = "confidence",
  compact = false
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
  compact?: boolean;
}) {
  const geometry = metricGeometry(value, unit, low, high);
  const aria = metricAriaDescription({
    label, value, unit, low, high, intervalLabel, pointLabel, intervalStyle,
    narrowInterval: geometry.narrowInterval
  });

  const x = (pct: number) => Math.max(0, Math.min(1000, pct * 10));
  const intervalX = x(geometry.intervalLeftPercent);
  const intervalW = Math.max(2, geometry.intervalWidthPercent * 10);
  const pointX = Math.max(12, Math.min(988, x(geometry.pointPercent)));

  return (
    <div className={`metric-visual${compact ? " is-compact" : ""}`}>
      <svg
        className="metric-visual-svg"
        viewBox="0 0 1000 28"
        preserveAspectRatio="none"
        role="img"
        aria-label={aria}
      >
        <rect x="0" y="8" width="1000" height="12" rx="6" className="metric-svg-track" />
        <line x1="250" y1="8" x2="250" y2="20" className="metric-svg-grid" />
        <line x1="500" y1="8" x2="500" y2="20" className="metric-svg-grid" />
        <line x1="750" y1="8" x2="750" y2="20" className="metric-svg-grid" />
        <line x1={x(geometry.zeroPercent)} y1="5" x2={x(geometry.zeroPercent)} y2="23" className="metric-svg-zero" />
        {geometry.hasInterval && (
          geometry.narrowInterval ? (
            <line
              x1={x(geometry.intervalMidpointPercent)}
              y1="3"
              x2={x(geometry.intervalMidpointPercent)}
              y2="25"
              className={`metric-svg-narrow${intervalStyle === "range" ? " is-range" : ""}`}
            />
          ) : (
            <rect
              x={intervalX}
              y={intervalStyle === "range" ? 9 : 11}
              width={intervalW}
              height={intervalStyle === "range" ? 10 : 6}
              rx="3"
              className={`metric-svg-interval${intervalStyle === "range" ? " is-range" : ""}`}
            />
          )
        )}
        <circle cx={pointX} cy="14" r="6" className="metric-svg-point" />
      </svg>
      {!compact && (
        <>
          <div className="metric-visual-axis" aria-hidden="true">
            <span>{formatMetricTick(geometry.min, unit, false)}</span>
            <span>{formatMetricTick(geometry.max, unit, true)}</span>
          </div>
          <div className="metric-visual-meta">
            <span>{pointLabel}{geometry.hasInterval ? ` · ${intervalLabel ?? "Published interval"}` : " · Interval not available"}</span>
            {source && <span>{source}</span>}
            {universe && <span>{universe}</span>}
          </div>
        </>
      )}
    </div>
  );
}
