import { NavLink, Outlet } from "react-router-dom";

const nav = [
  ["/", "Overview"],
  ["/burden", "Burden"],
  ["/local-context", "Local context"],
  ["/pilot", "Pilot planner"],
  ["/evidence", "Evidence"],
  ["/brief", "Brief"]
] as const;

export function AppShell() {
  return (
    <div className="app-shell">
      <header className="site-header">
        <div className="brand">
          <strong>Diagnostic Odyssey</strong>
          <span>PUBLIC EVIDENCE LEDGER</span>
        </div>
        <nav aria-label="Primary navigation" className="primary-nav">
          {nav.map(([to, label]) => (
            <NavLink key={to} to={to} end={to === "/"} className={({isActive}) => isActive ? "active" : undefined}>
              {label}
            </NavLink>
          ))}
        </nav>
        <span className="header-meta">Federal data · public evidence</span>
      </header>
      <div className="prototype-strip" role="note">
        <strong>Prototype · illustrative fixtures until validated analytical artifacts are promoted</strong>
        <span>Burden evidence stays national; local context informs implementation only.</span>
      </div>
      <main>
        <Outlet />
      </main>
      <footer>
        <span>Diagnostic Odyssey</span>
        <span>No PHI · no county-specific Long COVID cost · no causal ROI claim</span>
      </footer>
    </div>
  );
}
