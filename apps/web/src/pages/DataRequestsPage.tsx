import "./DataRequestsPage.css";
import { useState } from "react";
import { Link } from "react-router-dom";
import { WorkspaceDisclosure } from "../components/WorkspaceDisclosure";
import { ContextBar } from "../components/ContextBar";
import { useArtifact } from "../data/ArtifactContext";
import { acquisitionResolver } from "@diagnostic-odyssey/acquisition-hints";
import { AcquisitionGuidanceStatus } from "../components/AcquisitionGuidanceCard";
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
    removeAnalystDataRequest,
    attachAcquisitionHint,
    removeAcquisitionHint
  } = useArtifact();
  if (!bundle) return null;

  const analystIds = new Set(analystDataRequests.map(request => request.request_id));

  return <section className="page page-stack data-requests-page">
    <ContextBar />
    <header className="page-heading">
      <p className="eyebrow">DATA REQUESTS</p>
      <h1 id="data-requests-heading" tabIndex={-1}>Turn uncertainty into a concrete request</h1>
      <p>Requests are planning artifacts, not observed evidence. Creating a request does not put it in the Planning Brief; inclusion requires an explicit analyst choice here.</p>
    </header>
    <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">{announcement}</p>

    {availableDataRequests.length === 0 ? <div className="empty-state">
      <strong>No data requests have been created or loaded.</strong>
      <p>Stress-test a Pilot planner assumption first, then create a request for the operational information that would reduce that uncertainty.</p>
      <Link className="button secondary" to="/pilot#sensitivity">Open sensitivity explorer</Link>
    </div> : <div className="data-request-grid" role="group" aria-label="Available data requests">
      {availableDataRequests.map(request => {
        const isAnalystRequest = analystIds.has(request.request_id);
        const selected = briefDataRequestIds.includes(request.request_id);
        const sensitivityField = sensitivityFieldFromDataRequestId(request.request_id);
        const stale = isAnalystRequest &&
          sensitivityField !== null &&
          !isDataRequestCurrentForScenario(request, scenario);
        const acquisition = acquisitionResolver.resolve(request, bundle.context, scenarioResult ? scenario : null);
        const attachable = isAnalystRequest && acquisitionResolver.attach(request, bundle.context, scenarioResult ? scenario : null).state === "reviewed";
        return <article className="data-request-sheet" key={request.request_id}>
          <header className="request-sheet-heading">
            <div>
              <p className="visual-kicker">{isAnalystRequest ? "SESSION PLANNING REQUEST" : "LOADED REQUEST TEMPLATE"}</p>
              <h2 id={`request-title-${request.request_id}`}>{request.target_question}</h2>
            </div>
            <div className="request-sheet-states" role="group" aria-label="Freshness and Brief selection">
              <span className={`status ${stale ? "status-warning" : "status-neutral"}`}>
                {stale ? "Stale for applied scenario" : isAnalystRequest ? "Current for applied scenario" : "Loaded template"}
              </span>
              <span className={`status ${selected ? "status-selection" : "status-neutral"}`}>
                {selected ? "Selected for Brief" : "Not selected for Brief"}
              </span>
            </div>
          </header>
          <p className="request-owner"><strong>Likely owner:</strong> {request.likely_source_owner}</p>
          <WorkspaceDisclosure id={`request-details-${request.request_id}`} title="Request details & collection guidance">
          <dl className="data-request-details">
            <div><dt>Pathway step</dt><dd>{formatPathwayStepLabel(request.pathway_step)}</dd></div>
            {request.target_mechanism && <div><dt>Target mechanism</dt><dd>{formatMechanismLabel(request.target_mechanism)}</dd></div>}
            <div><dt>Granularity / time window</dt><dd>{request.granularity_time_window}</dd></div>
            <div className="request-fields"><dt>Fields needed</dt><dd>{request.fields_needed.join(", ")}</dd></div>
          </dl>
          <div className="request-rationale"><h3>Why collect it</h3><p>{request.rationale}</p></div>
          <details className="technical-disclosure request-privacy"><summary>Feasibility and privacy</summary><p>{request.feasibility_privacy_notes}</p></details>
          <AcquisitionGuidanceStatus resolution={acquisition} />
          {attachable && acquisition.state !== "reviewed" && <button type="button" className="text-button" onClick={() => {
            setAnnouncement(attachAcquisitionHint(request.request_id) ? "Reviewed acquisition guidance attached. Brief selection is unchanged." : "Acquisition guidance is unavailable; the request is unchanged.");
          }}>{Object.hasOwn(request, "acquisition_hint") ? "Refresh acquisition guidance" : "Attach reviewed acquisition guidance"}</button>}
          {isAnalystRequest && Object.hasOwn(request, "acquisition_hint") && <button type="button" className="text-button" onClick={() => {
            removeAcquisitionHint(request.request_id);
            setAnnouncement("Acquisition guidance removed. Brief selection is unchanged.");
          }}>Remove acquisition guidance</button>}
            {isAnalystRequest && <button
              className="text-button"
              type="button"
              onClick={() => {
                removeAnalystDataRequest(request.request_id);
                setAnnouncement("Session request removed.");
                requestAnimationFrame(() =>
                  (document.getElementById("request-summary") ?? document.getElementById("data-requests-heading"))?.focus()
                );
              }}
            >Remove session request</button>}
          </WorkspaceDisclosure>
          <div className="data-request-actions">
            <label className="brief-selection">
              <input
                type="checkbox"
                aria-labelledby={`request-title-${request.request_id} request-action-${request.request_id}`}
                checked={selected}
                onChange={() => {
                  toggleDataRequestForBrief(request.request_id);
                  setAnnouncement(selected
                    ? "Request removed from Planning Brief selection."
                    : stale
                      ? "Request selected, but stale information is excluded from the Brief until refreshed."
                      : "Request selected for Planning Brief.");
                }}
              />
              <span>
                <strong id={`request-action-${request.request_id}`}>Include in Planning Brief</strong>
                <small>
                  {stale && selected
                    ? "Selected state is preserved, but this stale request is excluded from export until refreshed."
                    : "Explicit opt-in; creating a request alone is not enough."}
                </small>
              </span>
            </label>
            <div className="request-sheet-controls">
            {stale && sensitivityField && scenario && scenarioResult && <button
              className="text-button"
              type="button"
              onClick={() => {
                upsertAnalystDataRequest(
                  createSensitivityDataRequest(scenario, sensitivityField)
                );
                setAnnouncement("Data request refreshed for the applied scenario. Its Brief selection is unchanged.");
              }}
            >Refresh data request</button>}
            {stale && sensitivityField && scenario && !scenarioResult && <span className="data-request-refresh-blocked">
              Fix the Pilot planner inputs before refreshing this request.
            </span>}
            </div>
          </div>
        </article>;
      })}
    </div>}

    {availableDataRequests.length > 0 && <div id="request-summary" tabIndex={-1} className="request-footer-actions">
      <span>
        <strong>{selectedDataRequests.length}</strong> current request{selectedDataRequests.length === 1 ? "" : "s"} eligible for the Planning Brief.
        {briefDataRequestIds.length > selectedDataRequests.length
          ? ` ${briefDataRequestIds.length - selectedDataRequests.length} selected request(s) are stale and excluded until refreshed.`
          : ""}
      </span>
      <Link className="button" to="/brief">Preview Planning Brief</Link>
    </div>}
  </section>;
}
