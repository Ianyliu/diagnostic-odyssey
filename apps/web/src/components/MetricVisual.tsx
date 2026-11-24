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

  const width = 240;
  const toX = (pct: number) => Math.max(4, Math.min(width - 4, (pct / 100) * width));
  const zeroX = toX(geometry.zeroPercent);
  const pointX = toX(geometry.pointPercent);
  const intervalX = toX(geometry.intervalLeftPercent);
  const intervalW = Math.max(2, (geometry.intervalWidthPercent / 100) * width);
  const midpointX = toX(geometry.intervalMidpointPercent);

  return (
    <div className="metric-visual">
      <svg
        className="metric-visual-svg"
        viewBox="0 0 240 16"
        role="img"
        aria-label={aria}
        preserveAspectRatio="none"
      >
        <line className="mv-track" x1="4" y1="8" x2="236" y2="8" strokeWidth="2" strokeLinecap="round" />
        <line className="mv-zero" x1={zeroX} y1="2" x2={zeroX} y2="14" strokeWidth="1" />
        {geometry.hasInterval && (
          geometry.narrowInterval ? (
            <line
              className={`mv-narrow${intervalStyle === "range" ? " is-range" : ""}`}
              x1={midpointX}
              y1="3"
              x2={midpointX}
              y2="13"
              strokeWidth="2.5"
            />
          ) : (
            <rect
              className={`mv-interval${intervalStyle === "range" ? " is-range" : ""}`}
              x={intervalX}
              y="5"
              width={intervalW}
              height="6"
              rx="3"
            />
          )
        )}
        <circle className="mv-point" cx={pointX} cy="8" r="3.5" />
      </svg>
      <div className="metric-visual-axis" aria-hidden="true">
        <span>{formatMetricTick(geometry.min, unit, false)}</span>
        <span>{formatMetricTick(geometry.max, unit, true)}</span>
      </div>
      {(source || universe) && (
        <div className="metric-visual-meta">
          <span>{pointLabel}{geometry.hasInterval ? ` · ${intervalLabel ?? "Published interval"}` : ""}</span>
          {source && <span>{source}</span>}
        </div>
      )}
    </div>
  );
}
