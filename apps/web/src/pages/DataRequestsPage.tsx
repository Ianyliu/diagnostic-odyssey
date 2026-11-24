import "./DataRequestsPage.css";
import { useState } from "react";
import { Link } from "react-router-dom";
import { WorkspaceDisclosure } from "../components/WorkspaceDisclosure";
import { useArtifact } from "../data/ArtifactContext";
import { acquisitionResolver } from "@diagnostic-odyssey/acquisition-hints";
import { AcquisitionGuidanceStatus } from "../components/AcquisitionGuidanceCard";
import { buildDataRequestHandoff } from "../data/dataRequestHandoff";
import {
  createSensitivityDataRequest,
  isDataRequestCurrentForScenario,
  sensitivityFieldFromDataRequestId
} from "../data/dataRequestTemplates";
import { formatMechanismLabel, formatPathwayStepLabel } from "../data/pathwayBoundary";

export function DataRequestsPage() {
  const [announcement, setAnnouncement] = useState("");
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
      <header className="section-header-bar">
        <div className="page-heading">
          <p className="eyebrow">DATA REQUESTS</p>
          <h1 id="data-requests-heading" tabIndex={-1}>
            Turn uncertainty into a concrete request
          </h1>
          <p>Planning artifacts only; stale requests stay excluded until refreshed.</p>
          <p className="micro-caption">Aggregate only · Confirm with data owner</p>
        </div>
        <div className="section-header-actions">
          <Link className="button secondary" to="/pilot#sensitivity">
            03 Simulate
          </Link>
          <Link className="button" to="/brief">
            04 Brief →
          </Link>
        </div>
      </header>

      <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {announcement}
      </p>

      {availableDataRequests.length === 0 ? (
        <div className="empty-state">
          <strong>No data requests have been created or loaded.</strong>
          <p>Stress-test an assumption in 03 Simulate to flag missing operational data.</p>
          <Link className="button secondary" to="/pilot#sensitivity">
            Open sensitivity explorer
          </Link>
        </div>
      ) : (
        <>
          {availableDataRequests.length >= 2 && (
            <div className="selection-actions" role="group" aria-label="Data request selection controls">
              <button
                className="button secondary"
                type="button"
                onClick={() => {
                  selectAllDataRequestsForBrief();
                  setAnnouncement(
                    "All available data requests selected. Stale requests remain excluded from the Brief."
                  );
                }}
                disabled={availableDataRequests.every(request =>
                  briefDataRequestIds.includes(request.request_id)
                )}
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
            </div>
          )}

          <div className="data-request-grid" role="group" aria-label="Available data requests">
            {availableDataRequests.map(request => {
              const isAnalystRequest = analystIds.has(request.request_id);
              const selected = briefDataRequestIds.includes(request.request_id);
              const sensitivityField = sensitivityFieldFromDataRequestId(request.request_id);
              const stale =
                isAnalystRequest &&
                sensitivityField !== null &&
                !isDataRequestCurrentForScenario(request, scenario);
              const handoff = isAnalystRequest
                ? buildDataRequestHandoff(request, scenarioResult ? scenario : null)
                : null;
              const acquisition = acquisitionResolver.resolve(
                request,
                bundle.context,
                scenarioResult ? scenario : null
              );
              const attachable =
                isAnalystRequest &&
                acquisitionResolver.attach(
                  request,
                  bundle.context,
                  scenarioResult ? scenario : null
                ).state === "reviewed";

              return (
                <article className="card data-request-sheet" key={request.request_id}>
                  <header className="request-sheet-heading">
                    <div>
                      <p className="visual-kicker">
                        {isAnalystRequest ? "SESSION PLANNING REQUEST" : "LOADED REQUEST TEMPLATE"}
                      </p>
                      <h2 id={`request-title-${request.request_id}`}>{request.target_question}</h2>
                    </div>
                    <div className="request-sheet-states" role="group" aria-label="Freshness and Brief selection">
                      <span className={`status ${stale ? "status-warning" : "status-neutral"}`}>
                        {stale
                          ? "Stale for applied scenario"
                          : isAnalystRequest
                            ? "Current for applied scenario"
                            : "Loaded template"}
                      </span>
                      <span className={`status ${selected ? "status-selection" : "status-neutral"}`}>
                        {selected ? "Selected for Brief" : "Not selected for Brief"}
                      </span>
                    </div>
                  </header>

                  {handoff && (
                    <section
                      className="request-handoff"
                      aria-labelledby={`request-decision-${request.request_id}`}
                    >
                      <h3 id={`request-decision-${request.request_id}`}>Decision to resolve</h3>
                      <p>{handoff.decisionQuestion}</p>
                      {!handoff.current && (
                        <p className="subtle">
                          This request reflects earlier assumptions. Refresh after reviewing inputs.
                        </p>
                      )}
                    </section>
                  )}

                  <p className="request-owner">
                    <strong>Likely owner:</strong> {request.likely_source_owner}
                  </p>

                  <WorkspaceDisclosure
                    id={`request-details-${request.request_id}`}
                    title="Request details & collection guidance"
                  >
                    <dl className="data-request-details">
                      <div>
                        <dt>Pathway step</dt>
                        <dd>{formatPathwayStepLabel(request.pathway_step)}</dd>
                      </div>
                      {request.target_mechanism && (
                        <div>
                          <dt>Target mechanism</dt>
                          <dd>{formatMechanismLabel(request.target_mechanism)}</dd>
                        </div>
                      )}
                      <div>
                        <dt>Granularity / time window</dt>
                        <dd>{request.granularity_time_window}</dd>
                      </div>
                      <div>
                        <dt>Fields needed</dt>
                        <dd>{request.fields_needed.join(", ")}</dd>
                      </div>
                    </dl>
                    <p className="subtle">{request.rationale}</p>
                    <details className="technical-disclosure">
                      <summary>Feasibility and privacy</summary>
                      <p>{request.feasibility_privacy_notes}</p>
                    </details>
                    <AcquisitionGuidanceStatus resolution={acquisition} />
                    {attachable && acquisition.state !== "reviewed" && (
                      <button
                        type="button"
                        className="text-button"
                        onClick={() => {
                          setAnnouncement(
                            attachAcquisitionHint(request.request_id)
                              ? "Reviewed acquisition guidance attached."
                              : "Acquisition guidance unavailable."
                          );
                        }}
                      >
                        {Object.hasOwn(request, "acquisition_hint")
                          ? "Refresh acquisition guidance"
                          : "Attach reviewed acquisition guidance"}
                      </button>
                    )}
                    {isAnalystRequest && Object.hasOwn(request, "acquisition_hint") && (
                      <button
                        type="button"
                        className="text-button"
                        onClick={() => {
                          removeAcquisitionHint(request.request_id);
                          setAnnouncement("Acquisition guidance removed.");
                        }}
                      >
                        Remove acquisition guidance
                      </button>
                    )}
                    {isAnalystRequest && (
                      <button
                        className="text-button"
                        type="button"
                        onClick={() => {
                          removeAnalystDataRequest(request.request_id);
                          setAnnouncement("Session request removed.");
                          requestAnimationFrame(() =>
                            (
                              document.getElementById("request-summary") ??
                              document.getElementById("data-requests-heading")
                            )?.focus()
                          );
                        }}
                      >
                        Remove session request
                      </button>
                    )}
                  </WorkspaceDisclosure>

                  <div className="data-request-actions">
                    <label className="brief-selection">
                      <input
                        type="checkbox"
                        aria-labelledby={`request-title-${request.request_id} request-action-${request.request_id}`}
                        checked={selected}
                        onChange={() => {
                          toggleDataRequestForBrief(request.request_id);
                          setAnnouncement(
                            selected
                              ? "Request removed from Planning Brief selection."
                              : stale
                                ? "Request selected, but stale until refreshed."
                                : "Request selected for Planning Brief."
                          );
                        }}
                      />
                      <span>
                        <strong id={`request-action-${request.request_id}`}>
                          Include in Planning Brief
                        </strong>
                        <small className="subtle">
                          {stale && selected
                            ? " Selected state is preserved, but this stale request is excluded from export until refreshed."
                            : " Selected by default for convenience; review before export."}
                        </small>
                      </span>
                    </label>
                    {stale && sensitivityField && scenario && scenarioResult && (
                      <button
                        className="text-button"
                        type="button"
                        onClick={() => {
                          upsertAnalystDataRequest(
                            createSensitivityDataRequest(scenario, sensitivityField)
                          );
                          setAnnouncement("Data request refreshed for applied scenario.");
                        }}
                      >
                        Refresh data request
                      </button>
                    )}
                    {stale && sensitivityField && scenario && !scenarioResult && (
                      <span className="data-request-refresh-blocked">
                        Fix the Pilot planner inputs before refreshing this request.
                      </span>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </>
      )}

      {availableDataRequests.length > 0 && (
        <div id="request-summary" tabIndex={-1} className="request-footer-actions">
          <span>
            <strong>{selectedDataRequests.length}</strong> current request
            {selectedDataRequests.length === 1 ? "" : "s"} eligible for the Planning Brief.
          </span>
          <Link className="button" to="/brief">
            Preview Planning Brief
          </Link>
        </div>
      )}
    </section>
  );
}
