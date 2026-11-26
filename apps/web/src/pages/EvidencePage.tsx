import { Link } from "react-router-dom";
import {
  canDriveScenarioParameter,
  evidenceClaimLabel
} from "@diagnostic-odyssey/evidence-core";
import { InterventionEvidenceGap } from "../components/PlanningInsights";
import { EvidenceTiming } from "../components/EvidenceTiming";
import { planningInsightsEnabled } from "../data/planningInsightsEnabled";
import { useArtifact } from "../data/ArtifactContext";
import { getEvidenceFreshness } from "../data/evidenceFreshness";
import { formatReviewerStatusLabel } from "../data/presentationLabels";
import {
  formatMechanismLabel,
  formatPathwayStepLabel
} from "../data/pathwayBoundary";
import "./EvidencePage.css";

export function EvidencePage() {
  const { bundle, localContext, scenario } = useArtifact();
  if (!bundle) return null;
  const scenarioEligibleCount = scenario
    ? bundle.evidence.filter(record => canDriveScenarioParameter(record, scenario).allowed).length
    : null;

  return (
    <section className="page page-stack evidence-page">
      <header className="page-heading">
        <p className="eyebrow">EVIDENCE LIMITS</p>
        <h1>Intervention evidence &amp; limits</h1>
        <p>Intervention-effect evidence stays separate from descriptive burden and planning math.</p>
      </header>

      <section className="card evidence-availability" aria-labelledby="evidence-availability-title">
        <p className="visual-kicker">AVAILABILITY</p>
        <h2 id="evidence-availability-title">
          {bundle.evidence.length === 0
            ? "No intervention-effect record is loaded"
            : scenarioEligibleCount === null
              ? `${bundle.evidence.length} record${bundle.evidence.length === 1 ? "" : "s"} loaded`
              : `${scenarioEligibleCount} of ${bundle.evidence.length} pass current-scenario eligibility`}
        </h2>
        <p className="subtle">Reviewer state, admissibility, and scenario matching are independent checks.</p>
      </section>

      <EvidenceTiming entries={getEvidenceFreshness(bundle, localContext)} />

      {planningInsightsEnabled && (
        <>
          <InterventionEvidenceGap id="evidence-narrative-options" />
          <Link className="text-button" to="/brief">Back to Brief →</Link>
        </>
      )}

      {bundle.evidence.length === 0 ? (
        <div className="empty-state evidence-empty-state">
          <strong>No reviewed intervention-effect parameter is available.</strong>
          <p>Absence of a reviewed effect parameter is not evidence that an intervention has no effect.</p>
          <div className="empty-state-actions">
            <Link className="button" to="/pilot">Return to Simulate</Link>
            <Link className="button secondary" to="/data-requests">Review Data Requests</Link>
          </div>
        </div>
      ) : (
        <div className="evidence-record-list">
          {bundle.evidence.map(record => {
            const currentUse = scenario
              ? canDriveScenarioParameter(record, scenario)
              : null;

            return (
              <article className="card evidence-record" key={record.evidence_id}>
                <p className="visual-kicker">EVIDENCE · {record.evidence_id}</p>
                <h2>{record.allowed_use}</h2>
                <p className="subtle">{record.source} · Source year {record.year}</p>

                <div className="evidence-state-grid" role="group" aria-label="Evidence use states">
                  <div>
                    <span>Reviewer</span>
                    <strong className={`status ${record.reviewer_status === "approved" ? "status-reviewed" : "status-unavailable"}`}>
                      {formatReviewerStatusLabel(record.reviewer_status)}
                    </strong>
                  </div>
                  <div>
                    <span>Admissibility</span>
                    <strong>{evidenceClaimLabel(record)}</strong>
                  </div>
                  <div>
                    <span>Scenario fit</span>
                    <strong>{currentUse ? (currentUse.allowed ? "Eligible" : "Not eligible") : "Pending"}</strong>
                  </div>
                </div>

                {currentUse?.reason && <p className="subtle">{currentUse.reason}</p>}

                <details className="technical-disclosure">
                  <summary>Provenance &amp; technical details</summary>
                  <p><strong>Locator:</strong> {record.locator}</p>
                  <p><strong>Population:</strong> {record.population}</p>
                  <p><strong>Outcome:</strong> {record.outcome}</p>
                  <p><strong>Pathway / mechanism:</strong> {record.pathway_step ? formatPathwayStepLabel(record.pathway_step) : "—"} · {record.target_mechanism ? formatMechanismLabel(record.target_mechanism) : "—"}</p>
                  <p><strong>Limitations:</strong> {record.limitations.join(" ") || "None listed."}</p>
                </details>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
