import { Link } from "react-router-dom";
import {
  canDriveScenarioParameter,
  evidenceClaimLabel
} from "@diagnostic-odyssey/evidence-core";
import { ContextBar } from "../components/ContextBar";
import { useArtifact } from "../data/ArtifactContext";
import { formatReviewerStatusLabel } from "../data/presentationLabels";
import {
  formatMechanismLabel,
  formatPathwayStepLabel
} from "../data/pathwayBoundary";

export function EvidencePage() {
  const {bundle, scenario} = useArtifact();
  if (!bundle) return null;

  return <section className="page page-stack">
    <ContextBar />
    <header className="page-heading">
      <h1>What this analysis supports</h1>
      <p>Intervention-effect evidence is kept separate from descriptive burden and planning assumptions.</p>
    </header>

    <section className="evidence-status-guide" aria-labelledby="evidence-status-guide-title">
      <h2 id="evidence-status-guide-title">How evidence labels affect planning use</h2>
      <dl>
        <div><dt>Supported</dt><dd>Reviewed evidence may support its stated use, subject to the record's pathway, mechanism, and limitations.</dd></div>
        <div><dt>Supported with bounds</dt><dd>Quantitative use may be allowed only within the reviewed bounds and matching scenario context.</dd></div>
        <div><dt>Limited use</dt><dd>The record can inform interpretation but does not permit quantitative scenario-parameter use.</dd></div>
        <div><dt>Insufficient evidence</dt><dd>The record does not support the proposed quantitative claim or parameter use.</dd></div>
      </dl>
      <p className="subtle">Admissibility alone is not enough: reviewer approval, pathway step, and target mechanism also determine whether a record can drive the current scenario.</p>
    </section>

    {bundle.evidence.length === 0 ? <div className="empty-state">
      <strong>No reviewed intervention-effect parameter is currently available for this planning model.</strong>
      <p>The Pilot therefore remains assumption-based. Causal benefit, savings, ROI, and preventable-cost claims remain unavailable.</p>
      <p>Absence of a reviewed effect parameter is not evidence that an intervention has no effect.</p>
      <div className="empty-state-actions">
        <Link className="button" to="/pilot">Return to Pilot assumptions</Link>
        <Link className="button secondary" to="/data-requests">Review operational data requests</Link>
      </div>
    </div> : bundle.evidence.map(record => {
      const currentUse = scenario
        ? canDriveScenarioParameter(record, scenario)
        : null;

      return <article className="card evidence-card" key={record.evidence_id}>
        <div className="card-title-row">
          <div>
            <h2>{record.allowed_use}</h2>
            <p className="subtle">{record.source}</p>
          </div>
          <span className="status status-scaffold">{evidenceClaimLabel(record)}</span>
        </div>
        <dl className="evidence-use-summary">
          <div>
            <dt>What this supports</dt>
            <dd>{record.allowed_use}</dd>
          </div>
          <div>
            <dt>Current planning use</dt>
            <dd>{currentUse
              ? currentUse.allowed
                ? "May drive a bounded quantitative parameter for the current scenario."
                : "May not drive a quantitative parameter for the current scenario."
              : "No current scenario is available for a scenario-specific eligibility check."}</dd>
          </div>
          <div>
            <dt>Why</dt>
            <dd>{currentUse?.reason ?? "Scenario-specific pathway and mechanism matching cannot be evaluated without a current scenario."}</dd>
          </div>
          <div>
            <dt>Limitations</dt>
            <dd>{record.limitations.join(" ") || "No additional limitation text supplied."}</dd>
          </div>
        </dl>
        <details className="technical-disclosure">
          <summary>Evidence provenance and technical details</summary>
          <p><strong>Source:</strong> {record.source}</p>
          <p><strong>Locator:</strong> {record.locator}</p>
          <p><strong>Population:</strong> {record.population}</p>
          <p><strong>Condition definition:</strong> {record.condition_definition}</p>
          <p><strong>Outcome:</strong> {record.outcome}</p>
          <p><strong>System boundary:</strong> {record.system_boundary}</p>
          <p><strong>Pathway step:</strong> {record.pathway_step ? formatPathwayStepLabel(record.pathway_step) : "Not specified"}</p>
          <p><strong>Target mechanism:</strong> {record.target_mechanism ? formatMechanismLabel(record.target_mechanism) : "Not specified"}</p>
          <p><strong>Uncertainty:</strong> {record.uncertainty ?? "Not specified"}</p>
          <p><strong>Reviewer state:</strong> {formatReviewerStatusLabel(record.reviewer_status)}</p>
          <p><strong>Admissibility:</strong> {evidenceClaimLabel(record)}</p>
          <p><strong>Limitations:</strong> {record.limitations.join(" ") || "None listed."}</p>
        </details>
      </article>;
    })}
  </section>;
}
