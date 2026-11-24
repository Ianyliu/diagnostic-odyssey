import { useState, type KeyboardEvent } from "react";
import { Link } from "react-router-dom";
import { canExportEstimate } from "@diagnostic-odyssey/contracts";
import { useArtifact } from "../data/ArtifactContext";
import { formatEstimateValue } from "../data/formatEstimateValue";
import { formatPlanningNumber } from "../data/planningNumberFormatting";
import "./OverviewPage.css";

interface TacticalNode {
  readonly id: string;
  readonly code: string;
  readonly title: string;
  readonly metric: string;
  readonly detail: string;
  readonly caption: string;
  readonly to: string;
  readonly cta: string;
  readonly tone: "evidence" | "terrain" | "simulation" | "brief";
  readonly x: number;
  readonly y: number;
}

const integer = new Intl.NumberFormat("en-US");

export function OverviewPage() {
  const {
    bundle,
    localContext,
    localContextStatus,
    scenarioResult,
    selectedLocalContextIds,
    selectedDataRequests
  } = useArtifact();
  const [activeNodeIndex, setActiveNodeIndex] = useState(0);

  const allMeasures = bundle?.burden_domains.flatMap(domain => domain.measures) ?? [];
  const reviewedCount = allMeasures.filter(canExportEstimate).length;
  const meanSpendingEstimate = allMeasures.find(
    estimate =>
      estimate.estimate_id === "meps24-gross-all-cause-spending-mean" &&
      canExportEstimate(estimate)
  );
  const meanSpendingDisplay = meanSpendingEstimate
    ? formatEstimateValue(meanSpendingEstimate)
    : "—";

  const localIndicatorCount =
    localContextStatus === "loaded" ? localContext?.indicators.length ?? 0 : null;
  const reachCount = scenarioResult
    ? formatPlanningNumber(scenarioResult.reached_participants, integer)
    : "—";

  const nodes: readonly TacticalNode[] = [
    {
      id: "burden",
      code: "01",
      title: "National Burden",
      metric: meanSpendingDisplay,
      detail: `${reviewedCount || "—"} reviewed MEPS measures`,
      caption: "National descriptive · Not causal",
      to: "/burden",
      cta: "Inspect national costs",
      tone: "evidence",
      x: 68,
      y: 132
    },
    {
      id: "terrain",
      code: "02",
      title: "Local Terrain",
      metric: localIndicatorCount !== null ? `${localIndicatorCount} signals` : "Unavailable",
      detail: "West Virginia HRSA & ACS constraints",
      caption: "State context · Not prevalence",
      to: "/local-context",
      cta: "Explore local terrain",
      tone: "terrain",
      x: 288,
      y: 74
    },
    {
      id: "simulate",
      code: "03",
      title: "Pilot Simulation",
      metric: `${reachCount} reach`,
      detail: "Deterministic capacity & resource math",
      caption: "Planning math · Not savings",
      to: "/pilot",
      cta: "Open simulator",
      tone: "simulation",
      x: 512,
      y: 74
    },
    {
      id: "brief",
      code: "04",
      title: "Action Brief",
      metric: `${selectedLocalContextIds.length} terrain · ${selectedDataRequests.length} gaps`,
      detail: "Decision dossier with boundaries intact",
      caption: "Boundaries intact · Export ready",
      to: "/brief",
      cta: "Review action brief",
      tone: "brief",
      x: 732,
      y: 132
    }
  ];

  const activeNode = nodes[activeNodeIndex] ?? nodes[0]!;

  const onNodeKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let next = index;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      next = (index + 1) % nodes.length;
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      next = (index - 1 + nodes.length) % nodes.length;
    } else if (event.key === "Home") {
      next = 0;
    } else if (event.key === "End") {
      next = nodes.length - 1;
    } else {
      return;
    }
    event.preventDefault();
    setActiveNodeIndex(next);
  };

  return (
    <div className="overview-command-page">
      <section className="obsidian-hero" aria-labelledby="overview-title">
        <div className="obsidian-grid-backdrop" aria-hidden="true" />
        <div className="obsidian-hero-inner">
          <p className="eyebrow">EDITION 01 · LONG COVID · WEST VIRGINIA</p>
          <h1 id="overview-title">
            See where health costs break. Move the right lever first.
          </h1>
          <p className="obsidian-subtitle">
            Separate national evidence, state constraints, and transparent pilot math.
          </p>

          <div className="tactical-arc-shell" aria-label="Four-stage strategy architecture">
            <svg
              className="tactical-arc-svg"
              viewBox="0 0 800 170"
              aria-hidden="true"
            >
              <line className="arc-axis" x1="40" y1="132" x2="760" y2="132" strokeWidth="1" />
              <path
                className="arc-track"
                d="M 68 132 Q 400 12 732 132"
                fill="none"
                strokeWidth="2"
              />
              <path
                className="arc-highlight"
                d="M 68 132 Q 400 12 732 132"
                fill="none"
                strokeWidth="2.5"
              />
              {nodes.map((node, index) => {
                const isActive = index === activeNodeIndex;
                return (
                  <g key={node.id} className={`arc-svg-node tone-${node.tone}${isActive ? " is-active" : ""}`}>
                    <line
                      className="arc-drop"
                      x1={node.x}
                      y1={node.y}
                      x2={node.x}
                      y2="132"
                      strokeWidth="1"
                    />
                    <circle className="arc-halo" cx={node.x} cy={node.y} r={isActive ? 18 : 11} />
                    <circle className="arc-core" cx={node.x} cy={node.y} r={isActive ? 7 : 5} />
                    <text className="arc-svg-code" x={node.x} y={node.y - 22} textAnchor="middle">
                      {node.code}
                    </text>
                  </g>
                );
              })}
            </svg>

            <div className="arc-node-buttons" role="tablist" aria-label="Select strategy stage">
              {nodes.map((node, index) => {
                const isActive = index === activeNodeIndex;
                return (
                  <button
                    key={node.id}
                    type="button"
                    role="tab"
                    id={`arc-tab-${node.id}`}
                    aria-selected={isActive}
                    aria-controls="arc-telemetry-card"
                    className={`arc-node-btn tone-${node.tone}${isActive ? " is-active" : ""}`}
                    onClick={() => setActiveNodeIndex(index)}
                    onKeyDown={event => onNodeKeyDown(event, index)}
                  >
                    <span className="arc-btn-code">{node.code}</span>
                    <span className="arc-btn-title">{node.title}</span>
                  </button>
                );
              })}
            </div>

            <div
              id="arc-telemetry-card"
              role="tabpanel"
              aria-labelledby={`arc-tab-${activeNode.id}`}
              className={`telemetry-readout tone-${activeNode.tone}`}
            >
              <div className="telemetry-readout-left">
                <span className="eyebrow">
                  {activeNode.code} · {activeNode.title}
                </span>
                <strong className="telemetry-readout-value">{activeNode.metric}</strong>
                <span className="telemetry-readout-detail">{activeNode.detail}</span>
                <span className="micro-caption">{activeNode.caption}</span>
              </div>
              <Link className="button" to={activeNode.to}>
                {activeNode.cta} <span aria-hidden="true">→</span>
              </Link>
            </div>
          </div>

          <dl className="monolith-strip" aria-label="Platform key metrics">
            <div className="monolith-cell tone-evidence">
              <dt>Mean annual all-cause spending</dt>
              <dd>{meanSpendingDisplay}</dd>
              <span className="micro-caption">National descriptive · Not causal</span>
            </div>
            <div className="monolith-cell tone-terrain">
              <dt>West Virginia access indicators</dt>
              <dd>{localIndicatorCount !== null ? `${localIndicatorCount} signals` : "—"}</dd>
              <span className="micro-caption">State context · Not prevalence</span>
            </div>
            <div className="monolith-cell tone-simulation">
              <dt>Pilot capacity reach baseline</dt>
              <dd>{reachCount} reach</dd>
              <span className="micro-caption">Planning math · Not savings</span>
            </div>
          </dl>

          <div className="obsidian-finale">
            <Link className="button obsidian-enter-btn" to="/burden">
              Enter Command Workspace <span aria-hidden="true">→</span>
            </Link>
            <Link className="button secondary" to="/pilot">
              Simulate Pilot
            </Link>
            <Link className="text-button" to="/advisor">
              Open AI Strategist →
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
