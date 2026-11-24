import { useState } from "react";
import { Link } from "react-router-dom";
import { canExportEstimate } from "@diagnostic-odyssey/contracts";
import { BurdenMeasureList } from "../components/BurdenMeasureList";
import { DetailDrawer } from "../components/DetailDrawer";
import { IntervalWhiskerPlot } from "../components/IntervalWhiskerPlot";
import { useArtifact } from "../data/ArtifactContext";
import { formatEstimateValue } from "../data/formatEstimateValue";
import { selectHeadlineFindings } from "../data/headlineFindings";
import { formatDataStateLabel } from "../data/presentationLabels";
import "./Ledger.css";

type DomainTab = "all" | "economic-healthcare" | "healthcare-work-admin" | "mental-human";

const TABS: ReadonlyArray<{ id: DomainTab; label: string }> = [
  { id: "all", label: "All" },
  { id: "economic-healthcare", label: "Medical" },
  { id: "healthcare-work-admin", label: "Time" },
  { id: "mental-human", label: "Human" }
];

export function BurdenPage() {
  const { bundle } = useArtifact();
  const [activeTab, setActiveTab] = useState<DomainTab>("all");
  const [methodOpen, setMethodOpen] = useState(false);

  if (!bundle) return null;

  const headlines = selectHeadlineFindings(bundle);
  const visibleDomains = activeTab === "all"
    ? bundle.burden_domains
    : bundle.burden_domains.filter(domain => domain.domain_id === activeTab);

  const intervalMethods = Array.from(new Set(
    bundle.burden_domains
      .flatMap(domain => domain.measures)
      .filter(canExportEstimate)
      .map(estimate => estimate.interval_type)
      .filter((intervalType): intervalType is string => intervalType !== null)
  ));

  return (
    <section className="page page-stack burden-ledger-page">
      <div className="atlas-page-top">
        <header className="page-heading">
          <p className="eyebrow">01 · COSTS &amp; BURDEN</p>
          <h1>National burden overview</h1>
          <p>U.S. adults with current Long COVID · 2024 AHRQ MEPS.</p>
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
        <div className="atlas-hero-bento" aria-label="Headline burden figures">
          {headlines.slice(1, 4).map(({ spec, estimate }) => (
            <article className="atlas-bento-card" key={spec.estimateId}>
              <span>{estimate.label}</span>
              <strong>
                {estimate.unit === "hours/person/year" && typeof estimate.value === "number"
                  ? `${estimate.value.toLocaleString("en-US", { maximumFractionDigits: 1 })} hrs`
                  : formatEstimateValue(estimate)}
              </strong>
              <p className="micro-caption">National descriptive · Not causal</p>
            </article>
          ))}
        </div>
      )}

      <div className="atlas-tab-bar" role="tablist" aria-label="Burden categories">
        {TABS.map(tab => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            className={`atlas-tab${activeTab === tab.id ? " is-active" : ""}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

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
          Continue to Terrain →
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
