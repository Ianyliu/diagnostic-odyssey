import { Link } from "react-router-dom";
import { ContextBar } from "../components/ContextBar";
import { DecisionStateRail } from "../components/DecisionStateRail";

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
  ["5", "Create a planning brief", "Export reviewed evidence, selected context, assumptions, boundaries, and remaining data needs.", "/brief"]
];

export function OverviewPage() {
  return (
    <section className="page page-stack">
      <ContextBar />
      <header className="page-heading">
        <p className="eyebrow">OVERVIEW</p>
        <h1>Start with evidence, then scope the decision.</h1>
        <p>
          Diagnostic Odyssey separates measured burden, local implementation context,
          planning assumptions, admissible evidence, and unanswered data needs.
        </p>
      </header>
      <section className="first-run-orientation" aria-labelledby="first-run-orientation-title">
        <h2 id="first-run-orientation-title">How the workspace fits together</h2>
        <p><strong>Burden</strong> is reviewed descriptive national evidence. <strong>Local Context</strong> describes implementation conditions, not localized disease burden. <strong>Pilot</strong> uses explicit planning assumptions. <strong>Evidence</strong> governs what intervention-effect claims may drive scenario parameters. <strong>Brief</strong> exports the current decision state and remaining gaps.</p>
      </section>
      <DecisionStateRail />
      <div className="journey-grid" aria-label="Workspace navigation">
        {journey.map(([step, title, outcome, to]) => (
          <Link key={step} className="card journey-card" to={to}>
            <span>{step}</span>
            <strong>{title}</strong>
            <small>{outcome}</small>
          </Link>
        ))}
      </div>
    </section>
  );
}
