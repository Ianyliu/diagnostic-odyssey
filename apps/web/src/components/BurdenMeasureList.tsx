import { useState } from "react";
import {
  canDisplayDistributionSummary,
  canExportEstimate,
  type Estimate
} from "@diagnostic-odyssey/contracts";
import {
  formatEstimateInterval,
  formatEstimateValue,
  formatIntervalLabel
} from "../data/formatEstimateValue";
import { formatReleaseStatusLabel } from "../data/presentationLabels";
import { DetailDrawer } from "./DetailDrawer";
import { DistributionSummaryText } from "./DistributionSummaryText";
import { MetricVisual } from "./MetricVisual";

function EstimateIntervalText({ estimate }: { estimate: Estimate }) {
  if (!canExportEstimate(estimate)) return null;

  const interval = formatEstimateInterval(estimate);
  const accessibleInterval = interval
    .replace(/^(\d+(?:\.\d+)?)% CI\s*/, "$1% confidence interval: ")
    .replace(/^CI\s*/, "Confidence interval: ");

  return (
    <small className="measure-interval">
      <span aria-hidden="true">{interval}</span>
      <span className="sr-only">{accessibleInterval}</span>
    </small>
  );
}

export function BurdenMeasureList({ estimates }: { estimates: Estimate[] }) {
  const [activeEstimate, setActiveEstimate] = useState<Estimate | null>(null);
  const parentLabels = new Map(
    estimates.map(estimate => [estimate.measure_id, estimate.label])
  );

  return (
    <>
      <div className="measure-list burden-measure-list">
        {estimates.map(estimate => {
          const reviewed = canExportEstimate(estimate);
          const parentLabel = estimate.component_of_measure_id
            ? parentLabels.get(estimate.component_of_measure_id)
            : null;

          return (
            <article
              className="measure burden-measure-row atlas-metric-row"
              aria-labelledby={`burden-measure-${estimate.estimate_id}`}
              key={estimate.estimate_id}
            >
              <div className="burden-measure-summary">
                <h3 id={`burden-measure-${estimate.estimate_id}`}>{estimate.label}</h3>
                {estimate.component_of_measure_id && (
                  <span className="component-note">
                    Nested in {parentLabel ?? "parent total"} · do not add.
                  </span>
                )}
                <button
                  type="button"
                  className="atlas-detail-trigger"
                  onClick={() => setActiveEstimate(estimate)}
                >
                  Details &amp; 95% CI ↗
                </button>
              </div>

              <div className="measure-value">
                <div className="atlas-measure-figure">
                  {canDisplayDistributionSummary(estimate)
                    ? <DistributionSummaryText estimate={estimate} />
                    : formatEstimateValue(estimate)}
                </div>
                <EstimateIntervalText estimate={estimate} />
                {reviewed && typeof estimate.value === "number" && (
                  <MetricVisual
                    label={estimate.label}
                    value={estimate.value}
                    unit={estimate.unit}
                    low={estimate.distribution_summary?.p25 ?? estimate.interval_low}
                    high={estimate.distribution_summary?.p75 ?? estimate.interval_high}
                    intervalLabel={
                      estimate.distribution_summary
                        ? "IQR (25th–75th percentile)"
                        : formatIntervalLabel(estimate.interval_type)
                    }
                    intervalStyle={estimate.distribution_summary ? "range" : "confidence"}
                    pointLabel={estimate.distribution_summary ? "Survey mean" : "Point estimate"}
                    compact
                  />
                )}
                {!reviewed && (
                  <small className="measure-release-status">
                    {formatReleaseStatusLabel(estimate.release_status)}
                  </small>
                )}
              </div>
            </article>
          );
        })}
      </div>

      <DetailDrawer
        open={activeEstimate !== null}
        eyebrow="MEPS 2024 · MEASURE PROVENANCE"
        title={activeEstimate?.label ?? ""}
        onClose={() => setActiveEstimate(null)}
      >
        {activeEstimate && (
          <>
            <div className="atlas-drawer-stat">
              <strong>
                {canDisplayDistributionSummary(activeEstimate)
                  ? <DistributionSummaryText estimate={activeEstimate} />
                  : formatEstimateValue(activeEstimate)}
              </strong>
              <span>{formatEstimateInterval(activeEstimate)}</span>
            </div>

            <dl className="atlas-drawer-list">
              <div>
                <dt>Allowed interpretation</dt>
                <dd>{activeEstimate.allowed_interpretation}</dd>
              </div>
              <div>
                <dt>Population / universe</dt>
                <dd>{activeEstimate.universe}</dd>
              </div>
              <div>
                <dt>Denominator</dt>
                <dd>{activeEstimate.denominator}</dd>
              </div>
              <div>
                <dt>System boundary</dt>
                <dd>{activeEstimate.system_boundary}</dd>
              </div>
              <div>
                <dt>Source</dt>
                <dd>{activeEstimate.source_ref}</dd>
              </div>
              {activeEstimate.source_locator && (
                <div>
                  <dt>Source locator</dt>
                  <dd>{activeEstimate.source_locator}</dd>
                </div>
              )}
              <div>
                <dt>Release status</dt>
                <dd>{formatReleaseStatusLabel(activeEstimate.release_status)}</dd>
              </div>
              {activeEstimate.statistics_method && (
                <div>
                  <dt>Statistical method</dt>
                  <dd>{activeEstimate.statistics_method}</dd>
                </div>
              )}
              {activeEstimate.weight_variable && (
                <div>
                  <dt>Weight variable</dt>
                  <dd>{activeEstimate.weight_variable}</dd>
                </div>
              )}
              {activeEstimate.limitations.length > 0 && (
                <div>
                  <dt>Limitations</dt>
                  <dd>{activeEstimate.limitations.join(" ")}</dd>
                </div>
              )}
            </dl>
          </>
        )}
      </DetailDrawer>
    </>
  );
}
