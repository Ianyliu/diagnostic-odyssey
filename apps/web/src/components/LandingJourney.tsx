import { Fragment } from "react";
import { Link } from "react-router-dom";
import { useOpeningMotionContext } from "../pages/OpeningProvenance";
import "./LandingJourney.css";

/**
 * Strategic Atlas sweeping Bezier cartographic pathway.
 * Primary spine moves 01 Burden -> 02 Local context -> 03 Strategy Lab -> 04 Planning Brief,
 * with Data requests shown as an explicit dashed optional spur off Strategy Lab.
 * All destinations are real routes; SVG is decorative, links are HTML.
 */
const waypoints = [
  { label: "Burden", n: "01", to: "/burden", x: 96, y: 196, type: "evidence" },
  { label: "Local context", n: "02", to: "/local-context", x: 356, y: 108, type: "context" },
  { label: "Strategy Lab", n: "03", to: "/pilot", x: 616, y: 146, type: "assumption" },
  { label: "Data requests", n: "Optional", to: "/data-requests", x: 736, y: 214, type: "gap" },
  { label: "Planning Brief", n: "04", to: "/brief", x: 912, y: 62, type: "brief" }
] as const;

const route = "M96 196 C 210 196 240 108 356 108 S 496 146 616 146 S 776 62 912 62";
const optionalSpur = "M616 146 C 650 202 686 214 736 214";

export function LandingJourney() {
  const { replay, runId, announcement } = useOpeningMotionContext();

  return (
    <nav className="atlas-journey" aria-label="Explore the evidence-to-action pathway">
      <div className="atlas-journey-canvas" data-replay-cycle={runId % 2}>
        <Fragment key={runId}>
          <svg viewBox="0 0 1024 260" className="atlas-journey-path" aria-hidden="true">
            <defs>
              <pattern id="atlas-journey-hatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                <rect width="8" height="8" fill="#251d40" />
                <path d="M0 0V8" stroke="#b8a5ff" strokeWidth="2.5" />
              </pattern>
            </defs>
            <path d={route} fill="none" stroke="#556b92" strokeWidth="1.5" strokeDasharray="3 8" />
            <path
              d={route}
              pathLength={1}
              className="atlas-journey-reveal"
              fill="none"
              stroke="#b8a5ff"
              strokeOpacity="0.95"
              strokeWidth="2.4"
              strokeLinecap="round"
            />
            <path
              d={optionalSpur}
              pathLength={1}
              className="atlas-journey-spur"
              fill="none"
              stroke="#9fb3d1"
              strokeOpacity="0.78"
              strokeWidth="2"
              strokeDasharray="6 5"
              strokeLinecap="round"
            />
            {waypoints.map(item => (
              <circle
                key={item.to}
                className={"atlas-journey-point is-" + item.type}
                cx={item.x}
                cy={item.y}
                r={item.type === "brief" ? 14 : item.type === "gap" ? 9 : 10}
                fill={item.type === "assumption" ? "url(#atlas-journey-hatch)" : undefined}
                strokeWidth="2.5"
              />
            ))}
          </svg>
        </Fragment>
        {waypoints.map((item, i) => (
          <Link
            key={item.to}
            to={item.to}
            className={"atlas-journey-stop atlas-journey-stop-" + i + (item.type === "gap" ? " is-optional-spur" : "")}
          >
            <span className="atlas-journey-stop-number">{item.n}</span>
            <span className="atlas-journey-stop-label">{item.label}</span>
          </Link>
        ))}
      </div>
      <Fragment key={`mobile-${runId}`}>
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
      </Fragment>
      <div className="atlas-journey-controls">
        <button type="button" className="preview-replay atlas-journey-replay" onClick={replay}>
          <span aria-hidden="true">↻</span> Replay animation
        </button>
        <span className="sr-only" role="status" aria-live="polite">{announcement}</span>
      </div>
    </nav>
  );
}
