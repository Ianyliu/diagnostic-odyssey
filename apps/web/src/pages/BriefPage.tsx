import { Link } from "react-router-dom";
import { buildPlanningBrief, serializeBriefJson } from "@diagnostic-odyssey/brief-core";
import { ContextBar } from "../components/ContextBar";
import { useArtifact } from "../data/ArtifactContext";
import {
  formatEstimateInterval,
  formatEstimateValue
} from "../data/formatEstimateValue";
import { formatLocalContextValue } from "../data/formatLocalContextValue";
import {
  deriveBriefContextWithSelectedLocalContext
} from "../data/localContextSelection";
import {
  formatPublishedLocalContextUncertainty
} from "../data/localContextPresentation";
import { PLANNING_DEFAULTS_LABEL } from "../data/planningScenarioDefaults";

export function BriefPage() {
  const {
    bundle,
    scenario,
    scenarioResult,
    localContext,
    localContextStatus,
    selectedLocalContext,
    availableDataRequests,
    briefDataRequestIds,
    selectedDataRequests
  } = useArtifact();
  if (!bundle) return null;

  const estimates = bundle.burden_domains.flatMap(domain => domain.measures);
  const briefContext = deriveBriefContextWithSelectedLocalContext(
    bundle.context,
    localContextStatus,
    localContext,
    selectedLocalContext
  );
  const brief = buildPlanningBrief({
    context: briefContext,
    estimates,
    localContext: selectedLocalContext,
    scenario: scenario && scenarioResult ? {input:scenario,result:scenarioResult} : null,
    evidence: bundle.evidence,
    dataRequests: selectedDataRequests
  });

  const localContextAvailable =
    localContextStatus === "loaded" && localContext !== null;
  const staleSelectedDataRequestCount =
    Math.max(0, briefDataRequestIds.length - selectedDataRequests.length);

  const exportJson = () => {
    const blob = new Blob([serializeBriefJson(brief)],{type:"application/json"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href=url;
    a.download=brief.artifact_version + "-planning-brief.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  return <section className="page page-stack">
    <ContextBar />
    <header className="page-heading">
      <p className="eyebrow">PLANNING BRIEF</p>
      <h1>Long COVID burden and pilot planning brief</h1>
      <p>Deterministic synthesis of reviewed national burden, analyst-supplied planning assumptions, explicitly selected implementation context, evidence gaps, and interpretation guardrails.</p>
    </header>

    <div className="brief-grid">
      <article className="card brief-content">
        <section>
          <h2>Reviewed national burden findings</h2>
          {brief.burden_findings.length === 0 ? <div className="empty-state">
            <strong>No reviewed analytical estimate is currently export-eligible.</strong>
            <p>The release/display gate remains active; no unreleased or illustrative value is substituted.</p>
          </div> : brief.burden_findings.map(x => {
            const interval = formatEstimateInterval(x);
            const accessibleInterval = interval
              .replace(/^(\d+(?:\.\d+)?)% CI\s*/, "$1% confidence interval: ")
              .replace(/^CI\s*/, "Confidence interval: ");
            return <p className="brief-finding" key={x.estimate_id}>
              <strong>{x.label}:</strong> {formatEstimateValue(x)}
              <small className="brief-finding-interval">
                <span aria-hidden="true">{interval}</span>
                <span className="sr-only">{accessibleInterval}</span>
              </small>
            </p>;
          })}
        </section>

        <section>
          <h2>Pilot planning assumptions</h2>
          <p className="subtle"><strong>{PLANNING_DEFAULTS_LABEL}</strong> These inputs are planning assumptions, not observed evidence.</p>
          {brief.scenario ? <>
            <p><strong>{brief.scenario.input.target_pathway_step}</strong> via {brief.scenario.input.mechanism}</p>
            <p>{brief.scenario.result.reached_participants.toLocaleString()} participants within capacity; {brief.scenario.result.difference_person_months.toLocaleString()} person-month planning exposure difference.</p>
            <p>Program-resource requirement: {new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",maximumFractionDigits:0}).format(brief.scenario.result.program_resource_requirement)}.</p>
          </> : <div className="empty-state"><strong>No valid planning scenario result is available.</strong><p>This does not alter the reviewed national burden findings.</p></div>}
        </section>

        <section>
          <h2>Local implementation context</h2>
          {brief.local_context.length > 0
            ? <div className="brief-local-context-list">
                <p className="subtle">
                  <strong>Reviewed local-context artifact:</strong> {brief.context.local_context_id}
                </p>
                {brief.local_context.map(record =>
                  <article className="brief-local-context" key={record.indicator_id}>
                    <div className="card-title-row">
                      <div>
                        <strong>{record.label}</strong>
                        <span>{record.geography_name} ({record.geography_type})</span>
                      </div>
                      <span className={record.state === "partial" ? "status status-scaffold" : "status status-ok"}>
                        {record.state === "partial" ? "Partial data state" : "Loaded"}
                      </span>
                    </div>
                    <p className="brief-local-context-value">{formatLocalContextValue(record)}</p>
                    <p className="subtle">
                      <strong>Source:</strong> {record.source_agency} · {record.source_release_vintage}
                    </p>
                    <p className="subtle">
                      <strong>Published uncertainty:</strong> {formatPublishedLocalContextUncertainty(record)}
                    </p>
                    <p className="subtle"><strong>Data state:</strong> {record.state}</p>
                    <p className="limitations"><strong>Allowed interpretation:</strong> {record.allowed_interpretation}</p>
                    {record.prohibited_interpretation.length > 0 && <p className="limitations"><strong>Not supported:</strong> {record.prohibited_interpretation.join("; ")}</p>}
                    {record.limitations.length > 0 && <p className="limitations"><strong>Limitations:</strong> {record.limitations.join(" ")}</p>}
                  </article>
                )}
              </div>
            : <div className="empty-state">
                <strong>
                  {localContextAvailable
                    ? "Reviewed West Virginia state context is available, but no local context has been selected for this brief."
                    : "No local context has been selected for this brief."}
                </strong>
                <p>
                  {localContextAvailable
                    ? "Review the available state evidence on the Local Context page. An explicit analyst selection is required before any local-context record may enter a Planning Brief."
                    : "National MEPS burden remains unchanged; no local prevalence or state-specific Long COVID burden is inferred."}
                </p>
              </div>}
        </section>

        <section>
          <h2>Intervention-effect evidence</h2>
          {brief.evidence.length > 0
            ? brief.evidence.map(x => <p key={x.evidence_id}><strong>{x.allowed_use}</strong> — {x.source}</p>)
            : <div className="empty-state"><strong>No reviewed intervention-effect parameter is loaded.</strong><p>Causal benefit, savings, ROI, and preventable-cost claims remain unavailable.</p></div>}
        </section>

        <section>
          <h2>What to collect next</h2>
          {brief.data_requests.length > 0
            ? <>
                <p className="subtle">Only requests explicitly selected by the analyst are included.</p>
                <ul>{brief.data_requests.map(request => <li key={request.request_id}><strong>{request.target_question}</strong> — {request.fields_needed.join(", ")}</li>)}</ul>
              </>
            : <div className="empty-state">
                <strong>
                  {availableDataRequests.length > 0
                    ? "Data requests are available, but none has been selected for this brief."
                    : "No data request has been created or loaded."}
                </strong>
                <p>
                  Data requests are planning artifacts, not observed evidence. Add or select them explicitly before export.
                  {staleSelectedDataRequestCount > 0
                    ? ` ${staleSelectedDataRequestCount} selected request(s) are stale for the current scenario and are excluded from this Brief until explicitly refreshed.`
                    : ""}
                </p>
                <Link className="button secondary" to="/data-requests">Review data requests</Link>
              </div>}
        </section>

        <section><h2>Warnings</h2><ul>{brief.warnings.map(w=><li key={w}>{w}</li>)}</ul></section>
      </article>

      <aside className="card brief-aside">
        <h2>Decision readiness</h2>
        <div className="readiness"><strong>Burden estimates</strong><span className="status status-ok">Reviewed national</span></div>
        <div className="readiness"><strong>Scenario arithmetic</strong><span className="status status-scaffold">Planning assumptions</span></div>
        <div className="readiness"><strong>Evidence parameter</strong><span className="status status-scaffold">Not loaded</span></div>
        <div className="readiness">
          <strong>Local context</strong>
          <span className={brief.local_context.length > 0 ? "status status-ok" : "status status-scaffold"}>
            {brief.local_context.length > 0
              ? brief.local_context.length + " selected"
              : localContextAvailable ? "Available, not selected" : "Not selected"}
          </span>
        </div>
        <div className="readiness">
          <strong>Data requests</strong>
          <span className={`status ${selectedDataRequests.length > 0 ? "status-ok" : "status-scaffold"}`}>
            {selectedDataRequests.length > 0 ? `${selectedDataRequests.length} selected` : "None selected"}
          </span>
        </div>
        <button className="button" onClick={exportJson}>Export JSON companion</button>
        <button className="button secondary" onClick={()=>window.print()}>Print / save PDF</button>
      </aside>
    </div>
  </section>;
}
