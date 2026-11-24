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
import { getBurdenScaleDomain } from "../data/metricGeometry";
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

export function EstimateProvenanceDetails({ estimate: activeEstimate }: { estimate: Estimate }) {
  return (
    <>
      <div className="atlas-drawer-stat">
        <strong>
          {canDisplayDistributionSummary(activeEstimate)
            ? <DistributionSummaryText estimate={activeEstimate} />
            : formatEstimateValue(activeEstimate)}
        </strong>
        <span>{formatEstimateInterval(activeEstimate) || "Interval not published"}</span>
      </div>

      <dl className="atlas-drawer-list">
        <div>
          <dt>Allowed interpretation</dt>
          <dd>{activeEstimate.allowed_interpretation}</dd>
        </div>
        {activeEstimate.prohibited_interpretation.length > 0 && (
          <div>
            <dt>Not supported</dt>
            <dd>
              <ul className="atlas-compact-list">
                {activeEstimate.prohibited_interpretation.map(item => <li key={item}>{item}</li>)}
              </ul>
            </dd>
          </div>
        )}
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
  );
}

export function BurdenMeasureList({
  estimates,
  focusedId,
  onFocus
}: {
  estimates: Estimate[];
  focusedId?: string | null;
  onFocus?: (estimateId: string) => void;
}) {
  const [activeEstimate, setActiveEstimate] = useState<Estimate | null>(null);
  const parentLabels = new Map(estimates.map(estimate => [estimate.measure_id, estimate.label]));

  return (
    <>
      <div className="measure-list burden-measure-list">
        {estimates.map(estimate => {
          const reviewed = canExportEstimate(estimate);
          const parentLabel = estimate.component_of_measure_id
            ? parentLabels.get(estimate.component_of_measure_id)
            : null;
          const focused = focusedId === estimate.estimate_id;
          const showDetail = !onFocus || focused;
          const titleId = `burden-measure-${estimate.estimate_id}`;
          const detailId = `${titleId}-details`;

          return (
            <article
              className={`measure burden-measure-row atlas-metric-row${onFocus ? " is-compact" : ""}${focused ? " is-inspected" : ""}`}
              aria-labelledby={titleId}
              key={estimate.estimate_id}
            >
              <div className="burden-measure-summary">
                <h3 id={titleId}>{estimate.label}</h3>
                {estimate.component_of_measure_id && (
                  <span className="component-note">
                    Nested inside {parentLabel ?? "parent total"} · do not add.
                  </span>
                )}
                {onFocus ? (
                  <button
                    type="button"
                    className="atlas-detail-trigger"
                    aria-expanded={focused}
                    aria-controls={detailId}
                    aria-label={`${focused ? "Hide" : "Show"} details for ${estimate.label}`}
                    onClick={() => onFocus(estimate.estimate_id)}
                  >
                    {focused ? "Hide details −" : "Details +"}
                  </button>
                ) : (
                  <button type="button" className="atlas-detail-trigger" onClick={() => setActiveEstimate(estimate)}>
                    Provenance &amp; 95% CI ↗
                  </button>
                )}
              </div>

              <div className="measure-value">
                <div className="atlas-measure-figure">
                  {canDisplayDistributionSummary(estimate)
                    ? <DistributionSummaryText estimate={estimate} />
                    : formatEstimateValue(estimate)}
                </div>
                <EstimateIntervalText estimate={estimate} />
                {!reviewed && (
                  <small className="measure-release-status">
                    {formatReleaseStatusLabel(estimate.release_status)}
                  </small>
                )}
              </div>
              <div className="burden-measure-detail" id={detailId} hidden={!showDetail}>
                {showDetail && (
                  <>
                    {onFocus && <p>{estimate.allowed_interpretation}</p>}
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
                        scaleDomain={getBurdenScaleDomain(estimate, estimates)}
                        standaloneNote={`Standalone ${estimate.unit} measure · no cross-row comparison bar`}
                        compact
                      />
                    )}
                    {reviewed && estimate.distribution_summary && (
                      <small className="metric-skew-note">
                        {estimate.value !== null && estimate.value >= estimate.distribution_summary.p25 && estimate.value <= estimate.distribution_summary.p75
                          ? "The survey mean falls within the interquartile range."
                          : "The survey mean falls outside the interquartile range."}{" "}
                        The 25th–75th percentile range describes the middle half of responses. The confidence interval describes sampling uncertainty in the mean.
                      </small>
                    )}
                    {onFocus && (
                      <button type="button" className="atlas-detail-trigger" onClick={() => setActiveEstimate(estimate)}>
                        Provenance &amp; 95% CI ↗
                      </button>
                    )}
                  </>
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
        {activeEstimate && <EstimateProvenanceDetails estimate={activeEstimate} />}
      </DetailDrawer>
    </>
  );
}
