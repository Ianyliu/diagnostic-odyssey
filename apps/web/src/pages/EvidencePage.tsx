import { Link } from "react-router-dom";
import { canDriveScenarioParameter, evidenceClaimLabel } from "@diagnostic-odyssey/evidence-core";
import { InterventionEvidenceGap } from "../components/PlanningInsights";
import { planningInsightsEnabled } from "../data/planningInsightsEnabled";
import { useArtifact } from "../data/ArtifactContext";
import { formatReviewerStatusLabel } from "../data/presentationLabels";
import { formatMechanismLabel, formatPathwayStepLabel } from "../data/pathwayBoundary";
import "./EvidencePage.css";

export function EvidencePage() {
  const { bundle, scenario } = useArtifact();
  if (!bundle) return null;
  const scenarioEligibleCount = scenario
    ? bundle.evidence.filter(record => canDriveScenarioParameter(record, scenario).allowed).length
    : null;

  return (
    <section className="page page-stack evidence-page">
      <header className="section-header-bar">
        <div className="page-heading">
          <p className="eyebrow">EVIDENCE ADMISSIBILITY</p>
          <h1>Intervention evidence &amp; limits</h1>
          <p>Effect parameters stay separate from descriptive burden and assumptions.</p>
          <p className="micro-caption">Admissibility gate · Never assumed</p>
        </div>
        <div className="section-header-actions">
          <Link className="button secondary" to="/pilot">
            03 Simulate
          </Link>
          <Link className="button" to="/data-requests">
            Data Requests →
          </Link>
        </div>
      </header>

      <section className="card evidence-availability" aria-labelledby="evidence-availability-title">
        <p className="visual-kicker">CURRENT AVAILABILITY</p>
        <h2 id="evidence-availability-title">
          {bundle.evidence.length === 0
            ? "No intervention-effect record is loaded"
            : scenarioEligibleCount === null
              ? `${bundle.evidence.length} evidence record${
                  bundle.evidence.length === 1 ? "" : "s"
                } loaded; scenario match pending`
              : `${scenarioEligibleCount} of ${bundle.evidence.length} record${
                  bundle.evidence.length === 1 ? "" : "s"
                } pass the current-scenario use check`}
        </h2>
      </section>

      {planningInsightsEnabled && (
        <>
          <InterventionEvidenceGap id="evidence-narrative-options" />
          <Link className="text-button" to="/brief#planning-insights">
            See the current deterministic planning picture →
          </Link>
        </>
      )}

      {bundle.evidence.length === 0 ? (
        <div className="empty-state evidence-empty-state">
          <strong>No reviewed intervention-effect parameter is currently available.</strong>
          <p>
            Absence of a reviewed effect parameter is not evidence that an intervention has no effect. Causal benefit, savings, ROI, and preventable-cost claims remain unavailable.
          </p>
          <div className="empty-state-actions">
            <Link className="button" to="/pilot">
              Return to Pilot assumptions
            </Link>
            <Link className="button secondary" to="/data-requests">
              Review operational data requests
            </Link>
          </div>
        </div>
      ) : (
        <div className="evidence-record-list">
          {bundle.evidence.map(record => {
            const currentUse = scenario ? canDriveScenarioParameter(record, scenario) : null;
            return (
              <article className="card evidence-record" key={record.evidence_id}>
                <p className="visual-kicker">EVIDENCE RECORD · {record.evidence_id}</p>
                <h2>{record.allowed_use}</h2>
                <p className="subtle">{record.source}</p>
                <div className="evidence-state-grid" role="group" aria-label="Distinct evidence use states">
                  <div>
                    <span>Reviewer state</span>
                    <strong
                      className={`status ${
                        record.reviewer_status === "approved"
                          ? "status-reviewed"
                          : "status-unavailable"
                      }`}
                    >
                      {formatReviewerStatusLabel(record.reviewer_status)}
                    </strong>
                  </div>
                  <div>
                    <span>Claim admissibility</span>
                    <strong>{evidenceClaimLabel(record)}</strong>
                  </div>
                  <div>
                    <span>Scenario eligibility</span>
                    <strong>
                      {currentUse
                        ? currentUse.allowed
                          ? "Eligible for bounded parameter use"
                          : "Not eligible for parameter use"
                        : "Not checked without a scenario"}
                    </strong>
                  </div>
                </div>
                <dl className="inspector-dl">
                  <div>
                    <dt>Why</dt>
                    <dd>{currentUse?.reason ?? "Scenario matching requires an active scenario."}</dd>
                  </div>
                  <div>
                    <dt>Limitations</dt>
                    <dd>{record.limitations.join(" ") || "None supplied."}</dd>
                  </div>
                </dl>
                <details className="technical-disclosure">
                  <summary>Evidence provenance</summary>
                  <p>
                    <strong>Locator:</strong> {record.locator} · <strong>Pathway:</strong>{" "}
                    {record.pathway_step ? formatPathwayStepLabel(record.pathway_step) : "None"} ·{" "}
                    <strong>Mechanism:</strong>{" "}
                    {record.target_mechanism
                      ? formatMechanismLabel(record.target_mechanism)
                      : "None"}
                  </p>
                </details>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
