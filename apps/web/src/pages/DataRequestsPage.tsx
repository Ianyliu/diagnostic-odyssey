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
import {
  formatMechanismLabel,
  formatPathwayStepLabel
} from "../data/pathwayBoundary";

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
      <header className="page-heading">
        <p className="eyebrow">OPTIONAL · DATA REQUESTS</p>
        <h1 id="data-requests-heading" tabIndex={-1}>Operational data requests</h1>
        <p>Planning artifacts tied to scenario assumptions; stale requests stay out of the Brief until refreshed.</p>
      </header>
      <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">{announcement}</p>

      {availableDataRequests.length === 0 ? (
        <div className="empty-state">
          <strong>No data requests created or loaded.</strong>
          <p>Run sensitivity in Simulate to generate a structured request.</p>
          <Link className="button secondary" to="/pilot#sensitivity">Open Sensitivity</Link>
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
                  setAnnouncement("All available data requests selected.");
                }}
                disabled={availableDataRequests.every(request => briefDataRequestIds.includes(request.request_id))}
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
              const stale = isAnalystRequest &&
                sensitivityField !== null &&
                !isDataRequestCurrentForScenario(request, scenario);
              const handoff = isAnalystRequest ? buildDataRequestHandoff(request, scenarioResult ? scenario : null) : null;
              const acquisition = acquisitionResolver.resolve(request, bundle.context, scenarioResult ? scenario : null);
              const attachable = isAnalystRequest && acquisitionResolver.attach(request, bundle.context, scenarioResult ? scenario : null).state === "reviewed";

              return (
                <article className="card data-request-sheet" key={request.request_id}>
                  <header className="request-sheet-heading">
                    <div>
                      <p className="visual-kicker">{isAnalystRequest ? "SESSION REQUEST" : "TEMPLATE"}</p>
                      <h2 id={`request-title-${request.request_id}`}>{request.target_question}</h2>
                    </div>
                    <div className="request-sheet-states" role="group" aria-label="Freshness and Brief selection">
                      <span className={`status ${stale ? "status-warning" : "status-neutral"}`}>
                        {stale ? "Stale" : isAnalystRequest ? "Current" : "Template"}
                      </span>
                      <span className={`status ${selected ? "status-selection" : "status-neutral"}`}>
                        {selected ? "In Brief" : "Excluded"}
                      </span>
                    </div>
                  </header>

                  <p className="request-owner"><strong>Likely owner:</strong> {request.likely_source_owner}</p>

                  {handoff && (
                    <section className="request-handoff" aria-labelledby={`request-decision-${request.request_id}`}>
                      <h3 id={`request-decision-${request.request_id}`}>Decision question</h3>
                      <p>{handoff.decisionQuestion}</p>
                      {!handoff.current && (
                        <p className="subtle">Scenario changed since creation; refresh to include in Brief.</p>
                      )}
                    </section>
                  )}

                  <WorkspaceDisclosure id={`request-details-${request.request_id}`} title="Fields, privacy & guidance">
                    <dl className="data-request-details">
                      <div><dt>Pathway step</dt><dd>{formatPathwayStepLabel(request.pathway_step)}</dd></div>
                      {request.target_mechanism && <div><dt>Mechanism</dt><dd>{formatMechanismLabel(request.target_mechanism)}</dd></div>}
                      <div><dt>Window</dt><dd>{request.granularity_time_window}</dd></div>
                      <div className="request-fields"><dt>Fields</dt><dd>{request.fields_needed.join(", ")}</dd></div>
                    </dl>
                    <p className="subtle">{request.feasibility_privacy_notes}</p>
                    <AcquisitionGuidanceStatus resolution={acquisition} />
                    {attachable && acquisition.state !== "reviewed" && (
                      <button
                        type="button"
                        className="text-button"
                        onClick={() => {
                          setAnnouncement(attachAcquisitionHint(request.request_id)
                            ? "Acquisition guidance attached."
                            : "Acquisition guidance unavailable.");
                        }}
                      >
                        Attach reviewed acquisition guidance
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
                        }}
                      >
                        Remove request
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
                          setAnnouncement(selected ? "Removed from Brief." : "Selected for Brief.");
                        }}
                      />
                      <span id={`request-action-${request.request_id}`}>Include in Brief</span>
                    </label>

                    {stale && sensitivityField && scenario && scenarioResult && (
                      <button
                        className="text-button"
                        type="button"
                        onClick={() => {
                          upsertAnalystDataRequest(createSensitivityDataRequest(scenario, sensitivityField));
                          setAnnouncement("Data request refreshed.");
                        }}
                      >
                        Refresh request
                      </button>
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
            <strong>{selectedDataRequests.length}</strong> eligible for Brief.
          </span>
          <Link className="button" to="/brief">Open Brief →</Link>
        </div>
      )}
    </section>
  );
}
