import { useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { canExportEstimate, type Estimate } from "@diagnostic-odyssey/contracts";
import { BurdenMeasureList } from "../components/BurdenMeasureList";
import { LedgerGroup } from "../components/LedgerGroup";
import { PresentationMode, type Presentation } from "../components/PresentationMode";
import { DetailDrawer } from "../components/DetailDrawer";
import { useArtifact } from "../data/ArtifactContext";
import { formatEstimateInterval, formatEstimateValue } from "../data/formatEstimateValue";
import { selectHeadlineFindings } from "../data/headlineFindings";
import { formatDataStateLabel } from "../data/presentationLabels";
import "./Ledger.css";

type DomainTab = "all" | "economic-healthcare" | "healthcare-work-admin" | "mental-human";

const TABS: ReadonlyArray<{ id: DomainTab; label: string }> = [
  { id: "all", label: "All" },
  { id: "economic-healthcare", label: "Medical" },
  { id: "healthcare-work-admin", label: "Admin & Care Time" },
  { id: "mental-human", label: "Mental & Human" }
];

const SUB_ROUTES: ReadonlyArray<{ to: string; label: string }> = [
  { to: "/burden/medical", label: "Medical costs ledger" },
  { to: "/burden/work", label: "Work & function (unavailable)" },
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
  const [presentation, setPresentation] = useState<Presentation>("focus");
  const [groups, setGroups] = useState<Record<string, boolean>>({});
  const [focus, setFocus] = useState<{ hash: string; id: string | null } | null>(null);
  const { hash } = useLocation();

  const allMeasures = useMemo(
    () => bundle?.burden_domains.flatMap(domain => domain.measures) ?? [],
    [bundle]
  );

  if (!bundle) return null;

  const headlines = selectHeadlineFindings(bundle);
  const visibleDomains = activeTab === "all"
    ? bundle.burden_domains
    : bundle.burden_domains.filter(domain => domain.domain_id === activeTab);

  const linkedMeasure = allMeasures.find(measure => hash === `#burden-measure-${measure.estimate_id}`);
  const focusedId = focus?.hash === hash ? focus.id : linkedMeasure?.estimate_id ?? null;
  const changePresentation = (mode: Presentation) => {
    if (mode === presentation) return;
    setPresentation(mode);
    setActiveTab("all");
    setGroups(Object.fromEntries(bundle.burden_domains.map(domain => [domain.domain_id, mode === "overview"])));
  };

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
          <p>2024 AHRQ MEPS estimates for U.S. adults ages 18–64 classified as operational-current Long COVID at their Round 3/1 interview.</p>
          <p className="ledger-orientation">Open a topic to explore its measures and sources.</p>
        </header>
        <button
          type="button"
          className="button secondary"
          onClick={event => {
            event.currentTarget.focus({ preventScroll: true });
            setMethodOpen(true);
          }}
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
                <span>{estimate.unit === "hours/person/year"
                  ? "Survey-weighted annualized mean hours per person managing bills and insurance"
                  : spec.label(estimate)}</span>
                {interval && <small className="measure-interval">{interval}</small>}
              </article>
            );
          })}
        </div>
      )}

      <p className="atlas-guardrail-line">
        <strong>Accounting boundary:</strong> Gross spending covers all causes. Out-of-pocket costs and service subcomponents are already counted in their parent totals.
      </p>

      <div className="atlas-toolbar-row ledger-mode-row">
        <PresentationMode value={presentation} onChange={changePresentation} />
        <div className="atlas-tab-bar" role="group" aria-label="Filter burden domains">
          {TABS.map(tab => (
            <button
              key={tab.id}
              type="button"
              aria-pressed={activeTab === tab.id}
              className={`atlas-tab${activeTab === tab.id ? " is-active" : ""}`}
              onClick={() => {
                setActiveTab(tab.id);
                if (tab.id !== "all") setGroups(current => ({ ...current, [tab.id]: true }));
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

      </div>

      <div className="burden-domain-stack">
        {visibleDomains.map(domain => {
          const id = `burden-${domain.domain_id}`;
          const open = hash === `#${id}` || domain.measures.some(measure => measure === linkedMeasure)
            ? groups[domain.domain_id] ?? true
            : groups[domain.domain_id] ?? presentation === "overview";

          return (
            <LedgerGroup
              key={id}
              id={id}
              title={domain.label}
              summary={`${domain.measures.length} ${domain.measures.length === 1 ? "measure" : "measures"} · ${formatDataStateLabel(domain.availability_state)}`}
              open={open}
              onToggle={() => setGroups(current => ({ ...current, [domain.domain_id]: !open }))}
            >
              {domain.limitations.length > 0 && (
                <p className="micro-caption domain-limitations">{domain.limitations.join(" ")}</p>
              )}
              {domain.domain_id === "healthcare-work-admin" && (
                <p className="micro-caption domain-limitations">
                  Each time estimate describes the respondents eligible for that question. Read it within that population.
                </p>
              )}
              <BurdenMeasureList
                estimates={domain.measures}
                focusedId={focusedId}
                onFocus={id => setFocus({ hash, id: focusedId === id ? null : id })}
              />
            </LedgerGroup>
          );
        })}
      </div>

      <nav className="atlas-subroute-links" aria-label="Focused domain ledgers">
        {SUB_ROUTES.map(route => (
          <Link key={route.to} className="text-button" to={route.to}>{route.label} →</Link>
        ))}
      </nav>

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
