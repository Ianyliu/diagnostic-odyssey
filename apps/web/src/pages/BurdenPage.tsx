import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { canExportEstimate, type Estimate } from "@diagnostic-odyssey/contracts";
import {
  BurdenInspectContext,
  BurdenMeasureList,
  EstimateProvenanceDetails
} from "../components/BurdenMeasureList";
import { DetailDrawer } from "../components/DetailDrawer";
import { IntervalWhiskerPlot } from "../components/IntervalWhiskerPlot";
import { useArtifact } from "../data/ArtifactContext";
import { formatEstimateInterval, formatEstimateValue } from "../data/formatEstimateValue";
import { selectHeadlineFindings } from "../data/headlineFindings";
import { formatDataStateLabel } from "../data/presentationLabels";
import "./Ledger.css";

type DomainTab = "all" | "economic-healthcare" | "healthcare-work-admin" | "mental-human";

const TABS: ReadonlyArray<{ id: DomainTab; label: string }> = [
  { id: "all", label: "All domains" },
  { id: "economic-healthcare", label: "Medical & out-of-pocket" },
  { id: "healthcare-work-admin", label: "Work & administrative time" },
  { id: "mental-human", label: "Mental & human toll" }
];

const SUB_ROUTES: ReadonlyArray<{ to: string; label: string }> = [
  { to: "/burden/medical", label: "Medical costs ledger" },
  { to: "/burden/work", label: "Work & disability" },
  { to: "/burden/admin", label: "Administrative time" },
  { to: "/burden/human", label: "Quality of life & distress" }
];

function heroFigure(estimate: Estimate): string {
  if (estimate.unit === "hours/person/year" && typeof estimate.value === "number") {
    return estimate.value.toLocaleString("en-US", { maximumFractionDigits: 1 });
  }
  return formatEstimateValue(estimate);
}

export function BurdenPage() {
  const { bundle } = useArtifact();
  const [activeTab, setActiveTab] = useState<DomainTab>("all");
  const [methodOpen, setMethodOpen] = useState(false);
  const [inspectedId, setInspectedId] = useState<string | null>(null);

  const allMeasures = useMemo(
    () => bundle?.burden_domains.flatMap(domain => domain.measures) ?? [],
    [bundle]
  );

  if (!bundle) return null;

  const headlines = selectHeadlineFindings(bundle);
  const visibleDomains = activeTab === "all"
    ? bundle.burden_domains
    : bundle.burden_domains.filter(domain => domain.domain_id === activeTab);

  const visibleMeasures = visibleDomains.flatMap(domain => domain.measures);
  const inspectedEstimate =
    allMeasures.find(measure => measure.estimate_id === inspectedId) ??
    visibleMeasures.find(canExportEstimate) ??
    visibleMeasures[0] ??
    null;

  const nestedCount = visibleMeasures.filter(measure => Boolean(measure.component_of_measure_id)).length;

  const intervalMethods = Array.from(new Set(
    allMeasures
      .filter(canExportEstimate)
      .map(estimate => estimate.interval_type)
      .filter((intervalType): intervalType is string => intervalType !== null)
  ));

  return (
    <section className="page page-stack burden-ledger-page">
      <div className="atlas-page-top">
        <header className="page-heading">
          <p className="eyebrow">01 · BURDEN</p>
          <h1>National burden overview</h1>
          <p>U.S. adults ages 18–64 with current Long COVID · {bundle.context.evidence_year} AHRQ MEPS.</p>
        </header>
        <button
          type="button"
          className="button secondary"
          onClick={() => setMethodOpen(true)}
        >
          Methods &amp; Limits
        </button>
      </div>

      {headlines.length > 0 && (
        <div className="atlas-hero-bento is-four-col" aria-label="Headline national burden figures">
          {headlines.map(({ spec, estimate }) => {
            const interval = formatEstimateInterval(estimate);
            return (
              <article className="atlas-bento-card" key={spec.estimateId}>
                <strong>{heroFigure(estimate)}</strong>
                <span>{spec.label(estimate)}</span>
                {interval && <small className="measure-interval">{interval}</small>}
                <p className="micro-caption">National descriptive · Not causal</p>
              </article>
            );
          })}
        </div>
      )}

      <div className="atlas-toolbar-row">
        <div className="atlas-tab-bar" role="group" aria-label="Filter burden domains">
          {TABS.map(tab => (
            <button
              key={tab.id}
              type="button"
              aria-pressed={activeTab === tab.id}
              className={`atlas-tab${activeTab === tab.id ? " is-active" : ""}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <nav className="atlas-subroute-links" aria-label="Focused domain ledgers">
          {SUB_ROUTES.map(route => (
            <Link key={route.to} className="text-button" to={route.to}>
              {route.label} →
            </Link>
          ))}
        </nav>
      </div>

      {nestedCount > 0 && (
        <p className="atlas-guardrail-line">
          <strong>Accounting boundary:</strong> Out-of-pocket costs and service subcomponents are nested inside gross all-cause totals — never add component lines together.
        </p>
      )}

      <BurdenInspectContext.Provider value={{
        selectedEstimateId: inspectedEstimate?.estimate_id ?? null,
        onInspect: estimate => setInspectedId(estimate.estimate_id)
      }}>
      <div className="atlas-split-workspace">
        <div className="burden-domain-stack">
          {visibleDomains.map(domain => {
            const reviewed = domain.measures.length > 0 && domain.measures.every(canExportEstimate);
            const administrativeHourMeasures = domain.domain_id === "healthcare-work-admin"
              ? domain.measures.filter(estimate => estimate.unit === "hours/person/year")
              : [];

            return (
              <article
                className="card domain-card ledger-panel"
                id={`burden-${domain.domain_id}`}
                key={domain.domain_id}
              >
                <div className="card-title-row">
                  <div>
                    <h2>{domain.label}</h2>
                    <p className="subtle">
                      {formatDataStateLabel(domain.availability_state)} · {domain.measures.length}{" "}
                      {domain.measures.length === 1 ? "measure" : "measures"}
                    </p>
                  </div>
                  <span className={`status ${reviewed ? "status-reviewed" : "status-unavailable"}`}>
                    {reviewed ? "Reviewed" : "Restricted"}
                  </span>
                </div>

                {domain.limitations.length > 0 && (
                  <p className="micro-caption domain-limitations">
                    {domain.limitations.join(" ")}
                  </p>
                )}

                {administrativeHourMeasures.length > 1 && (
                  <IntervalWhiskerPlot
                    estimates={administrativeHourMeasures}
                    title="Healthcare-work hours per year"
                    description="ESAQ annualized hours across comparable measures."
                  />
                )}

                <BurdenMeasureList estimates={domain.measures} />
              </article>
            );
          })}
        </div>

        {inspectedEstimate && (
          <aside className="atlas-split-inspector" aria-label="Selected national burden provenance">
            <div className="atlas-inspector-header">
              <span className="eyebrow">PROVENANCE INSPECTOR · MEPS {bundle.context.evidence_year}</span>
              <h2>{inspectedEstimate.label}</h2>
            </div>
            <EstimateProvenanceDetails estimate={inspectedEstimate} />
          </aside>
        )}
      </div>
      </BurdenInspectContext.Provider>

      <div className="atlas-page-footer-bar">
        <div className="atlas-footer-links">
          <Link className="text-button" to="/burden/medical#linked-condition-secondary-heading">
            Linked-condition secondary note →
          </Link>
          <Link className="text-button" to="/evidence">
            Evidence limits →
          </Link>
        </div>
        <Link className="button" to="/local-context">
          Continue to 02 Local context →
        </Link>
      </div>

      <DetailDrawer
        open={methodOpen}
        eyebrow="METHODOLOGY & BOUNDARIES"
        title="How to read these figures"
        onClose={() => setMethodOpen(false)}
      >
        <dl className="atlas-drawer-list">
          <div>
            <dt>Gross vs. attributable cost</dt>
            <dd>All-cause MEPS spending and service use are descriptive for adults with current Long COVID—not causal or diagnostic-delay costs.</dd>
          </div>
          <div>
            <dt>Native units stay separate</dt>
            <dd>Spending, time, utilization, and K6/PHQ-2 screening are never added into a single score. Out-of-pocket costs remain nested inside total spending.</dd>
          </div>
          <div>
            <dt>Survey uncertainty</dt>
            <dd>95% confidence intervals come directly from survey-weighted MEPS analysis without browser recomputation.</dd>
          </div>
          {intervalMethods.length > 0 && (
            <div>
              <dt>Interval methods</dt>
              <dd>
                <ul className="atlas-compact-list">
                  {intervalMethods.map(method => <li key={method}>{method}</li>)}
                </ul>
              </dd>
            </div>
          )}
        </dl>
      </DetailDrawer>
    </section>
  );
}
