import { useState } from "react";
import { Link } from "react-router-dom";
import type { EvidenceRecord } from "@diagnostic-odyssey/contracts";
import {
  canDriveScenarioParameter,
  evidenceClaimLabel
} from "@diagnostic-odyssey/evidence-core";
import { AppleDetailModal } from "../components/AppleDetailModal";
import { InterventionEvidenceGap } from "../components/PlanningInsights";
import { useArtifact } from "../data/ArtifactContext";
import { formatMechanismLabel, formatPathwayStepLabel } from "../data/pathwayBoundary";
import { planningInsightsEnabled } from "../data/planningInsightsEnabled";
import { formatReviewerStatusLabel } from "../data/presentationLabels";
import "./EvidencePage.css";

export function EvidencePage() {
  const { bundle, scenario } = useArtifact();
  const [inspectingRecord, setInspectingRecord] = useState<EvidenceRecord | null>(null);
  if (!bundle) return null;

  const scenarioEligibleCount = scenario
    ? bundle.evidence.filter(record => canDriveScenarioParameter(record, scenario).allowed).length
    : null;

  return (
    <section className="page page-stack evidence-page">
      <header className="apple-page-header">
        <p className="apple-kicker">Edition 01 · Evidence Admissibility</p>
        <h1>Intervention evidence &amp; limits.</h1>
        <p className="apple-subtitle">
          {bundle.evidence.length === 0
            ? "No reviewed intervention-effect record is loaded."
            : scenarioEligibleCount === null
              ? `${bundle.evidence.length} records loaded; scenario check pending.`
              : `${scenarioEligibleCount} of ${bundle.evidence.length} records pass scenario admissibility.`}
        </p>
        <p className="micro-caption">Admissibility gate · Separate from descriptive burden</p>
      </header>

      {planningInsightsEnabled && <InterventionEvidenceGap id="evidence-narrative-options" />}

      {bundle.evidence.length === 0 ? (
        <div className="empty-state">
          <strong>No reviewed intervention-effect parameter is loaded.</strong>
          <p>Absence of a reviewed parameter is not evidence of no effect. Simulator stays assumption-based.</p>
          <div className="selection-actions">
            <Link className="button" to="/pilot">Return to Simulator</Link>
            <Link className="button secondary" to="/data-requests">Review data requests</Link>
          </div>
        </div>
      ) : (
        <div className="evidence-record-list">
          {bundle.evidence.map(record => {
            const currentUse = scenario ? canDriveScenarioParameter(record, scenario) : null;
            return (
              <article className="apple-card evidence-record-card" key={record.evidence_id}>
                <div className="burden-card-top">
                  <div className="burden-card-title-group">
                    <span className="apple-kicker">{record.evidence_id}</span>
                    <h2>{record.allowed_use}</h2>
                    <span className="subtle">{record.source}</span>
                  </div>
                  <button
                    type="button"
                    className="apple-info-btn"
                    aria-label={`Details for ${record.evidence_id}`}
                    onClick={() => setInspectingRecord(record)}
                  >
                    i
                  </button>
                </div>

                <div className="request-pill-row">
                  <span className={`status ${record.reviewer_status === "approved" ? "status-reviewed" : "status-neutral"}`}>
                    {formatReviewerStatusLabel(record.reviewer_status)}
                  </span>
                  <span className="status status-selection">{evidenceClaimLabel(record)}</span>
                  <span className="status status-neutral">
                    {currentUse ? (currentUse.allowed ? "Eligible" : "Not eligible") : "Pending scenario"}
                  </span>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <details className="apple-accordion">
        <summary>How evidence labels affect planning use</summary>
        <dl className="technical-detail-list">
          <div><dt>Supported</dt><dd>Supports stated use within pathway, mechanism, and limitations.</dd></div>
          <div><dt>Supported with bounds</dt><dd>Quantitative use permitted only within reviewed bounds.</dd></div>
          <div><dt>Limited use</dt><dd>Informs interpretation only; no quantitative parameter use.</dd></div>
          <div><dt>Insufficient evidence</dt><dd>Does not support quantitative claim or parameter use.</dd></div>
        </dl>
      </details>

      <AppleDetailModal
        open={inspectingRecord !== null}
        kicker="Evidence Provenance"
        title={inspectingRecord?.allowed_use ?? ""}
        onClose={() => setInspectingRecord(null)}
      >
        {inspectingRecord && (
          <dl className="apple-detail-list">
            <div><dt>Source &amp; locator</dt><dd>{inspectingRecord.source} · {inspectingRecord.locator}</dd></div>
            <div><dt>Population</dt><dd>{inspectingRecord.population}</dd></div>
            <div><dt>Outcome</dt><dd>{inspectingRecord.outcome}</dd></div>
            <div><dt>System boundary</dt><dd>{inspectingRecord.system_boundary}</dd></div>
            <div>
              <dt>Pathway &amp; mechanism</dt>
              <dd>
                {inspectingRecord.pathway_step ? formatPathwayStepLabel(inspectingRecord.pathway_step) : "Not specified"} ·{" "}
                {inspectingRecord.target_mechanism ? formatMechanismLabel(inspectingRecord.target_mechanism) : "Not specified"}
              </dd>
            </div>
            <div><dt>Limitations</dt><dd>{inspectingRecord.limitations.join(" ") || "None listed."}</dd></div>
          </dl>
        )}
      </AppleDetailModal>
    </section>
  );
}
