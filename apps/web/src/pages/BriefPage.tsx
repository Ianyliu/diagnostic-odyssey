import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { buildPlanningBrief, serializeBriefJson } from "@diagnostic-odyssey/brief-core";
import {
  canDisplayDistributionSummary,
  type Estimate
} from "@diagnostic-odyssey/contracts";
import { getEvidenceParameterReadiness, getNationalBurdenReadiness } from "../data/workspaceReadiness";
import { ContextBar } from "../components/ContextBar";
import { DecisionTrace } from "../components/DecisionTrace";
import { DistributionSummaryText } from "../components/DistributionSummaryText";
import { useArtifact } from "../data/ArtifactContext";
import {
  formatEstimateInterval,
  formatEstimateValue
} from "../data/formatEstimateValue";
import { mergeBriefLocalContext } from "../data/briefLocalContext";
import { formatLocalContextValue } from "../data/formatLocalContextValue";
import {
  deriveBriefContextWithSelectedLocalContext
} from "../data/localContextSelection";
import {
  formatPublishedLocalContextUncertainty
} from "../data/localContextPresentation";
import { PLANNING_DEFAULTS_LABEL } from "../data/planningScenarioDefaults";
import {
  formatMechanismLabel,
  formatPathwayStepLabel,
  getPathwayBoundaryPresentation
} from "../data/pathwayBoundary";
import { formatDataStateLabel } from "../data/presentationLabels";
import { withStaleSelectedDataRequestWarning } from "../data/briefDataRequestWarnings";
import { groupBriefBurdenFindings } from "../data/briefBurdenPresentation";
import {
  pilotInputFields
} from "../data/pilotInputDraft";
import { formatAppliedAssumption } from "./briefAssumptions";
import { createBriefPrintDisclosureState, executeBriefPrint, watchBriefPrintMedia } from "./briefPrint";
import "./BriefPage.css";

function AccessibleEstimateInterval({estimate}: {estimate: Estimate}) {
  const interval = formatEstimateInterval(estimate);
  const accessibleInterval = interval
    .replace(/^(\d+(?:\.\d+)?)% CI\s*/, "$1% confidence interval: ")
    .replace(/^CI\s*/, "Confidence interval: ");

  return <>
    <span aria-hidden="true">{interval}</span>
    <span className="sr-only">{accessibleInterval}</span>
  </>;
}

export function BriefPage() {
  const pageRef = useRef<HTMLElement>(null);
  const printDisclosureState = useRef<ReturnType<typeof createBriefPrintDisclosureState> | null>(null);
  const {
    bundle,
    scenario,
    scenarioResult,
    localContext,
    localContextStatus,
    selectedLocalContext,
    pilotLocalContext,
    availableDataRequests,
    briefDataRequestIds,
    selectedDataRequests
  } = useArtifact();

  useEffect(() => {
    const page = pageRef.current;
    if (!page) return;
    const state = createBriefPrintDisclosureState(
      () => Array.from(page.querySelectorAll<HTMLDetailsElement>("details"))
    );
    printDisclosureState.current = state;
    window.addEventListener("beforeprint", state.prepare);
    window.addEventListener("afterprint", state.restore);
    const stopWatchingPrintMedia = watchBriefPrintMedia(state);
    return () => {
      window.removeEventListener("beforeprint", state.prepare);
      window.removeEventListener("afterprint", state.restore);
      stopWatchingPrintMedia();
      state.restore();
      if (printDisclosureState.current === state) printDisclosureState.current = null;
    };
  }, [bundle]);

  if (!bundle) return null;

  const estimates = bundle.burden_domains.flatMap(domain => domain.measures);
  const briefLocalContext = mergeBriefLocalContext(
    selectedLocalContext,
    pilotLocalContext
  );
  const briefContext = deriveBriefContextWithSelectedLocalContext(
    bundle.context,
    localContextStatus,
    localContext,
    briefLocalContext
  );
  const staleSelectedDataRequestCount =
    Math.max(0, briefDataRequestIds.length - selectedDataRequests.length);
  const baseBrief = buildPlanningBrief({
    context: briefContext,
    estimates,
    localContext: briefLocalContext,
    scenario: scenario && scenarioResult ? {input:scenario,result:scenarioResult} : null,
    evidence: bundle.evidence,
    dataRequests: selectedDataRequests
  });
  const brief = withStaleSelectedDataRequestWarning(
    baseBrief,
    staleSelectedDataRequestCount
  );
  const burdenReadiness = getNationalBurdenReadiness(brief.burden_findings.length);
  const evidenceReadiness = getEvidenceParameterReadiness(
    bundle.evidence,
    brief.scenario?.input ?? null
  );
  const burdenGroups = groupBriefBurdenFindings(
    bundle.burden_domains,
    brief.burden_findings
  );
  const scenarioBoundary = brief.scenario
    ? getPathwayBoundaryPresentation(brief.scenario.input)
    : null;

  const localContextAvailable =
    localContextStatus === "loaded" && localContext !== null;

  const exportJson = () => {
    const blob = new Blob([serializeBriefJson(brief)],{type:"application/json"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href=url;
    a.download=brief.artifact_version + "-planning-brief.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  const printBrief = () => {
    executeBriefPrint(printDisclosureState.current);
  };

  return <section className="page page-stack planning-brief-page" ref={pageRef}>
    <ContextBar />
    <header className="page-heading">
      <p className="eyebrow">PLANNING BRIEF</p>
      <h1>Long COVID burden and pilot planning brief</h1>
      <p>Deterministic synthesis of reviewed national burden, analyst-supplied planning assumptions, explicitly selected implementation context, evidence gaps, and interpretation guardrails.</p>
    </header>

    <div className="print-provenance" role="group" aria-label="Planning Brief provenance">
      <strong>Brief provenance</strong>
      <span><b>National reviewed artifact:</b> {brief.artifact_version}</span>
      {brief.context.local_context_id && <span><b>Reviewed local-context artifact:</b> {brief.context.local_context_id}</span>}
      <span><b>Generated:</b> {brief.generated_at}</span>
    </div>

    <section className="brief-print-decision-state" aria-label="Decision state summary">
      <h2>Decision state</h2>
      <div><strong>Burden estimates</strong><span>{burdenReadiness.briefStatus}</span></div>
      <div><strong>Scenario arithmetic</strong><span>{brief.scenario ? "Planning assumptions" : "No applied scenario"}</span></div>
      <div><strong>Evidence parameter</strong><span>{evidenceReadiness.status}</span></div>
      <div><strong>Local context</strong><span>{brief.local_context.length > 0 ? `${brief.local_context.length} selected` : localContextAvailable ? "Available, not selected" : "Not selected"}</span></div>
      <div><strong>Data requests</strong><span>{selectedDataRequests.length > 0 ? `${selectedDataRequests.length} selected` : "None selected"}</span></div>
    </section>

    <div className="brief-grid">
      <aside className="brief-aside" aria-label="Planning Brief contents and actions">
        <nav className="brief-contents" aria-label="Planning Brief contents">
          <h2>Contents</h2>
          <a href="#brief-interpretation-boundaries">Interpretation boundaries</a>
          <a href="#brief-national-burden">Reviewed national burden</a>
          <a href="#brief-pilot-assumptions">Planning assumptions</a>
          {brief.scenario && <a href="#brief-scenario-outputs">Scenario outputs</a>}
          <a href="#brief-local-context">Local context</a>
          <a href="#brief-intervention-evidence">Intervention evidence</a>
          <a href="#brief-data-requests">Data requests</a>
        </nav>
        <div className="brief-readiness" role="group" aria-label="Current decision state">
          <div className="readiness"><strong>Burden estimates</strong><span className={`status status-${burdenReadiness.tone}`}>{burdenReadiness.briefStatus}</span></div>
        <div className="readiness"><strong>Scenario arithmetic</strong><span className={`status ${brief.scenario ? "status-assumption" : "status-unavailable"}`}>{brief.scenario ? "Planning assumptions" : "No applied scenario"}</span></div>
        <div className="readiness"><strong>Evidence parameter</strong><span className={`status status-${evidenceReadiness.tone}`}>{evidenceReadiness.status}</span></div>
        <div className="readiness">
          <strong>Local context</strong>
          <span className={brief.local_context.length > 0 ? "status status-selection" : localContextAvailable ? "status status-neutral" : "status status-unavailable"}>
            {brief.local_context.length > 0
              ? brief.local_context.length + " selected"
              : localContextAvailable ? "Available, not selected" : "Not selected"}
          </span>
        </div>
        <div className="readiness">
          <strong>Data requests</strong>
          <span className={`status ${selectedDataRequests.length > 0 ? "status-selection" : "status-neutral"}`}>
            {selectedDataRequests.length > 0 ? `${selectedDataRequests.length} selected` : "None selected"}
          </span>
        </div>
        </div>
        <div className="brief-export-actions">
          <button className="button" onClick={exportJson}>Export JSON companion</button>
          <button className="button secondary" onClick={printBrief}>Print / save PDF</button>
        </div>
      </aside>
      <article className="brief-content" aria-label="Planning Brief document">
        <section id="brief-interpretation-boundaries" className="interpretation-boundaries">
          <h2>Interpretation boundaries</h2>
          <ul>{brief.warnings.map(warning => <li key={warning}>{warning}</li>)}</ul>
        </section>

        <section id="brief-national-burden">
          <h2>Reviewed national burden findings</h2>
          {brief.burden_findings.length === 0 ? <div className="empty-state">
            <strong>No reviewed analytical estimate is currently export-eligible.</strong>
            <p>The release/display gate remains active; no unreleased or illustrative value is substituted.</p>
          </div> : <div className="brief-burden-groups">
            {burdenGroups.map(group => <section
              className={`brief-burden-group${group.findings.length <= 8 ? " brief-burden-group-short" : ""}`}
              aria-labelledby={`brief-burden-${group.group_id}`}
              key={group.group_id}
            >
              <div className="brief-burden-group-heading">
                <h3 id={`brief-burden-${group.group_id}`}>{group.label}</h3>
                <span className="status status-ok">{group.findings.length} reviewed</span>
              </div>
              <div className="brief-burden-table-wrap" role="region" tabIndex={0} aria-label={`${group.label} burden findings table`}>
                <table className="brief-burden-table">
                  <caption className="sr-only">{group.label} reviewed national burden findings</caption>
                  <thead>
                    <tr>
                      <th scope="col">Measure</th>
                      <th scope="col">Estimate</th>
                      <th scope="col">Confidence interval</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.findings.map(finding => <tr key={finding.estimate_id}>
                      <th scope="row">{finding.label}</th>
                      <td>
                        {canDisplayDistributionSummary(finding)
                          ? <DistributionSummaryText estimate={finding} />
                          : formatEstimateValue(finding)}
                      </td>
                      <td><AccessibleEstimateInterval estimate={finding} /></td>
                    </tr>)}
                  </tbody>
                </table>
              </div>
              <details className="brief-burden-details technical-disclosure">
                <summary>Interpretation and technical details</summary>
                {group.limitations.length > 0 && <p><strong>Domain limitations:</strong> {group.limitations.join(" ")}</p>}
                <ul>
                  {group.findings.map(finding => <li key={finding.estimate_id}>
                    <strong>{finding.label}:</strong> {finding.allowed_interpretation}
                    {finding.system_boundary && <> <span className="subtle">System boundary: {finding.system_boundary}</span></>}
                  </li>)}
                </ul>
              </details>
            </section>)}
          </div>}
        </section>

        <section id="brief-pilot-assumptions">
          <h2>Pilot planning assumptions</h2>
          <p className="subtle"><strong>{PLANNING_DEFAULTS_LABEL}</strong> These inputs are planning assumptions, not observed evidence.</p>
          {brief.scenario && scenarioBoundary ? <>
            <dl className="brief-applied-assumptions" aria-label={`${pilotInputFields.length} applied planning assumptions`}>
              {pilotInputFields.map(field => <div key={field.key}>
                <dt>{field.label}</dt>
                <dd>{formatAppliedAssumption(brief.scenario!.input, field)}</dd>
              </div>)}
            </dl>
            <dl className="brief-scenario-trace">
              <div><dt>Modeled pathway step</dt><dd>{scenarioBoundary.pathwayStepLabel}</dd></div>
              <div><dt>Assumed mechanism</dt><dd>{scenarioBoundary.mechanismLabel}</dd></div>
            </dl>
            <p>{scenarioBoundary.assumptionBoundaryStatement}</p>
            <p><strong>Outside this model:</strong> {scenarioBoundary.outsideModelItems.join("; ")}.</p>
          </> : <div className="empty-state"><strong>No valid planning scenario result is available.</strong><p>This does not alter the reviewed national burden findings.</p></div>}
        </section>

        {brief.scenario && <section id="brief-scenario-outputs" className="brief-output-section">
          <h2>Scenario outputs</h2>
          <p className="subtle">Deterministic planning quantities from the applied assumptions above; these are not a forecast or observed evidence.</p>
          <dl className="brief-output-list">
            <div><dt>Participants within capacity</dt><dd>{brief.scenario.result.reached_participants.toLocaleString()}</dd></div>
            <div><dt>Person-month planning exposure difference</dt><dd>{brief.scenario.result.difference_person_months.toLocaleString()}</dd></div>
            <div><dt>Program-resource requirement</dt><dd>{new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",maximumFractionDigits:0}).format(brief.scenario.result.program_resource_requirement)}</dd></div>
          </dl>
            <section className="brief-decision-trace" aria-labelledby="brief-decision-trace-title">
              <h3 id="brief-decision-trace-title">Decision trace</h3>
              <DecisionTrace
                burdenEstimateCount={brief.burden_findings.length}
                pilotLocalContext={pilotLocalContext}
                localContextStatus={localContextStatus}
                scenario={brief.scenario.input}
                currentDataRequestCount={selectedDataRequests.length}
                evidence={bundle.evidence}
                dataRequestHref="/data-requests"
              />
            </section>
        </section>}

        <section id="brief-local-context">
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
                        {pilotLocalContext?.indicator_id === record.indicator_id &&
                          <span className="status status-selection pilot-used-badge">Active Pilot planning context</span>}
                      </div>
                      <span className={record.state === "partial" ? "status status-partial" : "status status-reviewed"}>
                        {formatDataStateLabel(record.state)}
                      </span>
                    </div>
                    <p className="brief-local-context-value">{formatLocalContextValue(record)}</p>
                    <p className="subtle">
                      <strong>Source:</strong> {record.source_agency} · {record.source_release_vintage}
                    </p>
                    <p className="subtle">
                      <strong>Published uncertainty:</strong> {formatPublishedLocalContextUncertainty(record)}
                    </p>
                    <p className="subtle"><strong>Availability:</strong> {formatDataStateLabel(record.state)}</p>
                    <p className="limitations"><strong>Allowed interpretation:</strong> {record.allowed_interpretation}</p>
                    {record.prohibited_interpretation.length > 0 && <p className="limitations"><strong>Not supported:</strong> {record.prohibited_interpretation.join("; ")}</p>}
                    {record.limitations.length > 0 && <p className="limitations"><strong>Limitations:</strong> {record.limitations.join(" ")}</p>}
                  </article>
                )}
              </div>
            : <div className="empty-state">
                <strong>
                  {localContextAvailable
                    ? "Reviewed West Virginia state context is available, but no local context has been selected for this brief or used in Pilot planning."
                    : "No local context has been selected for this brief."}
                </strong>
                <p>
                  {localContextAvailable
                    ? "Review the available state evidence on the Local Context page. A record enters this Brief only through an explicit Include-in-Brief selection or an explicit Use-in-Pilot selection."
                    : "National MEPS burden remains unchanged; no local prevalence or state-specific Long COVID burden is inferred."}
                </p>
              </div>}
        </section>

        <section id="brief-intervention-evidence">
          <h2>Intervention-effect evidence</h2>
          {brief.evidence.length > 0
            ? brief.evidence.map(x => <p key={x.evidence_id}><strong>{x.allowed_use}</strong> — {x.source}</p>)
            : <div className="empty-state"><strong>No reviewed intervention-effect parameter is loaded.</strong><p>Causal benefit, savings, ROI, and preventable-cost claims remain unavailable.</p></div>}
        </section>

        <section id="brief-data-requests">
          <h2>What to collect next</h2>
          {brief.data_requests.length > 0
            ? <>
                <p className="subtle">Only requests explicitly selected by the analyst are included.</p>
                <ul>{brief.data_requests.map(request => <li key={request.request_id}>
                  <strong>{request.target_question}</strong> — {request.fields_needed.join(", ")}
                  <small className="brief-request-trace">
                    Pathway: {formatPathwayStepLabel(request.pathway_step)}
                    {request.target_mechanism && <> · Mechanism: {formatMechanismLabel(request.target_mechanism)}</>}
                  </small>
                </li>)}</ul>
              </>
            : <div className="empty-state">
                <strong>
                  {availableDataRequests.length > 0
                    ? "Data requests are available, but none has been selected for this brief."
                    : "No data request has been created or loaded."}
                </strong>
                <p>Data requests are planning artifacts, not observed evidence. Add or select them explicitly before export.</p>
                <Link className="button secondary" to="/data-requests">Review data requests</Link>
              </div>}
        </section>
      </article>


    </div>
    <div className="brief-print-footer" aria-hidden="true">
      <span>Diagnostic Odyssey</span>
      <span>{brief.artifact_version}</span>
      <span>{brief.generated_at}</span>
    </div>
  </section>;
}
