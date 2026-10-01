import "./MetricVisual.css";

const compactNumber = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

export function MetricVisual({
  label,
  value,
  unit,
  low = null,
  high = null,
  intervalLabel,
  source,
  universe
}: {
  label: string;
  value: number;
  unit: string;
  low?: number | null;
  high?: number | null;
  intervalLabel?: string | null;
  source?: string | null;
  universe?: string | null;
}) {
  const observedLow = typeof low === "number" ? low : value;
  const observedHigh = typeof high === "number" ? high : value;
  const min = Math.min(0, observedLow, value);
  const rawMax = Math.max(0, observedHigh, value);
  const padding = Math.max(Math.abs(rawMax - min) * 0.08, Math.abs(rawMax) * 0.04, 1e-9);
  const max = rawMax + padding;
  const span = Math.max(max - min, 1e-9);
  const pct = (x: number) => Math.max(0, Math.min(100, ((x - min) / span) * 100));
  const intervalLeft = pct(observedLow);
  const intervalWidth = Math.max(1.5, pct(observedHigh) - intervalLeft);
  const hasInterval = typeof low === "number" && typeof high === "number" && low !== high;
  const aria = hasInterval
    ? `${label}: ${compactNumber.format(value)} ${unit}; ${intervalLabel ?? "interval"} ${compactNumber.format(observedLow)} to ${compactNumber.format(observedHigh)}.`
    : `${label}: ${compactNumber.format(value)} ${unit}. No uncertainty interval is displayed.`;

  return <div className="metric-visual">
    <div className="metric-visual-track" role="img" aria-label={aria}>
      <span className="metric-visual-zero" style={{left: `${pct(0)}%`}} />
      {hasInterval && <span className="metric-visual-interval" style={{left: `${intervalLeft}%`, width: `${intervalWidth}%`}} />}
      <span className="metric-visual-point" style={{left: `${pct(value)}%`}} />
    </div>
    <div className="metric-visual-axis" aria-hidden="true">
      <span>{compactNumber.format(min)}</span>
      <span>{compactNumber.format(max)} {unit}</span>
    </div>
    <div className="metric-visual-meta">
      {hasInterval && <span>{intervalLabel ?? "Published interval"}</span>}
      {source && <span>{source}</span>}
      {universe && <span>{universe}</span>}
    </div>
  </div>;
}
