import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { canDisplayDistributionSummary, canExportEstimate, type Estimate } from "@diagnostic-odyssey/contracts";
import { IntervalWhiskerPlot } from "../components/IntervalWhiskerPlot";
import { DistributionSummaryText } from "../components/DistributionSummaryText";
import { useArtifact } from "../data/ArtifactContext";
import { formatEstimateInterval, formatEstimateValue } from "../data/formatEstimateValue";
import { formatDataStateLabel, formatReleaseStatusLabel } from "../data/presentationLabels";
import { metricGeometry } from "../data/metricGeometry";
import "./BurdenPage.css";

function TelemetryWhiskerTrack({ estimate }: { estimate: Estimate }) {
  if (typeof estimate.value !== "number") return null;
  const low = estimate.distribution_summary?.p25 ?? estimate.interval_low;
  const high = estimate.distribution_summary?.p75 ?? estimate.interval_high;
  const geometry = metricGeometry(estimate.value, estimate.unit, low, high);
  const w = 220;
  const toX = (pct: number) => Math.max(4, Math.min(w - 4, (pct / 100) * w));
  const ix = toX(geometry.intervalLeftPercent);
  const iw = Math.max(3, (geometry.intervalWidthPercent / 100) * w);
  const px = toX(geometry.pointPercent);

  return (
    <svg className="tile-whisker-svg" viewBox="0 0 220 14" aria-hidden="true">
      <line className="tile-whisker-rail" x1="4" y1="7" x2="216" y2="7" strokeWidth="1.5" />
      {geometry.hasInterval && !geometry.narrowInterval && (
        <rect className="tile-whisker-band" x={ix} y="4" width={iw} height="6" rx="3" />
      )}
      <circle className="tile-whisker-dot" cx={px} cy="7" r="3.2" />
    </svg>
  );
}

export function BurdenPage() {
  const { bundle } = useArtifact();
  const [domainFilter, setDomainFilter] = useState<string>("all");
  const [selectedId, setSelectedId] = useState<string>("meps24-gross-all-cause-spending-mean");

  const domainEntries = useMemo(() => {
    if (!bundle) return [];
    return bundle.burden_domains.flatMap(domain =>
      domain.measures.map(estimate => ({
        domain,
        estimate
      }))
    );
  }, [bundle]);

  if (!bundle) return null;

  const filteredEntries =
    domainFilter === "all"
      ? domainEntries
      : domainEntries.filter(entry => entry.domain.domain_id === domainFilter);

  const selectedEntry =
    filteredEntries.find(entry => entry.estimate.estimate_id === selectedId) ??
    filteredEntries[0] ??
    domainEntries[0];

  const adminHourMeasures =
    bundle.burden_domains
      .find(domain => domain.domain_id === "healthcare-work-admin")
      ?.measures.filter(estimate => estimate.unit === "hours/person/year") ?? [];

  const parentLabels = new Map(
    domainEntries.map(entry => [entry.estimate.measure_id, entry.estimate.label])
  );

  const intervalMethods = Array.from(
    new Set(
      domainEntries
        .map(entry => entry.estimate)
        .filter(canExportEstimate)
        .map(estimate => estimate.interval_type)
        .filter((value): value is string => value !== null)
    )
  );

  const selectedEstimate = selectedEntry?.estimate;
  const selectedDomain = selectedEntry?.domain;
  const parentLabel = selectedEstimate?.component_of_measure_id
    ? parentLabels.get(selectedEstimate.component_of_measure_id)
    : null;

  return (
    <section className="page page-stack burden-command-page">
      <header className="section-header-bar">
        <div className="page-heading">
          <p className="eyebrow">01 · NATIONAL BURDEN</p>
          <h1>Where the burden lands</h1>
          <p>21 reviewed MEPS measures across three distinct domains.</p>
          <p className="micro-caption">National descriptive · Not causal</p>
        </div>
        <div className="section-header-actions">
          <Link className="button secondary" to="/burden/medical#linked-condition-secondary-heading">
            U09 Service Use
          </Link>
          <Link className="button" to="/local-context">
            02 Terrain →
          </Link>
        </div>
      </header>

      <div className="burden-toolbar">
        <div className="filter-tabs" role="tablist" aria-label="Filter burden domain">
          <button
            type="button"
            role="tab"
            aria-selected={domainFilter === "all"}
            className={`filter-tab${domainFilter === "all" ? " is-active" : ""}`}
            onClick={() => setDomainFilter("all")}
          >
            All ({domainEntries.length})
          </button>
          {bundle.burden_domains.map(domain => (
            <button
              key={domain.domain_id}
              type="button"
              role="tab"
              aria-selected={domainFilter === domain.domain_id}
              className={`filter-tab${domainFilter === domain.domain_id ? " is-active" : ""}`}
              onClick={() => setDomainFilter(domain.domain_id)}
            >
              {domain.label} ({domain.measures.length})
            </button>
          ))}
        </div>
        <div className="burden-subroutes">
          <Link className="text-button" to="/burden/admin">Admin Time</Link>
          <Link className="text-button" to="/burden/human">Human Distress</Link>
          <Link className="text-button" to="/evidence">Evidence Limits</Link>
        </div>
      </div>

      <div className="command-split">
        <div className="burden-main-column">
          <div className="telemetry-grid" role="list" aria-label="National burden telemetry tiles">
            {filteredEntries.map(({ domain, estimate }) => {
              const active = selectedEstimate?.estimate_id === estimate.estimate_id;
              const reviewed = canExportEstimate(estimate);
              return (
                <button
                  key={estimate.estimate_id}
                  type="button"
                  role="listitem"
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
                  {reviewed && <TelemetryWhiskerTrack estimate={estimate} />}
                </button>
              );
            })}
          </div>

          {(domainFilter === "all" || domainFilter === "healthcare-work-admin") &&
            adminHourMeasures.length > 1 && (
              <IntervalWhiskerPlot
                estimates={adminHourMeasures}
                title="Annual healthcare-work time (hours/person/year)"
                description="Comparable ESAQ time measures sharing a respondent universe."
              />
            )}
        </div>

        {selectedEstimate && selectedDomain && (
          <aside className="inspector-panel" aria-label="Selected measure provenance inspector">
            <div className="inspector-head">
              <span className="eyebrow">RIGHT INSPECTOR · {selectedDomain.label}</span>
              <h2>{selectedEstimate.label}</h2>
              <span className="status status-reviewed">
                {formatReleaseStatusLabel(selectedEstimate.release_status)} ·{" "}
                {formatDataStateLabel(selectedDomain.availability_state)}
              </span>
            </div>

            <div className="inspector-metric">
              <strong>
                {canDisplayDistributionSummary(selectedEstimate) ? (
                  <DistributionSummaryText estimate={selectedEstimate} />
                ) : (
                  formatEstimateValue(selectedEstimate)
                )}
              </strong>
              <span>{formatEstimateInterval(selectedEstimate)}</span>
            </div>

            {selectedEstimate.component_of_measure_id && (
              <div className="guardrail">
                <strong>Nested component</strong>
                <p>
                  Component of {parentLabel ?? "parent total"} — do not add to parent total.
                </p>
              </div>
            )}

            <dl className="inspector-dl">
              <div>
                <dt>Allowed interpretation</dt>
                <dd>{selectedEstimate.allowed_interpretation}</dd>
              </div>
              <div>
                <dt>System boundary</dt>
                <dd>{selectedEstimate.system_boundary}</dd>
              </div>
              <div>
                <dt>Population / universe</dt>
                <dd>{selectedEstimate.universe}</dd>
              </div>
              <div>
                <dt>Denominator</dt>
                <dd>{selectedEstimate.denominator}</dd>
              </div>
              <div>
                <dt>Source &amp; locator</dt>
                <dd>
                  {selectedEstimate.source_ref}
                  {selectedEstimate.source_locator ? ` · ${selectedEstimate.source_locator}` : ""}
                </dd>
              </div>
              {selectedEstimate.statistics_method && (
                <div>
                  <dt>Method &amp; weight</dt>
                  <dd>
                    {selectedEstimate.statistics_method}
                    {selectedEstimate.weight_variable ? ` (${selectedEstimate.weight_variable})` : ""}
                  </dd>
                </div>
              )}
              {intervalMethods.length > 0 && (
                <div>
                  <dt>Survey uncertainty method</dt>
                  <dd>{intervalMethods.join("; ")}</dd>
                </div>
              )}
              {selectedDomain.limitations.length > 0 && (
                <div>
                  <dt>Domain boundary</dt>
                  <dd>{selectedDomain.limitations.join(" ")}</dd>
                </div>
              )}
            </dl>
          </aside>
        )}
      </div>
    </section>
  );
}
