import { Link } from "react-router-dom";
import { canExportEstimate } from "@diagnostic-odyssey/contracts";
import { ContextBar } from "../components/ContextBar";
import { DecisionStateRail } from "../components/DecisionStateRail";
import { useArtifact } from "../data/ArtifactContext";
import { OpeningProvenance } from "./OpeningProvenance";
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
  ["4", "Test evidence claims", "See what intervention-effect evidence can and cannot support for the current scenario.", "/evidence"],
  ["5", "Record data needs", "Turn local uncertainty into structured operational data requests.", "/data-requests"],
  ["6", "Create a planning brief", "Export reviewed evidence, selected context, assumptions, boundaries, and remaining gaps.", "/brief"]
];

const roles = [
  {
    eyebrow: "01 / REVIEWED EVIDENCE",
    title: "Start with what the data can actually say.",
    body: "Survey-weighted national burden stays descriptive, versioned, and bounded by its source universe.",
    tone: "reviewed"
  },
  {
    eyebrow: "02 / LOCAL CONTEXT",
    title: "Add implementation reality without inventing local burden.",
    body: "HRSA and ACS context can inform operational judgment while remaining separate from national estimates.",
    tone: "context"
  },
  {
    eyebrow: "03 / ANALYST ASSUMPTIONS",
    title: "Stress-test the plan, not the evidence.",
    body: "Pilot inputs remain explicit assumptions so scenario arithmetic never masquerades as observed effect.",
    tone: "assumption"
  }
] as const;

export function OverviewPage() {
  const {bundle, localContext, localContextStatus} = useArtifact();
  const reviewedCount = bundle?.burden_domains
    .flatMap(domain => domain.measures)
    .filter(canExportEstimate).length ?? 0;
  const localIndicatorCount = localContextStatus === "loaded"
    ? localContext?.indicators.length ?? 0
    : null;

  return (
    <section className="page page-stack overview-page">
      <section className="overview-hero" aria-labelledby="overview-title">
        <div className="overview-hero-grid" aria-hidden="true" />
        <div className="overview-hero-copy">
          <h1 id="overview-title">
            Evidence into planning,
            <span>with boundaries intact.</span>
          </h1>
          <p className="overview-lede">
            Diagnostic Odyssey keeps reviewed national burden, local implementation context, and analyst assumptions visibly separate—then carries their provenance into one planning workflow.
          </p>
          <div className="overview-hero-actions" role="group" aria-label="Start exploring Diagnostic Odyssey">
            <Link className="button overview-primary-cta" to="/burden">Explore reviewed burden</Link>
            <Link className="button secondary overview-secondary-cta" to="/pilot">Open Pilot planner</Link>
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
        </div>
        <OpeningProvenance />
      </section>

      <ContextBar />

      <section className="overview-value-prop" aria-labelledby="overview-value-title">
        <div className="overview-section-heading">
          <p className="visual-kicker">DESIGNED FOR DEFENSIBLE DECISIONS</p>
          <h2 id="overview-value-title">One workspace. Three evidence roles. No black-box blending.</h2>
          <p>Each layer has its own visual language, provenance, and allowed interpretation. They meet in the planning artifact without becoming one opaque score.</p>
        </div>
        <div className="overview-role-grid">
          {roles.map(role => (
            <article className={`overview-role-card ${role.tone}`} key={role.eyebrow}>
              <p>{role.eyebrow}</p>
              <h3>{role.title}</h3>
              <span>{role.body}</span>
            </article>
          ))}
        </div>
      </section>

      <DecisionStateRail />

      <nav className="overview-destinations" aria-label="Workspace navigation">
        <div className="overview-section-heading overview-destinations-heading">
          <p className="visual-kicker">HOW IT WORKS</p>
          <h2>Follow one planning question from evidence to export.</h2>
          <p>Move through the workflow in order, or jump directly to the layer you need.</p>
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
      </nav>

    </section>
  );
}
