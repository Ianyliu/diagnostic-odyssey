import { useId } from "react";
import "./IntervalWhiskerPlot.css";
import { canExportEstimate, type Estimate } from "@diagnostic-odyssey/contracts";

const oneDecimal = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });
const VIEW_WIDTH = 480;

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
  const toX = (value: number) => Math.max(0, Math.min(VIEW_WIDTH, (value / scaleMax) * VIEW_WIDTH));

  return (
    <figure className="interval-figure" aria-labelledby={titleId}>
      <figcaption>
        <p className="visual-kicker">NATIVE-UNIT COMPARISON</p>
        <h3 id={titleId}>{title}</h3>
        <p>{description}</p>
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
          const left = toX(low);
          const width = Math.max(3, toX(high) - left);
          const cx = Math.max(6, Math.min(VIEW_WIDTH - 6, toX(value)));
          return (
            <div className="whisker-row" key={estimate.estimate_id}>
              <div className="whisker-label">
                <strong>{estimate.label.replace(/^Annualized\s+/i, "")}</strong>
                <small>
                  <span className="numeric-unit">{oneDecimal.format(value)} hours/person/yr</span> ·{" "}
                  <span className="numeric-unit">95% CI {oneDecimal.format(low)}–{oneDecimal.format(high)}</span>
                </small>
              </div>
              <svg
                className="whisker-svg"
                viewBox={`0 0 ${VIEW_WIDTH} 22`}
                preserveAspectRatio="xMidYMid meet"
                role="img"
                aria-label={`${estimate.label}: ${oneDecimal.format(value)} hours per person per year; 95% confidence interval ${oneDecimal.format(low)} to ${oneDecimal.format(high)}.`}
              >
                <rect x="0" y="8" width={VIEW_WIDTH} height="6" rx="3" className="whisker-svg-track" />
                <line x1={VIEW_WIDTH * 0.25} y1="3" x2={VIEW_WIDTH * 0.25} y2="19" className="whisker-svg-grid" />
                <line x1={VIEW_WIDTH * 0.5} y1="3" x2={VIEW_WIDTH * 0.5} y2="19" className="whisker-svg-grid" />
                <line x1={VIEW_WIDTH * 0.75} y1="3" x2={VIEW_WIDTH * 0.75} y2="19" className="whisker-svg-grid" />
                <rect x={left} y="9" width={width} height="4" rx="2" className="whisker-svg-interval" />
                <circle cx={cx} cy="11" r="5" className="whisker-svg-point" />
              </svg>
            </div>
          );
        })}
      </div>
      <p className="visual-note">Intervals come directly from the reviewed MEPS artifact and are displayed without recomputation.</p>
    </figure>
  );
}
