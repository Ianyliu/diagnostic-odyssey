import "./DataRequestsPage.css";
import { Link } from "react-router-dom";
import { ContextBar } from "../components/ContextBar";
import { useArtifact } from "../data/ArtifactContext";

export function DataRequestsPage() {
  const {
    bundle,
    analystDataRequests,
    availableDataRequests,
    briefDataRequestIds,
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
        return <article className="card data-request-card" key={request.request_id}>
          <div className="card-title-row">
            <div>
              <p className="visual-kicker">{isAnalystRequest ? "SESSION PLANNING REQUEST" : "LOADED REQUEST TEMPLATE"}</p>
              <h2>{request.target_question}</h2>
            </div>
            <span className="status status-scaffold">{selected ? "Selected for Brief" : "Not in Brief"}</span>
          </div>
          <dl className="data-request-details">
            <div><dt>Pathway step</dt><dd>{request.pathway_step}</dd></div>
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
              <span><strong>Include in Planning Brief</strong><small>Explicit opt-in; creating a request alone is not enough.</small></span>
            </label>
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
      <span><strong>{briefDataRequestIds.length}</strong> request{briefDataRequestIds.length === 1 ? "" : "s"} selected for the Planning Brief.</span>
      <Link className="button" to="/brief">Preview Planning Brief</Link>
    </div>}
  </section>;
}
