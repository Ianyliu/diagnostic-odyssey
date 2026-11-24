import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { canDisplayDistributionSummary, canExportEstimate } from "@diagnostic-odyssey/contracts";
import { DistributionSummaryText } from "../components/DistributionSummaryText";
import { MetricVisual } from "../components/MetricVisual";
import { useArtifact } from "../data/ArtifactContext";
import { formatEstimateInterval, formatEstimateValue, formatIntervalLabel } from "../data/formatEstimateValue";
import { formatDataStateLabel, formatReleaseStatusLabel } from "../data/presentationLabels";
import "./BurdenPage.css";

interface DomainPageProps {
  domainId: string;
  title: string;
  description: string;
  secondaryContent?: ReactNode;
}

export function DomainPage({
  domainId,
  title,
  description,
  secondaryContent
}: DomainPageProps) {
  const { bundle } = useArtifact();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  if (!bundle) return null;

  const domain = bundle.burden_domains.find(d => d.domain_id === domainId);
  const reviewed = domain?.measures.length ? domain.measures.every(canExportEstimate) : false;
  const selectedEstimate =
    domain?.measures.find(m => m.estimate_id === selectedId) ?? domain?.measures[0] ?? null;

  return (
    <section className="page page-stack">
      <header className="section-header-bar">
        <div className="page-heading">
          <Link className="text-button" to="/burden">← 01 Costs overview</Link>
          <h1>{title}</h1>
          <p>{description}</p>
          <p className="micro-caption">National descriptive · Not causal</p>
        </div>
        {domain && (
          <span className={`status ${reviewed ? "status-reviewed" : "status-unavailable"}`}>
            {reviewed ? "Reviewed national evidence" : "Not release-eligible"}
          </span>
        )}
      </header>

      {domain ? (
        <div className="command-split">
          <div className="telemetry-grid">
            {domain.measures.map(estimate => {
              const active = selectedEstimate?.estimate_id === estimate.estimate_id;
              return (
                <button
                  key={estimate.estimate_id}
                  type="button"
                  aria-pressed={active}
                  className={`telemetry-tile${active ? " is-selected" : ""}`}
                  onClick={() => setSelectedId(estimate.estimate_id)}
                >
                  <span className="tile-top-row">
                    <span className="tile-domain-tag">{domain.label}</span>
                    <span className="tile-unit-tag">{estimate.unit}</span>
                  </span>
                  <strong className="tile-figure">
                    {canDisplayDistributionSummary(estimate) ? (
                      <DistributionSummaryText estimate={estimate} />
                    ) : (
                      formatEstimateValue(estimate)
                    )}
                  </strong>
                  <span className="tile-label">{estimate.label}</span>
                  {canExportEstimate(estimate) && typeof estimate.value === "number" && (
                    <MetricVisual
                      label={estimate.label}
                      value={estimate.value}
                      unit={estimate.unit}
                      low={estimate.distribution_summary?.p25 ?? estimate.interval_low}
                      high={estimate.distribution_summary?.p75 ?? estimate.interval_high}
                      intervalLabel={
                        estimate.distribution_summary
                          ? "Interquartile range"
                          : formatIntervalLabel(estimate.interval_type)
                      }
                      intervalStyle={estimate.distribution_summary ? "range" : "confidence"}
                    />
                  )}
                </button>
              );
            })}
          </div>

          {selectedEstimate && (
            <aside className="inspector-panel" aria-label="Selected measure provenance inspector">
              <div className="inspector-head">
                <span className="eyebrow">RIGHT INSPECTOR · {domain.label}</span>
                <h2>{selectedEstimate.label}</h2>
                <span className="status status-reviewed">
                  {formatReleaseStatusLabel(selectedEstimate.release_status)} ·{" "}
                  {formatDataStateLabel(domain.availability_state)}
                </span>
              </div>
              <div className="inspector-metric">
                <strong>{formatEstimateValue(selectedEstimate)}</strong>
                <span>{formatEstimateInterval(selectedEstimate)}</span>
              </div>
              <dl className="inspector-dl">
                <div>
                  <dt>Allowed interpretation</dt>
                  <dd>{selectedEstimate.allowed_interpretation}</dd>
                </div>
                <div>
                  <dt>Universe &amp; denominator</dt>
                  <dd>{selectedEstimate.universe} · {selectedEstimate.denominator}</dd>
                </div>
                <div>
                  <dt>System boundary</dt>
                  <dd>{selectedEstimate.system_boundary}</dd>
                </div>
                <div>
                  <dt>Source</dt>
                  <dd>{selectedEstimate.source_ref}</dd>
                </div>
                {domain.limitations.length > 0 && (
                  <div>
                    <dt>Domain boundary</dt>
                    <dd>{domain.limitations.join(" ")}</dd>
                  </div>
                )}
              </dl>
            </aside>
          )}
        </div>
      ) : (
        <div className="state-card">
          <strong>Not yet represented by a standalone reviewed domain.</strong>
          <p>
            This route remains available without borrowing values from another domain. Missing
            domain does not mean zero burden.
          </p>
        </div>
      )}
      {secondaryContent}
    </section>
  );
}
