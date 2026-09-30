import {
  canDisplayDistributionSummary,
  canExportEstimate,
  type Estimate
} from "@diagnostic-odyssey/contracts";
import {
  formatEstimateInterval,
  formatEstimateValue
} from "../data/formatEstimateValue";
import { formatReleaseStatusLabel } from "../data/presentationLabels";
import { DistributionSummaryText } from "./DistributionSummaryText";
import { MetricVisual } from "./MetricVisual";

function EstimateIntervalText({estimate}: {estimate: Estimate}) {
  if (!canExportEstimate(estimate)) return null;

  const interval = formatEstimateInterval(estimate);
  const accessibleInterval = interval
    .replace(/^(\d+(?:\.\d+)?)% CI\s*/, "$1% confidence interval: ")
    .replace(/^CI\s*/, "Confidence interval: ");

  return <small className="measure-interval">
    <span aria-hidden="true">{interval}</span>
    <span className="sr-only">{accessibleInterval}</span>
  </small>;
}

export function BurdenMeasureList({estimates}: {estimates: Estimate[]}) {
  const parentLabels = new Map(
    estimates.map(estimate => [estimate.measure_id, estimate.label])
  );

  return <div className="measure-list burden-measure-list">
    {estimates.map(estimate => {
      const reviewed = canExportEstimate(estimate);
      const parentLabel = estimate.component_of_measure_id
        ? parentLabels.get(estimate.component_of_measure_id)
        : null;

      return <article className="measure burden-measure-row" aria-labelledby={`burden-measure-${estimate.estimate_id}`} key={estimate.estimate_id}>
        <div className="burden-measure-summary">
          <h3 id={`burden-measure-${estimate.estimate_id}`}>{estimate.label}</h3>
          {estimate.component_of_measure_id && <span className="component-note">
            Component of {parentLabel ?? "a parent measure"} — do not add this value to the parent total.
          </span>}
        </div>

        <div className="measure-value">
          {canDisplayDistributionSummary(estimate)
            ? <DistributionSummaryText estimate={estimate} />
            : formatEstimateValue(estimate)}
          <EstimateIntervalText estimate={estimate} />
          {typeof estimate.value === "number" && <MetricVisual
            label={estimate.label}
            value={estimate.distribution_summary?.p50 ?? estimate.value}
            unit={estimate.unit}
            low={estimate.distribution_summary?.p25 ?? estimate.interval_low}
            high={estimate.distribution_summary?.p75 ?? estimate.interval_high}
            intervalLabel={estimate.distribution_summary ? "Interquartile range" : estimate.interval_type}
            source={estimate.source_ref}
            universe={estimate.universe}
          />}
          {!reviewed && <small className="measure-release-status">
            {formatReleaseStatusLabel(estimate.release_status)}
          </small>}
        </div>

        <details className="burden-measure-details technical-disclosure">
          <summary>Interpretation and technical details</summary>
          <dl className="technical-detail-list">
            <div>
              <dt>What this estimate describes</dt>
              <dd>{estimate.allowed_interpretation}</dd>
            </div>
            <div>
              <dt>Population / universe</dt>
              <dd>{estimate.universe}</dd>
            </div>
            <div>
              <dt>Denominator</dt>
              <dd>{estimate.denominator}</dd>
            </div>
            <div>
              <dt>System boundary</dt>
              <dd>{estimate.system_boundary}</dd>
            </div>
            <div>
              <dt>Source</dt>
              <dd>{estimate.source_ref}</dd>
            </div>
            <div>
              <dt>Release status</dt>
              <dd>{formatReleaseStatusLabel(estimate.release_status)}</dd>
            </div>
            {estimate.source_locator && <div>
              <dt>Source locator</dt>
              <dd>{estimate.source_locator}</dd>
            </div>}
            {estimate.statistics_method && <div>
              <dt>Statistical method</dt>
              <dd>{estimate.statistics_method}</dd>
            </div>}
            {estimate.weight_variable && <div>
              <dt>Weight variable</dt>
              <dd>{estimate.weight_variable}</dd>
            </div>}
          </dl>
        </details>
      </article>;
    })}
  </div>;
}
