import { useId } from "react";
import "./IntervalWhiskerPlot.css";
import { canExportEstimate, type Estimate } from "@diagnostic-odyssey/contracts";

const oneDecimal = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });

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
  const pct = (value: number) => Math.max(0, Math.min(100, (value / scaleMax) * 100));

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
          const left = pct(low) * 10;
          const width = Math.max(4, pct(high) * 10 - left);
          const cx = Math.max(10, Math.min(990, pct(value) * 10));
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
                viewBox="0 0 1000 24"
                preserveAspectRatio="none"
                role="img"
                aria-label={`${estimate.label}: ${oneDecimal.format(value)} hours per person per year; 95% confidence interval ${oneDecimal.format(low)} to ${oneDecimal.format(high)}.`}
              >
                <rect x="0" y="9" width="1000" height="6" rx="3" className="whisker-svg-track" />
                <line x1="250" y1="3" x2="250" y2="21" className="whisker-svg-grid" />
                <line x1="500" y1="3" x2="500" y2="21" className="whisker-svg-grid" />
                <line x1="750" y1="3" x2="750" y2="21" className="whisker-svg-grid" />
                <rect x={left} y="10" width={width} height="4" rx="2" className="whisker-svg-interval" />
                <circle cx={cx} cy="12" r="6" className="whisker-svg-point" />
              </svg>
            </div>
          );
        })}
      </div>
      <p className="visual-note">Intervals come directly from the reviewed MEPS artifact and are displayed without recomputation.</p>
    </figure>
  );
}
