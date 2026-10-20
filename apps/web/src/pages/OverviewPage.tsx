import { Link } from "react-router-dom";
import { canExportEstimate } from "@diagnostic-odyssey/contracts";
import { useArtifact } from "../data/ArtifactContext";
import { OpeningProvenance, useOpeningMotion } from "./OpeningProvenance";
import { HeadlineFindings } from "../components/HeadlineFindings";
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

export function OverviewPage() {
  const opening = useOpeningMotion();
  const {bundle, localContext, localContextStatus} = useArtifact();
  const reviewedCount = bundle?.burden_domains
    .flatMap(domain => domain.measures)
    .filter(canExportEstimate).length ?? 0;
  const localIndicatorCount = localContextStatus === "loaded"
    ? localContext?.indicators.length ?? 0
    : null;

  return (
    <section className={"page page-stack overview-page" + (opening ? " is-opening" : "")}>
      <section className="overview-hero" aria-labelledby="overview-title">
        <div className="overview-hero-grid" aria-hidden="true" />
        <div className="overview-hero-copy">
          <p className="overview-kicker">Evidence into planning, with boundaries intact.</p>
          <h1 id="overview-title">
            Long COVID&rsquo;s burden
            <span>goes beyond the bill.</span>
          </h1>
          <p className="overview-lede">
            <strong className="overview-audience">For state health departments and Medicaid programs scoping Long COVID care-navigation pilots.</strong> Diagnostic Odyssey keeps reviewed national burden, local implementation context, and analyst assumptions visibly separate—then carries their provenance into one workflow.
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
        <HeadlineFindings />
      </section>

      <section className="overview-value-prop" aria-labelledby="overview-value-title">
        <div className="overview-section-heading">
          <p className="visual-kicker">HOW EVIDENCE TRAVELS</p>
          <h2 id="overview-value-title">Different evidence, distinct purposes.</h2>
          <p>MEPS describes national burden; HRSA and ACS describe local implementation context, not local Long COVID prevalence; analyst inputs are planning assumptions, not observed effects. The three are never blended into one estimate.</p>
        </div>
        <div className="overview-provenance-slot"><OpeningProvenance playing={opening} /></div>
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
