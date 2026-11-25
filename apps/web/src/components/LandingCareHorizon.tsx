import "./LandingCareHorizon.css";

/**
 * Chapter I signature opening artwork: three distinct, non-blended ribbons
 * (reviewed national evidence, local access context, and planning assumptions)
 * gliding across a porcelain horizon into a folded Planning Brief outline.
 * Decorative SVG; all animations remain strictly CSS-driven and interruptible.
 */
export function LandingCareHorizon() {
  return (
    <div className="atlas-care-horizon" aria-hidden="true">
      <svg
        className="atlas-horizon-svg"
        viewBox="12 17 934 160"
        preserveAspectRatio="xMidYMid meet"
        focusable="false"
      >
        <defs>
          <pattern
            id="horizon-assumption-hatch"
            width="8"
            height="8"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(45)"
          >
            <rect width="8" height="8" className="horizon-hatch-bg" />
            <line x1="0" y1="0" x2="0" y2="8" className="horizon-hatch-stroke" strokeWidth="2.4" />
          </pattern>
        </defs>

        {/* Faint cartographic hairline horizon */}
        <line x1="24" y1="95" x2="834" y2="95" className="horizon-axis" strokeWidth="1" strokeDasharray="3 8" />

        {/* Track 1: Reviewed national evidence (solid cobalt) */}
        <path
          d="M 28 54 C 210 20, 390 132, 570 84 S 756 58, 842 74"
          pathLength={1}
          fill="none"
          className="horizon-ribbon horizon-ribbon-evidence"
          strokeWidth="4.2"
          strokeLinecap="round"
        />

        {/* Track 2: Local access terrain (crisp slate-blue double-line echo) */}
        <path
          d="M 28 100 C 228 134, 384 54, 574 96 S 756 102, 842 95"
          pathLength={1}
          fill="none"
          className="horizon-ribbon horizon-ribbon-context"
          strokeWidth="3.3"
          strokeLinecap="round"
        />

        {/* Track 3: Planning assumptions (dashed iris violet, visibly distinct) */}
        <path
          d="M 28 142 C 204 166, 400 76, 580 124 S 760 132, 842 116"
          pathLength={1}
          fill="none"
          className="horizon-ribbon horizon-ribbon-assumption"
          strokeWidth="3.3"
          strokeDasharray="7 5"
          strokeLinecap="round"
        />

        {/* Parallel arrival markers (never blended into one node) */}
        <circle cx="842" cy="74" r="4.5" className="horizon-node horizon-node-evidence" />
        <circle cx="842" cy="95" r="4.5" className="horizon-node horizon-node-context" />
        <circle cx="842" cy="116" r="4.5" className="horizon-node horizon-node-assumption" fill="url(#horizon-assumption-hatch)" />

        {/* Folded Planning Brief silhouette */}
        <g className="horizon-brief-mark">
          <path
            d="M 862 52 H 904 L 926 74 V 138 A 6 6 0 0 1 920 144 H 862 A 6 6 0 0 1 856 138 V 58 A 6 6 0 0 1 862 52 Z"
            pathLength={1}
            className="horizon-brief-outline"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <path d="M 904 52 V 74 H 926" fill="none" className="horizon-brief-fold" strokeWidth="1.6" strokeLinejoin="round" />
          <line x1="870" y1="84" x2="912" y2="84" className="horizon-brief-rule is-evidence" strokeWidth="2.6" strokeLinecap="round" />
          <line x1="870" y1="98" x2="906" y2="98" className="horizon-brief-rule is-context" strokeWidth="2.6" strokeLinecap="round" />
          <line x1="870" y1="112" x2="900" y2="112" className="horizon-brief-rule is-assumption" strokeWidth="2.6" strokeDasharray="5 3" strokeLinecap="round" />
        </g>
      </svg>

      <div className="atlas-horizon-legend">
        <span className="is-evidence"><i />Reviewed national evidence</span>
        <span className="is-context"><i />Local access conditions</span>
        <span className="is-assumption"><i />Editable pilot assumptions</span>
      </div>
    </div>
  );
}
