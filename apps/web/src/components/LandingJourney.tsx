import { Link } from "react-router-dom";
import "./LandingJourney.css";

/**
 * Atelier Atlas sweeping Bezier cartographic pathway.
 * All destinations are real routes; SVG is decorative, links are HTML.
 */
const waypoints = [
  { label: "Costs", n: "01", to: "/burden", x: 96, y: 318, type: "evidence" },
  { label: "Terrain", n: "02", to: "/local-context", x: 302, y: 210, type: "context" },
  { label: "Simulate", n: "03", to: "/pilot", x: 511, y: 292, type: "assumption" },
  { label: "Requests", n: "Optional", to: "/data-requests", x: 716, y: 168, type: "gap" },
  { label: "Brief", n: "04", to: "/brief", x: 928, y: 108, type: "brief" }
] as const;

const route = "M96 318 C 191 318 187 210 302 210 S 417 292 511 292 S 631 168 716 168 S 834 108 928 108";

export function LandingJourney() {
  return (
    <nav className="atlas-journey" aria-label="Explore the evidence-to-action pathway">
      <div className="atlas-journey-canvas">
        <svg viewBox="0 0 1024 400" className="atlas-journey-path" aria-hidden="true">
          <defs>
            <pattern id="atlas-journey-hatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <rect width="8" height="8" fill="#2d2312" />
              <path d="M0 0V8" stroke="#c8923b" strokeWidth="2.5" />
            </pattern>
          </defs>
          <path d={route} fill="none" stroke="#3b4d63" strokeWidth="1.5" strokeDasharray="3 8" />
          <path d={route} className="atlas-journey-reveal" fill="none" stroke="#c8923b" strokeOpacity="0.72" strokeWidth="2.2" strokeLinecap="round" />
          {waypoints.map(item => (
            <circle
              key={item.to}
              className={"atlas-journey-point is-" + item.type}
              cx={item.x}
              cy={item.y}
              r={item.type === "brief" ? 14 : 10}
              fill={item.type === "assumption" ? "url(#atlas-journey-hatch)" : undefined}
              strokeWidth="2.5"
            />
          ))}
        </svg>
        {waypoints.map((item, i) => (
          <Link
            key={item.to}
            to={item.to}
            className={"atlas-journey-stop atlas-journey-stop-" + i}
          >
            <span className="atlas-journey-stop-number">{item.n}</span>
            <span className="atlas-journey-stop-label">{item.label}</span>
          </Link>
        ))}
      </div>
      <ol className="atlas-journey-mobile">
        {waypoints.map(item => (
          <li key={item.to} className={"is-" + item.type}>
            <Link to={item.to}>
              <small>{item.n}</small>
              <span>{item.label}</span>
              <span aria-hidden="true">↗</span>
            </Link>
          </li>
        ))}
      </ol>
    </nav>
  );
}
