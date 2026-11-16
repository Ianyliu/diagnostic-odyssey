import { Link } from "react-router-dom";
import "./LandingJourney.css";

/**
 * Lovable-informed visual route, adapted to the existing four-stage contract.
 * Data Requests is a separate companion, never a fifth required stage.
 * All destinations are real routes; the SVG is decorative, links are HTML.
 */
const waypoints = [
  { label: "Burden", n: "01", to: "/burden", x: 96, y: 330, type: "evidence" },
  { label: "Local context", n: "02", to: "/local-context", x: 302, y: 216, type: "context" },
  { label: "Pilot planner", n: "03", to: "/pilot", x: 511, y: 305, type: "assumption" },
  { label: "Data requests", n: "Optional", to: "/data-requests", x: 716, y: 172, type: "gap" },
  { label: "Planning brief", n: "04", to: "/brief", x: 928, y: 112, type: "brief" }
] as const;

const route = "M96 330 C 191 330 187 216 302 216 S 417 305 511 305 S 631 172 716 172 S 834 112 928 112";

export function LandingJourney() {
  return <nav className="lovable-journey" aria-label="Explore the evidence-to-action pathway">
    <div className="lovable-journey-canvas">
      <svg viewBox="0 0 1024 430" className="lovable-journey-path" aria-hidden="true">
        <defs>
          <pattern id="lovable-journey-hatch" width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="9" height="9" fill="#f5e6b0" />
            <path d="M0 0V9" stroke="#c2933b" strokeWidth="3" />
          </pattern>
        </defs>
        <path d={route} fill="none" stroke="#627789" strokeWidth="1.7" strokeDasharray="2 9" />
        <path d={route} className="lovable-journey-reveal" fill="none" stroke="#e3ecf0" strokeWidth="2" strokeLinecap="round" />
        {waypoints.map(item => <circle key={item.to} className={"lovable-journey-point is-" + item.type}
          cx={item.x} cy={item.y} r={item.type === "brief" ? 15 : 11}
          fill={item.type === "assumption" ? "url(#lovable-journey-hatch)" : undefined}
          strokeWidth="3" />)}
      </svg>
      {waypoints.map((item, i) => <Link
        key={item.to} to={item.to}
        className={"lovable-journey-stop lovable-journey-stop-" + i}
        style={{left: (item.x / 1024) * 100 + "%", top: (item.y / 430) * 100 + "%"}}
      >
        <span className="lovable-journey-stop-number">{item.n}</span>
        <span className="lovable-journey-stop-label">{item.label}</span>
      </Link>)}
    </div>
    <ol className="lovable-journey-mobile">
      {waypoints.map(item => <li key={item.to} className={"is-" + item.type}>
        <Link to={item.to}><small>{item.n}</small><span>{item.label}</span><span aria-hidden="true">↗</span></Link>
      </li>)}
    </ol>
  </nav>;
}
