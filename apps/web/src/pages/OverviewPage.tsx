import { Link } from "react-router-dom";
import { canExportEstimate } from "@diagnostic-odyssey/contracts";
import { useArtifact } from "../data/ArtifactContext";
import { formatEstimateInterval, formatEstimateValue } from "../data/formatEstimateValue";
import { OpeningProvenance, useOpeningMotion } from "./OpeningProvenance";
import { planningInsightsEnabled } from "../data/planningInsightsEnabled";
import "./OverviewPage.css";

const journey: ReadonlyArray<readonly [
  step: string,
  title: string,
  outcome: string,
  to: string
]> = [
  ["1", "Describe burden", "Review national burden estimates with survey uncertainty and explicit interpretation boundaries.", "/burden"],
  ["2", "Review local constraints", "Inspect implementation and access context without turning national burden into a local disease estimate.", "/local-context"],
  ["3", "Scope a feasible pilot", "Set explicit planning assumptions and stress-test reach, capacity, timing, and resources.", "/pilot"],
  ["4", "Create a planning brief", "Export reviewed evidence, selected context, assumptions, boundaries, and remaining gaps.", "/brief"]
];

/** A representative measure from each reviewed domain, never a derived composite. */
const headlineMeasures = [
  {measureId: "gross-all-cause-spending-total", title: "All-cause annual medical spending", domain: "Economic / healthcare", interpretation: "Descriptive spending, not attributable Long COVID or diagnostic-delay cost."},
  {measureId: "medical-bills-insurance-time", title: "Annual time managing bills and insurance", domain: "Administrative work", interpretation: "Hours per respondent per year; not monetized or added to spending."},
  {measureId: "k6-serious-distress", title: "Serious psychological distress screening", domain: "Human burden", interpretation: "K6 screening threshold, not a clinical diagnosis."}
] as const;

export function OverviewPage() {
  const opening = useOpeningMotion();
  const {bundle, localContext, localContextStatus} = useArtifact();
  const reviewedCount = bundle?.burden_domains
    .flatMap(domain => domain.measures)
    .filter(canExportEstimate).length ?? 0;
  const localIndicatorCount = localContextStatus === "loaded"
    ? localContext?.indicators.length ?? 0
    : null;

  const reviewedMeasures = bundle?.burden_domains.flatMap(domain => domain.measures)
    .filter(canExportEstimate) ?? [];

  return (
    <section className={"page page-stack overview-page" + (opening ? " is-opening" : "")}>
      <section className="overview-hero" aria-labelledby="overview-title">
        <div className="overview-hero-grid" aria-hidden="true" />
        <div className="overview-hero-copy">
          <p className="overview-kicker">Evidence for better planning</p>
          <h1 id="overview-title">
            Evidence into planning,
            <span>with boundaries intact.</span>
          </h1>
          <p className="overview-lede">
            For public-health and Medicaid planners, rural-health teams, and advocates, Diagnostic Odyssey supports Long COVID planning by keeping reviewed national burden, local implementation context, and analyst assumptions visibly separate—then carrying their provenance into one workflow.
          </p>
          <div className="overview-hero-actions" role="group" aria-label="Start exploring Diagnostic Odyssey">
            <Link className="button overview-primary-cta" to="/burden">Explore reviewed burden</Link>
            <Link className="overview-secondary-cta" to="/pilot">Open Pilot planner</Link>
            {planningInsightsEnabled && <Link className="overview-tertiary-cta" to="/brief#planning-insights">See planning insights <span aria-hidden="true">→</span></Link>}
          </div>
          <dl className="overview-proof" aria-label="Current workspace evidence">
            <div>
              <dt>{reviewedCount || "—"}</dt>
              <dd>reviewed national estimates</dd>
            </div>
            <div>
              <dt>{localIndicatorCount ?? "—"}</dt>
              <dd>reviewed local-context indicators</dd>
            </div>
          </dl>
          <p className="overview-source-note">Grounded in <strong>MEPS</strong>, <strong>HRSA</strong> and <strong>ACS</strong> · source boundaries stay visible.</p>
        </div>
        <OpeningProvenance playing={opening} />
      </section>

      <section className="overview-headlines" aria-labelledby="overview-headlines-title">
        <div className="overview-section-heading">
          <p className="visual-kicker">REVIEWED NATIONAL MEPS · 2024</p>
          <h2 id="overview-headlines-title">Three dimensions of burden. No composite score.</h2>
          <p>These are separate descriptive estimates from the reviewed national artifact, each with its own population and 95% survey confidence interval.</p>
        </div>
        <div className="overview-headline-grid">
          {headlineMeasures.map(({measureId, title, domain, interpretation}) => {
            const estimate = reviewedMeasures.find(item => item.measure_id === measureId);
            if (!estimate) return null;
            return <article className="overview-headline-card" key={measureId}>
              <p className="overview-headline-domain">{domain}</p>
              <h3>{title}</h3>
              <strong className="overview-headline-value">{formatEstimateValue(estimate)}</strong>
              <p className="overview-headline-ci">{formatEstimateInterval(estimate)}</p>
              <p className="overview-headline-boundary">{interpretation}</p>
              <details className="overview-headline-source">
                <summary>Population and source</summary>
                <p>{estimate.universe}</p>
                <p>{estimate.source_ref} · {estimate.interval_type}</p>
              </details>
            </article>;
          })}
        </div>
        <p className="overview-headline-note"><strong>Evidence roles:</strong> MEPS describes national burden; HRSA and ACS describe local implementation context, not local Long COVID prevalence; analyst inputs define pilot scenarios. None are silently blended. <Link to="/burden">Review all {reviewedCount} national measures →</Link></p>
      </section>

      <nav className="overview-destinations" aria-label="Workspace navigation">
        <div className="overview-section-heading overview-destinations-heading">
          <p className="visual-kicker">HOW IT WORKS</p>
          <h2>A clear path from evidence to a plan.</h2>
          <p>Start where you need. Review the evidence, test assumptions, and capture what you still need to know.</p>
        </div>
        <div className="journey-grid">
          {journey.map(([step, title, outcome, to]) => (
            <Link key={step} className="journey-card" to={to}>
              <span className="journey-index" aria-hidden="true">{step.padStart(2, "0")}</span>
              <strong>{title}</strong>
              <small>{outcome}</small>
              <span className="journey-arrow" aria-hidden="true">→</span>
            </Link>
          ))}
        </div>
        <p className="overview-workflow-note">Within your pilot: <Link to="/pilot#sensitivity">test sensitivity</Link> → <Link to="/data-requests">capture data needs</Link> → review your brief. <Link to="/evidence">Intervention evidence &amp; limits</Link> stays separate from descriptive burden.</p>
      </nav>

    </section>
  );
}
