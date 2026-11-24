import { formatMetricTick } from "../data/metricFormatting";
import { metricGeometry, metricAriaDescription, type MetricScaleDomain } from "../data/metricGeometry";
import "./MetricVisual.css";

const VIEW_WIDTH = 260;

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
  compact = false,
  scaleDomain,
  standaloneNote = "Standalone unit · no cross-metric bar chart"
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
  /** Pass null explicitly to omit decorative row-local charts on standalone incompatible metrics. */
  scaleDomain?: MetricScaleDomain | null;
  standaloneNote?: string;
}) {
  if (scaleDomain === null) {
    return (
      <div className={`metric-visual metric-visual-standalone${compact ? " is-compact" : ""}`}>
        <small className="metric-visual-scale-note">{standaloneNote}</small>
      </div>
    );
  }

  const geometry = metricGeometry(value, unit, low, high, scaleDomain);
  const aria = metricAriaDescription({
    label, value, unit, low, high, intervalLabel, pointLabel, intervalStyle,
    narrowInterval: geometry.narrowInterval
  });

  const x = (pct: number) => Math.max(0, Math.min(VIEW_WIDTH, (pct / 100) * VIEW_WIDTH));
  const intervalX = x(geometry.intervalLeftPercent);
  const intervalW = Math.max(2, (geometry.intervalWidthPercent / 100) * VIEW_WIDTH);
  const pointX = Math.max(6, Math.min(VIEW_WIDTH - 6, x(geometry.pointPercent)));

  return (
    <div className={`metric-visual${compact ? " is-compact" : ""}`}>
      <svg
        className="metric-visual-svg"
        viewBox={`0 0 ${VIEW_WIDTH} 20`}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label={aria}
      >
        <rect x="0" y="6" width={VIEW_WIDTH} height="8" rx="4" className="metric-svg-track" />
        <line x1={VIEW_WIDTH * 0.25} y1="6" x2={VIEW_WIDTH * 0.25} y2="14" className="metric-svg-grid" />
        <line x1={VIEW_WIDTH * 0.5} y1="6" x2={VIEW_WIDTH * 0.5} y2="14" className="metric-svg-grid" />
        <line x1={VIEW_WIDTH * 0.75} y1="6" x2={VIEW_WIDTH * 0.75} y2="14" className="metric-svg-grid" />
        <line x1={x(geometry.zeroPercent)} y1="3" x2={x(geometry.zeroPercent)} y2="17" className="metric-svg-zero" />
        {geometry.hasInterval && (
          geometry.narrowInterval ? (
            <line
              x1={x(geometry.intervalMidpointPercent)}
              y1="2"
              x2={x(geometry.intervalMidpointPercent)}
              y2="18"
              className={`metric-svg-narrow${intervalStyle === "range" ? " is-range" : ""}`}
            />
          ) : (
            <rect
              x={intervalX}
              y={intervalStyle === "range" ? 6 : 7.5}
              width={intervalW}
              height={intervalStyle === "range" ? 8 : 5}
              rx="2.5"
              className={`metric-svg-interval${intervalStyle === "range" ? " is-range" : ""}`}
            />
          )
        )}
        <circle cx={pointX} cy="10" r="4.5" className="metric-svg-point" />
      </svg>
      {(scaleDomain || !compact) && (
        <div className="metric-visual-axis" aria-hidden="true">
          <span>{formatMetricTick(geometry.min, unit, false)}</span>
          {scaleDomain?.note && <span className="metric-visual-scale-note">{scaleDomain.note}</span>}
          <span>{formatMetricTick(geometry.max, unit, true)}</span>
        </div>
      )}
      {!compact && (
        <div className="metric-visual-meta">
          <span>{pointLabel}{geometry.hasInterval ? ` · ${intervalLabel ?? "Published interval"}` : " · Interval not available"}</span>
          {source && <span>{source}</span>}
          {universe && <span>{universe}</span>}
        </div>
      )}
    </div>
  );
}
