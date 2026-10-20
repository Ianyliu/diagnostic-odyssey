import { formatPlanningCurrency, formatPlanningNumber } from "../data/planningNumberFormatting.ts";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { buildPlanningBrief, serializeBriefJson, type PlanningBrief } from "@diagnostic-odyssey/brief-core";
import { AcquisitionGuidanceCard } from "../components/AcquisitionGuidanceCard";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { PlanningInsights } from "../components/PlanningInsights";
import { BriefExecutiveSummary } from "../components/BriefExecutiveSummary";
import { buildPlanningInsights, buildVerifiedNationalBriefSection, type PlanningInsightsSources } from "../data/planningInsights";
import { planningInsightsEnabled } from "../data/planningInsightsEnabled";
import { AiHandoff } from "../components/AiHandoff";
import {
  canDisplayDistributionSummary,
  type Estimate
} from "@diagnostic-odyssey/contracts";
import { getEvidenceParameterReadiness, getNationalBurdenReadiness } from "../data/workspaceReadiness";
import { WorkspaceDisclosure } from "../components/WorkspaceDisclosure";
import { ContextBar } from "../components/ContextBar";
import { DecisionTrace } from "../components/DecisionTrace";
import { DistributionSummaryText } from "../components/DistributionSummaryText";
import { useArtifact } from "../data/ArtifactContext";
import {
  formatEstimateInterval,
  formatEstimateValue
} from "../data/formatEstimateValue";
import { mergeBriefLocalContext } from "../data/briefLocalContext";
import { selectBriefLocalContextPreview } from "../data/briefLocalContextPreview";
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

const resultNumber = new Intl.NumberFormat("en-US");

// Keep optional projection failures inside the same boundary as optional rendering.
function BriefInsights({brief, sources}: {brief: PlanningBrief; sources: PlanningInsightsSources}) {
  return <PlanningInsights model={buildPlanningInsights(brief, sources)} />;
}

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

// Transfer feedback is local to the control: it must not recompose the Brief
// (and its generated_at timestamp) after the serialized download is captured.
function BriefJsonExport({brief}: {brief: PlanningBrief}) {
  const [exportStatus, setExportStatus] = useState("");
  const exportJson = () => {
    let url: string | undefined;
    const anchor = document.createElement("a");
    try {
      url = URL.createObjectURL(new Blob([serializeBriefJson(brief)], {type: "application/json"}));
      anchor.href = url;
      anchor.download = brief.artifact_version + "-planning-brief.json";
      document.body.append(anchor);
      anchor.click();
      setExportStatus("JSON download requested with the current Planning Brief.");
    } catch {
      setExportStatus("JSON download could not start. Your Brief is unchanged; try again or use Print / save PDF.");
    } finally {
      anchor.remove();
      // Let the browser consume the URL before releasing it, as for Markdown.
      if (url) { const downloadUrl = url; setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000); }
    }
  };

  return <>
    <button className="button" onClick={exportJson}>Export JSON companion</button>
    <p className="brief-export-status subtle" role="status">{exportStatus}</p>
  </>;
}

interface FutureConceptControlProps {
  conceptAvailable?: boolean;
  showFutureConcept?: boolean;
  onFutureConceptChange?: (enabled: boolean) => void;
}
export function BriefPage({conceptAvailable = false, showFutureConcept = false, onFutureConceptChange}: FutureConceptControlProps = {}) {
  const pageRef = useRef<HTMLElement>(null);
  const [includeContextAppendixInPrint, setIncludeContextAppendixInPrint] = useState(false);
  const printDisclosureState = useRef<ReturnType<typeof createBriefPrintDisclosureState> | null>(null);
  const {
    status,
    bundle,
    scenario,
    scenarioResult,
    localContext,
    localContextStatus,
    selectedLocalContext,
    selectedLocalContextIds,
    pilotLocalContext,
    pilotLocalContextId,
    availableDataRequests,
    briefDataRequestIds,
    selectedDataRequests
  } = useArtifact();

  useEffect(() => {
    const page = pageRef.current;
    if (!page) return;
    const state = createBriefPrintDisclosureState(
      () => Array.from(page.querySelectorAll<HTMLDetailsElement>("details")), window
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

  // Hold the canonical export steady when changing screen disclosures or print options.
  // Only actual source, selection, scenario or request changes recompose this Brief.
  const brief = useMemo(() => {
    if (!bundle) return null;
    const estimates = bundle.burden_domains.flatMap(domain => domain.measures);
    const briefLocalContext = mergeBriefLocalContext(selectedLocalContext, pilotLocalContext);
    const briefContext = deriveBriefContextWithSelectedLocalContext(
      bundle.context, localContextStatus, localContext, briefLocalContext
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
    return withStaleSelectedDataRequestWarning(baseBrief, staleSelectedDataRequestCount);
  }, [bundle, selectedLocalContext, pilotLocalContext, localContextStatus, localContext,
    briefDataRequestIds, selectedDataRequests, scenario, scenarioResult]);

  if (!bundle || !brief) return null;

  const localContextPreview = selectBriefLocalContextPreview(brief.local_context);
  const nationalExecutive = buildVerifiedNationalBriefSection(brief, bundle);
  const staleSelectedDataRequestCount = Math.max(0, briefDataRequestIds.length - selectedDataRequests.length);
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

  const printBrief = () => {
    executeBriefPrint(printDisclosureState.current);
  };

  return <section className={`page page-stack planning-brief-page${includeContextAppendixInPrint ? " brief-include-context-appendix" : ""}`} ref={pageRef}>
    <ContextBar />
    <header className="page-heading">
      <p className="eyebrow">PLANNING BRIEF</p>
      <h1>Long COVID burden and pilot planning brief</h1>
      <p>Reviewed national evidence, selected local context and explicit pilot assumptions, with their limits and next data needs.</p>
    </header>

    <div className="brief-intelligence-actions">
      <div className="brief-handoff-entry">
          <AiHandoff brief={brief} sourceState={{status, localContextStatus,
            localArtifactVersion: localContext?.manifest.artifact_version ?? null,
            scenario, scenarioValid: !scenario || !!scenarioResult,
            selectedLocalContextIds, pilotLocalContextId, briefDataRequestIds}} />
      </div>
    {conceptAvailable && <div className="brief-concept-entry" role="group" aria-label="Future AI concept controls">
      <label className="brief-concept-toggle">
        <input type="checkbox" checked={showFutureConcept} onChange={event => onFutureConceptChange?.(event.target.checked)} />
        Show future AI concept
      </label>
      {showFutureConcept && <Link className="button secondary" to="/concept/future-ai">Explore future AI concept →</Link>}
      <small className="brief-concept-note">* Interactive concept only · No live AI or model API calls. You can hide or re-enable the preview here.</small>
    </div>}

    </div>
    <div className="brief-export-actions brief-primary-actions">
      <button className="button" onClick={printBrief}>Print / save PDF</button>
      <label className="brief-appendix-control"><input type="checkbox" checked={includeContextAppendixInPrint} onChange={event => setIncludeContextAppendixInPrint(event.target.checked)} /> Include detailed local-context records in print <small>Off by default for a concise Brief. All included records remain in the JSON companion and readable on screen.</small></label>
      <WorkspaceDisclosure id="brief-export-options" title="Export options"><BriefJsonExport brief={brief} /></WorkspaceDisclosure>
      <Link className="text-button" to="/data-requests">Review data needs</Link>
      <Link className="text-button" to="/evidence">Intervention evidence &amp; limits</Link>
    </div>
    <div className="print-provenance" role="group" aria-label="Planning Brief provenance">
      <strong>Brief provenance</strong>
      <span><b>National reviewed artifact:</b> {brief.artifact_version}</span>
      {brief.context.local_context_id && <span><b>Reviewed local-context artifact:</b> {brief.context.local_context_id}</span>}
      <span><b>Generated:</b> {brief.generated_at}</span>
    </div>

    <BriefExecutiveSummary brief={brief} national={nationalExecutive} checkboxSelectedIds={selectedLocalContextIds} pilotLocalContextId={pilotLocalContextId} staleRequestCount={staleSelectedDataRequestCount} />

    {planningInsightsEnabled && <ErrorBoundary fallback={<p className="insight-unavailable">Planning insights are unavailable. The reviewed Brief and exports remain available below.</p>}>
      <BriefInsights brief={brief} sources={{national: bundle, local: localContext, localStatus: localContextStatus, availableDataRequests}} />
    </ErrorBoundary>}

    <section className="brief-print-decision-state" aria-label="Decision state summary">
      <h2>Decision state</h2>
      <div><strong>Burden estimates</strong><span>{burdenReadiness.briefStatus}</span></div>
      <div><strong>Scenario arithmetic</strong><span>{brief.scenario ? "Planning assumptions" : "No applied scenario"}</span></div>
      <div><strong>Evidence parameter</strong><span>{evidenceReadiness.status}</span></div>
      <div><strong>Local context</strong><span>{brief.local_context.length > 0 ? `${brief.local_context.length} included` : localContextAvailable ? "Available, not selected" : "Not selected"}</span></div>
      <div><strong>Data requests</strong><span>{selectedDataRequests.length > 0 ? `${selectedDataRequests.length} selected` : "None selected"}</span></div>
    </section>

    <WorkspaceDisclosure id="brief-full-report" title="Read full brief" summary="All reviewed findings, assumptions, context, evidence limits and data requests remain available on screen. Printed local details are optional; canonical JSON remains complete.">
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
            <div><dt>Participants within capacity</dt><dd>{formatPlanningNumber(brief.scenario.result.reached_participants, resultNumber)}</dd></div>
            <div><dt>Person-month planning exposure difference</dt><dd>{formatPlanningNumber(brief.scenario.result.difference_person_months, resultNumber)}</dd></div>
            <div><dt>Program-resource requirement</dt><dd>{formatPlanningCurrency(brief.scenario.result.program_resource_requirement)}</dd></div>
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
          {brief.local_context.length > 0 && <div className="brief-local-context-executive" aria-label="Local context print synopsis">
            <p><strong>{brief.local_context.length} reviewed context record{brief.local_context.length === 1 ? "" : "s"} included in this Brief.</strong> These West Virginia indicators inform implementation planning; they do not estimate state Long COVID prevalence, modify national burden, or prove savings.</p>
            <p>HPSA figures describe shortage-area designations, not people; ACS figures describe statewide Census survey measures. An active Pilot-used record may be included separately from checkbox choices.</p>
            <ul>{localContextPreview.map(record => <li key={record.indicator_id}><strong>{record.label}:</strong> {formatLocalContextValue(record)} <span>({record.indicator_id}; {record.source_ref})</span></li>)}</ul>
            {brief.local_context.length > localContextPreview.length && <p>Showing {localContextPreview.length} source-traceable examples from the actual included selection, not a ranking or aggregate. The canonical JSON companion contains all {brief.local_context.length} complete records, source locators, released interpretations and limitations. Enable the detailed print option to include their full text in the PDF.</p>}
            <p><strong>Reviewed local artifact:</strong> {brief.context.local_context_id}</p>
          </div>}
          {brief.local_context.length > 0
            ? <div className="brief-local-context-list">
                <h3 className="brief-context-appendix-heading">Detailed included context records</h3>
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
                    ? "Review the available state evidence on the Local Context page. Eligible reviewed records are selected for this Brief by default, and an explicit Use-in-Pilot selection remains separate."
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
                <p className="subtle">New analyst requests start included; only requests current for the applied scenario export. Deselect any request before export.</p>
                <ul>{brief.data_requests.map(request => <li key={request.request_id}>
                  <strong>{request.target_question}</strong> — {request.fields_needed.join(", ")}
                  <small className="brief-request-trace">
                    Pathway: {formatPathwayStepLabel(request.pathway_step)}
                    {request.target_mechanism && <> · Mechanism: {formatMechanismLabel(request.target_mechanism)}</>}
                  </small>
                  {brief.acquisition_guidance?.filter(guidance => guidance.request_id === request.request_id).map(guidance => <AcquisitionGuidanceCard key={guidance.reference.hint_id} guidance={guidance} />)}
                </li>)}</ul>
              </>
            : <div className="empty-state">
                <strong>
                  {availableDataRequests.length > 0
                    ? "Data requests are available, but none has been selected for this brief."
                    : "No data request has been created or loaded."}
                </strong>
                <p>Data requests are planning artifacts, not observed evidence. New requests start selected; review or deselect them before export.</p>
                <Link className="button secondary" to="/data-requests">Review data requests</Link>
              </div>}
        </section>
      </article>


    </div>
    </WorkspaceDisclosure>
    <div className="brief-print-footer" aria-hidden="true">
      <span>Diagnostic Odyssey</span>
      <span>{brief.artifact_version}</span>
      <span>{brief.generated_at}</span>
    </div>
  </section>;
}
