import "./DecisionStateRail.css";
import { Link } from "react-router-dom";
import { canExportEstimate } from "@diagnostic-odyssey/contracts";
import { useArtifact } from "../data/ArtifactContext";
import { formatPathwayStepLabel } from "../data/pathwayBoundary";
import { getNationalBurdenReadiness } from "../data/workspaceReadiness";

type StateTone = "reviewed" | "assumption" | "unavailable" | "neutral";

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
  const burdenReadiness = getNationalBurdenReadiness(releasedEstimates);
  const reviewedLocal = localContext?.indicators.filter(
    record => record.release_status === "reviewed_released"
  ).length ?? 0;
  const reviewedEvidence = bundle.evidence.filter(
    record => record.reviewer_status === "approved"
  ).length;

  const states: DecisionState[] = [
    {
      label: "National burden",
      status: burdenReadiness.railStatus,
      detail: releasedEstimates > 0
        ? `${releasedEstimates} released national estimates`
        : "Release/display gate remains active",
      to: "/burden",
      tone: burdenReadiness.tone
    },
    {
      label: "Implementation context",
      status: localContextStatus === "loaded" ? "Reviewed state context" : localContextStatus === "loading" ? "Loading" : "Unavailable",
      detail: localContextStatus === "loaded"
        ? `${reviewedLocal} reviewed ${localContext?.geography.geography_name ?? "local"} indicators`
        : "National burden remains unchanged",
      to: "/local-context",
      tone: localContextStatus === "loaded" ? "reviewed" : "unavailable"
    },
    {
      label: "Pilot assumptions",
      status: scenarioResult ? "Active planning scenario" : "Unavailable",
      detail: scenarioResult && scenario
        ? `Target: ${formatPathwayStepLabel(scenario.target_pathway_step)}`
        : "No valid scenario result",
      to: "/pilot",
      tone: scenarioResult ? "assumption" : "unavailable"
    },
    {
      label: "Intervention evidence",
      status: reviewedEvidence > 0 ? "Approved record present" : "No reviewed effect parameter",
      detail: reviewedEvidence > 0
        ? `${reviewedEvidence} approved record${reviewedEvidence === 1 ? "" : "s"}; current-scenario eligibility is checked separately`
        : "Scenario remains assumption-based",
      to: "/evidence",
      tone: reviewedEvidence > 0 ? "neutral" : "unavailable"
    },
    {
      label: "Planning brief",
      status: scenarioResult ? "Draft available" : "Waiting on scenario",
      detail: "Released evidence and explicit assumptions only",
      to: "/brief",
      tone: scenarioResult ? "neutral" : "unavailable"
    }
  ];

  return <section className="decision-state-card" aria-labelledby="decision-state-title">
    <div className="decision-state-heading">
      <div>
        <p className="visual-kicker">WORKFLOW STATE</p>
        <h2 id="decision-state-title">Current decision state</h2>
      </div>
      <Link className="button secondary" to="/pilot#sensitivity">Stress-test assumptions</Link>
    </div>
    <ul className="decision-state-rail">
      {states.map(state => <li key={state.label} className={`decision-state ${state.tone}`}>
        <div>
          <span className="decision-state-label">{state.label}</span>
          <strong className={`status status-${state.tone}`}>{state.status}</strong>
          <small>{state.detail}</small>
        </div>
        <Link to={state.to}>Review {state.label}<span aria-hidden="true"> →</span></Link>
      </li>)}
    </ul>
    <p className="visual-note">This is a workflow state summary, not a readiness score. No stage is weighted or converted into a composite rating.</p>
  </section>;
}
