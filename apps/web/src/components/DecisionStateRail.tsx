import "./DecisionStateRail.css";
import { Link } from "react-router-dom";
import { canExportEstimate } from "@diagnostic-odyssey/contracts";
import { useArtifact } from "../data/ArtifactContext";
import { formatPathwayStepLabel } from "../data/pathwayBoundary";

type StateTone = "ready" | "context" | "assumption" | "gap";

interface DecisionState {
  label: string;
  status: string;
  detail: string;
  to: string;
  tone: StateTone;
}

export function DecisionStateRail() {
  const {
    bundle,
    localContext,
    localContextStatus,
    scenario,
    scenarioResult
  } = useArtifact();

  if (!bundle) return null;

  const releasedEstimates = bundle.burden_domains
    .flatMap(domain => domain.measures)
    .filter(canExportEstimate).length;
  const reviewedLocal = localContext?.indicators.filter(
    record => record.release_status === "reviewed_released"
  ).length ?? 0;
  const reviewedEvidence = bundle.evidence.filter(
    record => record.reviewer_status === "approved"
  ).length;

  const states: DecisionState[] = [
    {
      label: "National burden",
      status: "Reviewed",
      detail: `${releasedEstimates} released national estimates`,
      to: "/burden",
      tone: "ready"
    },
    {
      label: "Implementation context",
      status: localContextStatus === "loaded" ? "Reviewed state context" : "Unavailable",
      detail: localContextStatus === "loaded"
        ? `${reviewedLocal} reviewed ${localContext?.geography.geography_name ?? "local"} indicators`
        : "National burden remains unchanged",
      to: "/local-context",
      tone: localContextStatus === "loaded" ? "context" : "gap"
    },
    {
      label: "Pilot assumptions",
      status: scenarioResult ? "Active planning scenario" : "Unavailable",
      detail: scenarioResult && scenario
        ? `Target: ${formatPathwayStepLabel(scenario.target_pathway_step)}`
        : "No valid scenario result",
      to: "/pilot",
      tone: scenarioResult ? "assumption" : "gap"
    },
    {
      label: "Intervention evidence",
      status: reviewedEvidence > 0 ? "Reviewed evidence available" : "No reviewed effect parameter",
      detail: reviewedEvidence > 0
        ? `${reviewedEvidence} approved evidence record${reviewedEvidence === 1 ? "" : "s"}`
        : "Scenario remains assumption-based",
      to: "/evidence",
      tone: reviewedEvidence > 0 ? "ready" : "gap"
    },
    {
      label: "Planning brief",
      status: scenarioResult ? "Draftable" : "Waiting on scenario",
      detail: "Released evidence and explicit assumptions only",
      to: "/brief",
      tone: scenarioResult ? "ready" : "gap"
    }
  ];

  return <section className="decision-state-card" aria-labelledby="decision-state-title">
    <div className="decision-state-heading">
      <div>
        <p className="visual-kicker">CURRENT DECISION STATE</p>
        <h2 id="decision-state-title">What is known, assumed, and still missing?</h2>
      </div>
      <Link className="button secondary" to="/pilot#sensitivity">Stress-test assumptions</Link>
    </div>
    <ol className="decision-state-rail">
      {states.map((state, index) => <li key={state.label} className={`decision-state ${state.tone}`}>
        <span className="decision-state-marker" aria-hidden="true">{index + 1}</span>
        <div>
          <span className="decision-state-label">{state.label}</span>
          <strong>{state.status}</strong>
          <small>{state.detail}</small>
        </div>
        <Link to={state.to}>Open <span className="sr-only">{state.label}</span> →</Link>
      </li>)}
    </ol>
    <p className="visual-note">This is a workflow state summary, not a readiness score. No stage is weighted or converted into a composite rating.</p>
  </section>;
}
