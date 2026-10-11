import { Link } from "react-router-dom";

export function PlaceholderPage({title, description}: {title: string; description: string}) {
  return (
    <section className="page page-stack">
      <div className="context-bar" role="group" aria-label="Analytical context">
        <strong>Analytical context</strong>
        <span className="chip">Current Long COVID</span>
        <span className="chip">Adults 18–64</span>
        <span className="chip">National evidence</span>
        <span className="chip">Replaceable local context</span>
      </div>
      <header className="page-heading">
        <p className="eyebrow">FULL PRODUCT ROUTE</p>
        <h1>{title}</h1>
        <p>{description}</p>
      </header>
      <div className="card placeholder-card">
        <div>
          <h2>Architecture is wired</h2>
          <p>This route is intentionally coarse in the first implementation pass. Domain contracts and release semantics are established before visual polish or deeper feature work.</p>
        </div>
        <span className="status status-unavailable">Scaffold only · no reviewed output</span>
      </div>
      <div className="guardrail">
        <strong>Scientific behavior</strong>
        <p>Missing, suppressed, illustrative, and released results remain distinct. Unavailable functionality is shown explicitly rather than simulated as complete.</p>
      </div>
      {title === "Burden overview" && <Link className="button" to="/pilot">Continue to Pilot planner</Link>}
    </section>
  );
}
