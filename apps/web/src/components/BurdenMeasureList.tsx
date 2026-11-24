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

export function EstimateProvenanceDetails({ estimate }: { estimate: Estimate }) {
  return (
    <>
      <div className="atlas-drawer-stat">
        <strong>
          {canDisplayDistributionSummary(estimate)
            ? <DistributionSummaryText estimate={estimate} />
            : formatEstimateValue(estimate)}
        </strong>
        <span>{formatEstimateInterval(estimate) || "Interval not published"}</span>
      </div>

      <dl className="atlas-drawer-list">
        <div>
          <dt>Allowed interpretation</dt>
          <dd>{estimate.allowed_interpretation}</dd>
        </div>
        {estimate.prohibited_interpretation.length > 0 && (
          <div>
            <dt>Not supported</dt>
            <dd>
              <ul className="atlas-compact-list">
                {estimate.prohibited_interpretation.map(item => <li key={item}>{item}</li>)}
              </ul>
            </dd>
          </div>
        )}
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
        {estimate.source_locator && (
          <div>
            <dt>Source locator</dt>
            <dd>{estimate.source_locator}</dd>
          </div>
        )}
        <div>
          <dt>Release status</dt>
          <dd>{formatReleaseStatusLabel(estimate.release_status)}</dd>
        </div>
        {estimate.statistics_method && (
          <div>
            <dt>Statistical method</dt>
            <dd>{estimate.statistics_method}</dd>
          </div>
        )}
        {estimate.weight_variable && (
          <div>
            <dt>Weight variable</dt>
            <dd>{estimate.weight_variable}</dd>
          </div>
        )}
        {estimate.limitations.length > 0 && (
          <div>
            <dt>Limitations</dt>
            <dd>{estimate.limitations.join(" ")}</dd>
          </div>
        )}
      </dl>
    </>
  );
}

export function BurdenMeasureList({
  estimates,
  selectedEstimateId,
  onInspect
}: {
  estimates: Estimate[];
  selectedEstimateId?: string | null;
  onInspect?: (estimate: Estimate) => void;
}) {
  const [drawerEstimate, setDrawerEstimate] = useState<Estimate | null>(null);
  const parentLabels = new Map(
    estimates.map(estimate => [estimate.measure_id, estimate.label])
  );

  const handleInspectClick = (estimate: Estimate) => {
    if (onInspect) {
      onInspect(estimate);
      const compactViewport =
        typeof window !== "undefined" &&
        typeof window.matchMedia === "function" &&
        window.matchMedia("(max-width: 1099px)").matches;
      if (compactViewport) {
        setDrawerEstimate(estimate);
      }
      return;
    }
    setDrawerEstimate(estimate);
  };

  return (
    <>
      <div className="measure-list burden-measure-list">
        {estimates.map(estimate => {
          const reviewed = canExportEstimate(estimate);
          const parentLabel = estimate.component_of_measure_id
            ? parentLabels.get(estimate.component_of_measure_id)
            : null;
          const isInspected = selectedEstimateId === estimate.estimate_id;

          return (
            <article
              className={`measure burden-measure-row atlas-metric-row${isInspected ? " is-inspected" : ""}`}
              aria-labelledby={`burden-measure-${estimate.estimate_id}`}
              key={estimate.estimate_id}
            >
              <div className="burden-measure-summary">
                <h3 id={`burden-measure-${estimate.estimate_id}`}>{estimate.label}</h3>
                {estimate.component_of_measure_id && (
                  <span className="component-note">
                    Nested inside {parentLabel ?? "parent total"} — do not add separately.
                  </span>
                )}
                <button
                  type="button"
                  className="atlas-detail-trigger"
                  aria-pressed={onInspect ? isInspected : undefined}
                  onClick={() => handleInspectClick(estimate)}
                >
                  Provenance &amp; 95% CI ↗
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
        open={drawerEstimate !== null}
        eyebrow="MEPS 2024 · MEASURE PROVENANCE"
        title={drawerEstimate?.label ?? ""}
        onClose={() => setDrawerEstimate(null)}
      >
        {drawerEstimate && <EstimateProvenanceDetails estimate={drawerEstimate} />}
      </DetailDrawer>
    </>
  );
}
