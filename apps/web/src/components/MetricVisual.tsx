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
  intervalStyle?: "confidence" | "range";
}) {
  const geometry = metricGeometry(value, unit, low, high);
  const aria = metricAriaDescription({
    label, value, unit, low, high, intervalLabel, pointLabel, intervalStyle,
    narrowInterval: geometry.narrowInterval
  });

  const W = 240;
  const xZero = (geometry.zeroPercent / 100) * W;
  const xPoint = Math.max(4, Math.min(W - 4, (geometry.pointPercent / 100) * W));
  const xIntLeft = (geometry.intervalLeftPercent / 100) * W;
  const wInt = Math.max(2, (geometry.intervalWidthPercent / 100) * W);
  const xIntMid = (geometry.intervalMidpointPercent / 100) * W;

  return (
    <div className="metric-visual">
      <svg
        className="metric-visual-svg"
        viewBox={`0 0 ${W} 16`}
        role="img"
        aria-label={aria}
        preserveAspectRatio="none"
      >
        <rect x={0} y={5} width={W} height={6} rx={3} className="mv-track" />
        <line x1={xZero} y1={2} x2={xZero} y2={14} className="mv-zero" />
        {geometry.hasInterval && (geometry.narrowInterval ? (
          <line
            x1={xIntMid}
            y1={3}
            x2={xIntMid}
            y2={13}
            className={intervalStyle === "range" ? "mv-narrow is-range" : "mv-narrow"}
          />
        ) : (
          <rect
            x={xIntLeft}
            y={5}
            width={wInt}
            height={6}
            rx={3}
            className={intervalStyle === "range" ? "mv-interval is-range" : "mv-interval"}
          />
        ))}
        <circle cx={xPoint} cy={8} r={4.2} className="mv-point" />
      </svg>
      <div className="metric-visual-axis" aria-hidden="true">
        <span>{formatMetricTick(geometry.min, unit, false)}</span>
        <span>{formatMetricTick(geometry.max, unit, true)}</span>
      </div>
      {(source || universe) && (
        <div className="metric-visual-meta">
          <span>{pointLabel}{geometry.hasInterval ? ` · ${intervalLabel ?? "Published interval"}` : " · No interval"}</span>
          {source && <span>{source}</span>}
        </div>
      )}
    </div>
  );
}
