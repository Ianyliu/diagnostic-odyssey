import "./DataRequestsPage.css";
import { Link } from "react-router-dom";
import { ContextBar } from "../components/ContextBar";
import { useArtifact } from "../data/ArtifactContext";
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
    removeAnalystDataRequest
  } = useArtifact();
  if (!bundle) return null;

  const analystIds = new Set(analystDataRequests.map(request => request.request_id));

  return <section className="page page-stack">
    <ContextBar />
    <header className="page-heading">
      <p className="eyebrow">DATA REQUESTS</p>
      <h1>Turn uncertainty into a concrete request</h1>
      <p>Requests are planning artifacts, not observed evidence. Creating a request does not put it in the Planning Brief; inclusion requires an explicit analyst choice here.</p>
    </header>

    {availableDataRequests.length === 0 ? <div className="empty-state">
      <strong>No data requests have been created or loaded.</strong>
      <p>Stress-test a Pilot Planner assumption first, then create a request for the operational information that would reduce that uncertainty.</p>
      <Link className="button secondary" to="/pilot#sensitivity">Open sensitivity explorer</Link>
    </div> : <div className="data-request-grid">
      {availableDataRequests.map(request => {
        const isAnalystRequest = analystIds.has(request.request_id);
        const selected = briefDataRequestIds.includes(request.request_id);
        const sensitivityField = sensitivityFieldFromDataRequestId(request.request_id);
        const stale = isAnalystRequest &&
          sensitivityField !== null &&
          !isDataRequestCurrentForScenario(request, scenario);
        return <article className="card data-request-card" key={request.request_id}>
          <div className="card-title-row">
            <div>
              <p className="visual-kicker">{isAnalystRequest ? "SESSION PLANNING REQUEST" : "LOADED REQUEST TEMPLATE"}</p>
              <h2>{request.target_question}</h2>
            </div>
            <span className="status status-scaffold">
              {stale ? "Stale — excluded from Brief" : selected ? "Selected for Brief" : "Not in Brief"}
            </span>
          </div>
          <dl className="data-request-details">
            <div><dt>Pathway step</dt><dd>{formatPathwayStepLabel(request.pathway_step)}</dd></div>
            {request.target_mechanism && <div><dt>Target mechanism</dt><dd>{formatMechanismLabel(request.target_mechanism)}</dd></div>}
            <div><dt>Fields needed</dt><dd>{request.fields_needed.join(", ")}</dd></div>
            <div><dt>Likely owner</dt><dd>{request.likely_source_owner}</dd></div>
            <div><dt>Granularity / time window</dt><dd>{request.granularity_time_window}</dd></div>
            <div><dt>Why collect it</dt><dd>{request.rationale}</dd></div>
            <div><dt>Feasibility / privacy</dt><dd>{request.feasibility_privacy_notes}</dd></div>
          </dl>
          <div className="data-request-actions">
            <label className="brief-selection">
              <input
                type="checkbox"
                checked={selected}
                onChange={() => toggleDataRequestForBrief(request.request_id)}
              />
              <span>
                <strong>Include in Planning Brief</strong>
                <small>
                  {stale && selected
                    ? "Selected state is preserved, but this stale request is excluded from export until refreshed."
                    : "Explicit opt-in; creating a request alone is not enough."}
                </small>
              </span>
            </label>
            {stale && sensitivityField && scenario && scenarioResult && <button
              className="text-button"
              type="button"
              onClick={() =>
                upsertAnalystDataRequest(
                  createSensitivityDataRequest(scenario, sensitivityField)
                )
              }
            >Refresh data request</button>}
            {stale && sensitivityField && scenario && !scenarioResult && <span className="data-request-refresh-blocked">
              Fix the Pilot Planner inputs before refreshing this request.
            </span>}
            {isAnalystRequest && <button
              className="text-button"
              type="button"
              onClick={() => removeAnalystDataRequest(request.request_id)}
            >Remove session request</button>}
          </div>
        </article>;
      })}
    </div>}

    {availableDataRequests.length > 0 && <div className="request-footer-actions">
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
