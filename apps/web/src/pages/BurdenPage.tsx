import { useState } from "react";
import { Link } from "react-router-dom";
import { canExportEstimate } from "@diagnostic-odyssey/contracts";
import { BurdenMeasureList } from "../components/BurdenMeasureList";
import { IntervalWhiskerPlot } from "../components/IntervalWhiskerPlot";
import { useArtifact } from "../data/ArtifactContext";
import { formatDataStateLabel } from "../data/presentationLabels";
import "./Ledger.css";

const DOMAIN_PILLS: ReadonlyArray<{ id: string; label: string }> = [
  { id: "all", label: "All domains" },
  { id: "economic-healthcare", label: "Spending" },
  { id: "healthcare-work-admin", label: "Time" },
  { id: "mental-human", label: "Wellbeing" }
];

export function BurdenPage() {
  const { bundle } = useArtifact();
  const [activeDomain, setActiveDomain] = useState<string>("all");

  if (!bundle) return null;

  const intervalMethods = Array.from(new Set(
    bundle.burden_domains
      .flatMap(domain => domain.measures)
      .filter(canExportEstimate)
      .map(estimate => estimate.interval_type)
      .filter((intervalType): intervalType is string => intervalType !== null)
  ));

  const visibleDomains = activeDomain === "all"
    ? bundle.burden_domains
    : bundle.burden_domains.filter(domain => domain.domain_id === activeDomain);

  return (
    <section className="page page-stack burden-ledger-page">
      <header className="apple-page-header">
        <p className="apple-kicker">Edition 01 · National Evidence</p>
        <h1>National burden, clearly separated.</h1>
        <p className="apple-subtitle">
          21 reviewed 2024 MEPS estimates across spending, time, and distress.
        </p>
        <p className="micro-caption">National descriptive · Not causal</p>
      </header>

      <div className="ledger-toolbar">
        <div className="apple-segmented" role="group" aria-label="Filter burden domains">
          {DOMAIN_PILLS.map(pill => (
            <button
              key={pill.id}
              type="button"
              aria-pressed={activeDomain === pill.id}
              onClick={() => setActiveDomain(pill.id)}
            >
              {pill.label}
            </button>
          ))}
        </div>
        <div className="ledger-toolbar-links">
          <Link className="text-button" to="/burden/medical">Secondary footprint →</Link>
          <Link className="text-button" to="/evidence">Evidence limits →</Link>
        </div>
      </div>

      <div className="burden-domain-stack">
        {visibleDomains.map(domain => {
          const reviewed = domain.measures.length > 0 && domain.measures.every(canExportEstimate);
          const administrativeHourMeasures = domain.domain_id === "healthcare-work-admin"
            ? domain.measures.filter(estimate => estimate.unit === "hours/person/year")
            : [];

          return (
            <section className="burden-domain-section" id={`burden-${domain.domain_id}`} key={domain.domain_id}>
              <div className="burden-section-head">
                <div>
                  <h2>{domain.label}</h2>
                  <p className="subtle">
                    {formatDataStateLabel(domain.availability_state)} · {domain.measures.length}{" "}
                    {domain.measures.length === 1 ? "measure" : "measures"}
                  </p>
                </div>
                <span className={`status ${reviewed ? "status-reviewed" : "status-neutral"}`}>
                  {reviewed ? "Reviewed national evidence" : "Not release-eligible"}
                </span>
              </div>

              {administrativeHourMeasures.length > 1 && (
                <IntervalWhiskerPlot
                  estimates={administrativeHourMeasures}
                  title="Annual healthcare-work time"
                  description="Comparable reviewed ESAQ hours/person/year measures."
                />
              )}

              <BurdenMeasureList estimates={domain.measures} />

              {domain.limitations.length > 0 && (
                <details className="apple-accordion domain-limitations">
                  <summary>Domain interpretation boundaries</summary>
                  <p>{domain.limitations.join(" ")}</p>
                </details>
              )}
            </section>
          );
        })}
      </div>

      <details className="apple-accordion">
        <summary>Survey intervals, native units &amp; secondary evidence</summary>
        <p>
          Intervals are reviewed 95% confidence intervals from MEPS survey-weighted analysis; no interval is recomputed in the browser.
          Administrative time, spending, and screening measures stay in native units and are never summed.
        </p>
        {intervalMethods.length > 0 && (
          <ul>{intervalMethods.map(method => <li key={method}>{method}</li>)}</ul>
        )}
        <p>
          <Link to="/burden/medical#linked-condition-secondary-heading">Inspect documentation-linked service-use evidence →</Link>
        </p>
      </details>

      <div className="workflow-next">
        <Link className="button" to="/local-context">Continue to Terrain</Link>
        <Link className="button secondary" to="/pilot">Open Simulator</Link>
      </div>
    </section>
  );
}
