import { Link } from "react-router-dom";
import { ContextBar } from "../components/ContextBar";

const journey: ReadonlyArray<readonly [step: string, title: string, to: string]> = [
  ["1", "Describe burden", "/burden"],
  ["2", "Review local constraints", "/local-context"],
  ["3", "Scope a feasible pilot", "/pilot"],
  ["4", "Test evidence claims", "/evidence"],
  ["5", "Create a planning brief", "/brief"]
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
      <div className="journey-grid">
        {journey.map(([step, title, to]) => (
          <Link key={step} className="card journey-card" to={to}>
            <span>{step}</span>
            <strong>{title}</strong>
          </Link>
        ))}
      </div>
    </section>
  );
}
