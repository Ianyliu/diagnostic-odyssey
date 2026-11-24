import { useId } from "react";
import "./IntervalWhiskerPlot.css";
import { canExportEstimate, type Estimate } from "@diagnostic-odyssey/contracts";

const oneDecimal = new Intl.NumberFormat("en-US", {maximumFractionDigits: 1});

export function IntervalWhiskerPlot({
  estimates,
  title,
  description
}: {
  estimates: Estimate[];
  title: string;
  description: string;
}) {
  const titleId = useId();
  const rows = estimates.filter(estimate =>
    canExportEstimate(estimate) &&
    typeof estimate.value === "number" &&
    typeof estimate.interval_low === "number" &&
    typeof estimate.interval_high === "number"
  );
  if (rows.length < 2) return null;

  const rawMax = Math.max(...rows.map(estimate => estimate.interval_high as number));
  const scaleMax = Math.max(1, Math.ceil(rawMax / 25) * 25);
  const W = 320;
  const xPos = (value: number) => Math.max(0, Math.min(W, (value / scaleMax) * W));

  return (
    <figure className="interval-figure" aria-labelledby={titleId}>
      <figcaption>
        <p className="visual-kicker">NATIVE-UNIT COMPARISON</p>
        <h3 id={titleId}>{title}</h3>
        <p className="subtle">{description}</p>
      </figcaption>
      <div className="whisker-axis-row" aria-hidden="true">
        <span />
        <div className="whisker-axis"><span>0</span><span>{scaleMax} hours/person/year</span></div>
      </div>
      <div className="whisker-plot">
        {rows.map(estimate => {
          const low = estimate.interval_low as number;
          const high = estimate.interval_high as number;
          const value = estimate.value as number;
          const xLow = xPos(low);
          const xHigh = xPos(high);
          const xVal = Math.max(4, Math.min(W - 4, xPos(value)));
          return (
            <div className="whisker-row" key={estimate.estimate_id}>
              <div className="whisker-label">
                <strong>{estimate.label.replace(/^Annualized\s+/i, "")}</strong>
                <small>
                  <span className="numeric-unit">{oneDecimal.format(value)} h</span> ·{" "}
                  <span className="numeric-unit">95% CI {oneDecimal.format(low)}–{oneDecimal.format(high)}</span>
                </small>
              </div>
              <svg
                className="whisker-svg"
                viewBox={`0 0 ${W} 20`}
                role="img"
                aria-label={`${estimate.label}: ${oneDecimal.format(value)} hours per person per year; 95% confidence interval ${oneDecimal.format(low)} to ${oneDecimal.format(high)}.`}
                preserveAspectRatio="none"
              >
                <rect x={0} y={7} width={W} height={6} rx={3} className="whisker-track-bg" />
                <line x1={xLow} y1={10} x2={xHigh} y2={10} className="whisker-interval-line" />
                <line x1={xLow} y1={5} x2={xLow} y2={15} className="whisker-cap" />
                <line x1={xHigh} y1={5} x2={xHigh} y2={15} className="whisker-cap" />
                <circle cx={xVal} cy={10} r={4.5} className="whisker-point-dot" />
              </svg>
            </div>
          );
        })}
      </div>
      <p className="micro-caption">95% confidence intervals preserved directly from reviewed MEPS.</p>
    </figure>
  );
}
