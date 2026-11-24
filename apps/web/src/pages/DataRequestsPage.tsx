import "./DataRequestsPage.css";
import { useState } from "react";
import { Link } from "react-router-dom";
import type { DataRequest } from "@diagnostic-odyssey/contracts";
import { acquisitionResolver } from "@diagnostic-odyssey/acquisition-hints";
import { AcquisitionGuidanceStatus } from "../components/AcquisitionGuidanceCard";
import { AppleDetailModal } from "../components/AppleDetailModal";
import { useArtifact } from "../data/ArtifactContext";
import { buildDataRequestHandoff } from "../data/dataRequestHandoff";
import {
  createSensitivityDataRequest,
  isDataRequestCurrentForScenario,
  sensitivityFieldFromDataRequestId
} from "../data/dataRequestTemplates";
import { formatMechanismLabel, formatPathwayStepLabel } from "../data/pathwayBoundary";

export function DataRequestsPage() {
  const [announcement, setAnnouncement] = useState("");
  const [inspectingRequest, setInspectingRequest] = useState<DataRequest | null>(null);
  const {
    bundle,
    scenario,
    scenarioResult,
    analystDataRequests,
    availableDataRequests,
    briefDataRequestIds,
    selectedDataRequests,
    upsertAnalystDataRequest,
    toggleDataRequestForBrief,
    selectAllDataRequestsForBrief,
    clearDataRequestsForBrief,
    removeAnalystDataRequest,
    attachAcquisitionHint,
    removeAcquisitionHint
  } = useArtifact();
  if (!bundle) return null;

  const analystIds = new Set(analystDataRequests.map(request => request.request_id));

  return (
    <section className="page page-stack data-requests-page">
      <header className="apple-page-header">
        <p className="apple-kicker">Edition 01 · Verification Loop</p>
        <h1 id="data-requests-heading" tabIndex={-1}>Operational data requests.</h1>
        <p className="apple-subtitle">
          Flag local metrics to confirm before finalizing your Brief.
        </p>
        <p className="micro-caption">Planning artifacts · Not observed evidence</p>
      </header>

      <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">{announcement}</p>

      {availableDataRequests.length === 0 ? (
        <div className="empty-state">
          <strong>No data requests created yet.</strong>
          <p>Run sensitivity in Simulator to flag operational assumptions.</p>
          <Link className="button secondary" to="/pilot#sensitivity">Open What-If Sensitivity</Link>
        </div>
      ) : (
        <>
          {availableDataRequests.length >= 2 && (
            <div className="apple-card terrain-selection-bar" role="group" aria-label="Data request selection controls">
              <strong>
                <span className="mono-figure">{selectedDataRequests.length}</span> current request{selectedDataRequests.length === 1 ? "" : "s"} eligible for Brief
              </strong>
              <div className="selection-actions">
                <button
                  className="button secondary"
                  type="button"
                  onClick={() => {
                    selectAllDataRequestsForBrief();
                    setAnnouncement("All available data requests selected.");
                  }}
                  disabled={availableDataRequests.every(r => briefDataRequestIds.includes(r.request_id))}
                >
                  Select all
                </button>
                <button
                  className="button secondary"
                  type="button"
                  onClick={() => {
                    clearDataRequestsForBrief();
                    setAnnouncement("All data requests deselected.");
                  }}
                  disabled={briefDataRequestIds.length === 0}
                >
                  Select none
                </button>
                <Link className="button" to="/brief">Preview Brief</Link>
              </div>
            </div>
          )}

          <div className="data-request-grid" role="group" aria-label="Available data requests">
            {availableDataRequests.map(request => {
              const isAnalystRequest = analystIds.has(request.request_id);
              const selected = briefDataRequestIds.includes(request.request_id);
              const sensitivityField = sensitivityFieldFromDataRequestId(request.request_id);
              const stale = isAnalystRequest &&
                sensitivityField !== null &&
                !isDataRequestCurrentForScenario(request, scenario);
              const acquisition = acquisitionResolver.resolve(request, bundle.context, scenarioResult ? scenario : null);
              const attachable = isAnalystRequest && acquisitionResolver.attach(request, bundle.context, scenarioResult ? scenario : null).state === "reviewed";

              return (
                <article className="apple-card data-request-card" key={request.request_id}>
                  <div className="burden-card-top">
                    <div className="burden-card-title-group">
                      <span className="apple-kicker">{isAnalystRequest ? "Session Request" : "Template"}</span>
                      <h2 id={`request-title-${request.request_id}`}>{request.target_question}</h2>
                    </div>
                    <button
                      type="button"
                      className="apple-info-btn"
                      aria-label={`Details for ${request.target_question}`}
                      onClick={() => setInspectingRequest(request)}
                    >
                      i
                    </button>
                  </div>

                  <div className="request-pill-row">
                    <span className={`status ${stale ? "status-warning" : "status-neutral"}`}>
                      {stale ? "Stale for applied scenario" : isAnalystRequest ? "Current" : "Template"}
                    </span>
                    <span className={`status ${selected ? "status-selection" : "status-neutral"}`}>
                      {selected ? "In Brief" : "Excluded"}
                    </span>
                  </div>

                  <p className="subtle"><strong>Owner:</strong> {request.likely_source_owner}</p>

                  <AcquisitionGuidanceStatus resolution={acquisition} />

                  <div className="terrain-card-controls">
                    <label className="ios-switch">
                      <input
                        type="checkbox"
                        aria-labelledby={`request-title-${request.request_id} request-action-${request.request_id}`}
                        checked={selected}
                        onChange={() => {
                          toggleDataRequestForBrief(request.request_id);
                          setAnnouncement(selected ? "Request removed from Brief." : "Request selected for Brief.");
                        }}
                      />
                      <span id={`request-action-${request.request_id}`}>Include in Planning Brief</span>
                    </label>

                    <div className="selection-actions">
                      {stale && sensitivityField && scenario && scenarioResult && (
                        <button
                          className="text-button"
                          type="button"
                          onClick={() => {
                            upsertAnalystDataRequest(createSensitivityDataRequest(scenario, sensitivityField));
                            setAnnouncement("Data request refreshed.");
                          }}
                        >
                          Refresh
                        </button>
                      )}
                      {stale && sensitivityField && scenario && !scenarioResult && (
                        <span className="field-error">Fix Pilot inputs before refreshing.</span>
                      )}
                      {attachable && acquisition.state !== "reviewed" && (
                        <button
                          type="button"
                          className="text-button"
                          onClick={() => setAnnouncement(
                            attachAcquisitionHint(request.request_id)
                              ? "Acquisition guidance attached."
                              : "Acquisition guidance unavailable."
                          )}
                        >
                          {Object.hasOwn(request, "acquisition_hint") ? "Refresh hint" : "Attach guidance"}
                        </button>
                      )}
                      {isAnalystRequest && Object.hasOwn(request, "acquisition_hint") && (
                        <button
                          type="button"
                          className="text-button"
                          onClick={() => {
                            removeAcquisitionHint(request.request_id);
                            setAnnouncement("Guidance removed.");
                          }}
                        >
                          Remove hint
                        </button>
                      )}
                      {isAnalystRequest && (
                        <button
                          className="text-button"
                          type="button"
                          onClick={() => {
                            removeAnalystDataRequest(request.request_id);
                            setAnnouncement("Session request removed.");
                          }}
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </>
      )}

      <AppleDetailModal
        open={inspectingRequest !== null}
        kicker="Data Request Provenance & Checklist"
        title={inspectingRequest?.target_question ?? ""}
        onClose={() => setInspectingRequest(null)}
      >
        {inspectingRequest && (() => {
          const isAnalyst = analystIds.has(inspectingRequest.request_id);
          const handoff = isAnalyst ? buildDataRequestHandoff(inspectingRequest, scenarioResult ? scenario : null) : null;
          return (
            <dl className="apple-detail-list">
              {handoff && (
                <div>
                  <dt>Decision to resolve</dt>
                  <dd>{handoff.decisionQuestion}</dd>
                </div>
              )}
              <div>
                <dt>Rationale</dt>
                <dd>{inspectingRequest.rationale}</dd>
              </div>
              <div>
                <dt>Pathway &amp; mechanism</dt>
                <dd>
                  {formatPathwayStepLabel(inspectingRequest.pathway_step)}
                  {inspectingRequest.target_mechanism ? ` · ${formatMechanismLabel(inspectingRequest.target_mechanism)}` : ""}
                </dd>
              </div>
              <div>
                <dt>Fields &amp; window</dt>
                <dd>{inspectingRequest.fields_needed.join(", ")} · {inspectingRequest.granularity_time_window}</dd>
              </div>
              <div>
                <dt>Feasibility &amp; privacy</dt>
                <dd>{inspectingRequest.feasibility_privacy_notes}</dd>
              </div>
            </dl>
          );
        })()}
      </AppleDetailModal>
    </section>
  );
}
