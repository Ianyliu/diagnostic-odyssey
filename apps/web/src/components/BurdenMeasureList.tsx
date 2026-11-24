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
import { AppleDetailModal } from "./AppleDetailModal";
import { DistributionSummaryText } from "./DistributionSummaryText";
import { MetricVisual } from "./MetricVisual";

function EstimateIntervalText({estimate}: {estimate: Estimate}) {
  if (!canExportEstimate(estimate)) return null;

  const interval = formatEstimateInterval(estimate);
  const accessibleInterval = interval
    .replace(/^(\d+(?:\.\d+)?)% CI\s*/, "$1% confidence interval: ")
    .replace(/^CI\s*/, "Confidence interval: ");

  return (
    <small className="measure-interval mono-figure">
      <span aria-hidden="true">{interval}</span>
      <span className="sr-only">{accessibleInterval}</span>
    </small>
  );
}

export function BurdenMeasureList({estimates}: {estimates: Estimate[]}) {
  const [activeEstimate, setActiveEstimate] = useState<Estimate | null>(null);
  const parentLabels = new Map(
    estimates.map(estimate => [estimate.measure_id, estimate.label])
  );

  return (
    <>
      <div className="burden-bento-grid">
        {estimates.map(estimate => {
          const reviewed = canExportEstimate(estimate);
          const parentLabel = estimate.component_of_measure_id
            ? parentLabels.get(estimate.component_of_measure_id)
            : null;

          return (
            <article
              className="apple-card burden-measure-card"
              aria-labelledby={`burden-measure-${estimate.estimate_id}`}
              key={estimate.estimate_id}
            >
              <div className="burden-card-top">
                <div className="burden-card-title-group">
                  <h3 id={`burden-measure-${estimate.estimate_id}`}>{estimate.label}</h3>
                  {estimate.component_of_measure_id && (
                    <span className="component-note">
                      Nested in {parentLabel ?? "parent measure"} · Do not add
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  className="apple-info-btn"
                  aria-label={`Details for ${estimate.label}`}
                  onClick={() => setActiveEstimate(estimate)}
                >
                  i
                </button>
              </div>

              <div className="burden-card-value">
                <div className="burden-value-main mono-figure">
                  {canDisplayDistributionSummary(estimate)
                    ? <DistributionSummaryText estimate={estimate} />
                    : formatEstimateValue(estimate)}
                </div>
                <EstimateIntervalText estimate={estimate} />
                {!reviewed && (
                  <small className="status status-neutral">
                    {formatReleaseStatusLabel(estimate.release_status)}
                  </small>
                )}
              </div>

              {reviewed && typeof estimate.value === "number" && (
                <MetricVisual
                  label={estimate.label}
                  value={estimate.value}
                  unit={estimate.unit}
                  low={estimate.distribution_summary?.p25 ?? estimate.interval_low}
                  high={estimate.distribution_summary?.p75 ?? estimate.interval_high}
                  intervalLabel={estimate.distribution_summary
                    ? "IQR (25th–75th percentile)"
                    : formatIntervalLabel(estimate.interval_type)}
                  intervalStyle={estimate.distribution_summary ? "range" : "confidence"}
                  pointLabel={estimate.distribution_summary ? "Mean" : "Estimate"}
                />
              )}
            </article>
          );
        })}
      </div>

      <AppleDetailModal
        open={activeEstimate !== null}
        kicker="2024 MEPS · Reviewed Measure Provenance"
        title={activeEstimate?.label ?? ""}
        onClose={() => setActiveEstimate(null)}
      >
        {activeEstimate && (
          <dl className="apple-detail-list">
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
              <dt>Source &amp; locator</dt>
              <dd>{activeEstimate.source_ref}{activeEstimate.source_locator ? ` · ${activeEstimate.source_locator}` : ""}</dd>
            </div>
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
            {activeEstimate.prohibited_interpretation.length > 0 && (
              <div>
                <dt>Not supported</dt>
                <dd>{activeEstimate.prohibited_interpretation.join("; ")}</dd>
              </div>
            )}
          </dl>
        )}
      </AppleDetailModal>
    </>
  );
}
