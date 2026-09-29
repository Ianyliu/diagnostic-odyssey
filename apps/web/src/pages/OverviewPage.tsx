import { Link } from "react-router-dom";
import { ContextBar } from "../components/ContextBar";
import { DecisionStateRail } from "../components/DecisionStateRail";
import { OpeningProvenance } from "./OpeningProvenance";
import "./OverviewPage.css";

const journey: ReadonlyArray<readonly [
  step: string,
  title: string,
  outcome: string,
  to: string
]> = [
  ["1", "Describe burden", "See reviewed national burden estimates with survey uncertainty.", "/burden"],
  ["2", "Review local constraints", "Review implementation and access context without turning national burden into a local disease estimate.", "/local-context"],
  ["3", "Scope a feasible pilot", "Set explicit planning assumptions and stress-test reach, capacity, timing, and resources.", "/pilot"],
  ["4", "Test evidence claims", "See what intervention-effect evidence can and cannot support for the current scenario.", "/evidence"],
  ["5", "Record data needs", "Keep operational questions and explicit Brief selections visible.", "/data-requests"],
  ["6", "Create a planning brief", "Export reviewed evidence, selected context, assumptions, boundaries, and remaining data needs.", "/brief"]
];

export function OverviewPage() {
  return (
    <section className="page page-stack overview-page">
      <div className="overview-hero">
        <header className="page-heading">
          <p className="eyebrow">DIAGNOSTIC ODYSSEY / OVERVIEW</p>
          <h1>Evidence you can trace.<br />Decisions you can explain.</h1>
          <p>Start with reviewed descriptive burden, add local implementation context, then test explicit planning assumptions. The source and limits of each layer stay visible.</p>
        </header>
        <OpeningProvenance />
      </div>
      <ContextBar />
      <section className="first-run-orientation" aria-labelledby="first-run-orientation-title">
        <h2 id="first-run-orientation-title">Read each layer on its own terms</h2>
        <p><strong>Burden</strong> is reviewed descriptive national evidence. <strong>Local Context</strong> describes implementation conditions, not localized disease burden. <strong>Pilot</strong> uses explicit planning assumptions. <strong>Evidence</strong> governs what intervention-effect claims may drive scenario parameters. <strong>Brief</strong> exports the current decision state and remaining gaps.</p>
      </section>
      <DecisionStateRail />
      <nav className="overview-destinations" aria-label="Workspace navigation">
        <div className="overview-destinations-heading"><p className="visual-kicker">EXPLORE THE WORKSPACE</p><h2>Follow a question through the evidence</h2></div>
      <div className="journey-grid">
        {journey.map(([step, title, outcome, to]) => (
          <Link key={step} className="journey-card" to={to}>
            <span className="journey-index" aria-hidden="true">{step.padStart(2, "0")}</span>
            <strong>{title}</strong>
            <small>{outcome}</small>
            <span className="journey-arrow" aria-hidden="true">↗</span>
          </Link>
        ))}
      </div>
      </nav>
    </section>
  );
}
