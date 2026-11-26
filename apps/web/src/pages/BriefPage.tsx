import { formatPlanningCurrency, formatPlanningNumber, isScientificNotationText } from "../data/planningNumberFormatting.ts";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { buildPlanningBrief, serializeBriefJson, type PlanningBrief } from "@diagnostic-odyssey/brief-core";
import { AcquisitionGuidanceCard } from "../components/AcquisitionGuidanceCard";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { PlanningInsights } from "../components/PlanningInsights";
import { BriefExecutiveSummary } from "../components/BriefExecutiveSummary";
import { EvidenceTiming } from "../components/EvidenceTiming";
import { WorkspaceSessionNote } from "../components/WorkspaceSessionNote";
import {
  buildPlanningInsights,
  buildVerifiedNationalBriefSection,
  type PlanningInsightsSources
} from "../data/planningInsights";
import { planningInsightsEnabled } from "../data/planningInsightsEnabled";
import { AiHandoff } from "../components/AiHandoff";
import {
  canDisplayDistributionSummary,
  type Estimate
} from "@diagnostic-odyssey/contracts";
import { getEvidenceParameterReadiness, getNationalBurdenReadiness } from "../data/workspaceReadiness";
import { DecisionTrace } from "../components/DecisionTrace";
import { DistributionSummaryText } from "../components/DistributionSummaryText";
import { useArtifact } from "../data/ArtifactContext";
import { getEvidenceFreshness } from "../data/evidenceFreshness";
import {
  formatEstimateInterval,
  formatEstimateValue
} from "../data/formatEstimateValue";
import { mergeBriefLocalContext } from "../data/briefLocalContext";
import { selectBriefLocalContextPreview } from "../data/briefLocalContextPreview";
import { formatLocalContextValue } from "../data/formatLocalContextValue";
import { deriveBriefContextWithSelectedLocalContext } from "../data/localContextSelection";
import { formatPublishedLocalContextUncertainty } from "../data/localContextPresentation";
import { COVERAGE_EDITION_BADGE } from "../data/coverageCatalog";
import { PLANNING_DEFAULTS_LABEL } from "../data/planningScenarioDefaults";
import {
  formatMechanismLabel,
  formatPathwayStepLabel,
  getPathwayBoundaryPresentation
} from "../data/pathwayBoundary";
import { formatDataStateLabel } from "../data/presentationLabels";
import { withStaleSelectedDataRequestWarning } from "../data/briefDataRequestWarnings";
import { groupBriefBurdenFindings } from "../data/briefBurdenPresentation";
import { pilotInputFields } from "../data/pilotInputDraft";
import { describeProgramResourceRequirement } from "../data/pilotDecisionPresentation";
import { formatAppliedAssumption } from "./briefAssumptions";
import { createBriefPrintDisclosureState, executeBriefPrint, watchBriefPrintMedia } from "./briefPrint";
import "./BriefPage.css";

declare const __DO_GEMINI_STAGE2_PREVIEW__: boolean;
const previewGeminiEnabled = typeof __DO_GEMINI_STAGE2_PREVIEW__ === "boolean" && __DO_GEMINI_STAGE2_PREVIEW__;

const resultNumber = new Intl.NumberFormat("en-US");

function BriefInsights({ brief, sources }: { brief: PlanningBrief; sources: PlanningInsightsSources }) {
  return <PlanningInsights model={buildPlanningInsights(brief, sources)} />;
}

function AccessibleEstimateInterval({ estimate }: { estimate: Estimate }) {
  const interval = formatEstimateInterval(estimate);
  const accessibleInterval = interval
    .replace(/^(\d+(?:\.\d+)?)% CI\s*/, "$1% confidence interval: ")
    .replace(/^CI\s*/, "Confidence interval: ");

  return (
    <>
      <span aria-hidden="true">{interval}</span>
      <span className="sr-only">{accessibleInterval}</span>
    </>
  );
}

function BriefJsonExport({ brief }: { brief: PlanningBrief }) {
  const [exportStatus, setExportStatus] = useState("");
  const exportJson = () => {
    let url: string | undefined;
    const anchor = document.createElement("a");
    try {
      url = URL.createObjectURL(new Blob([serializeBriefJson(brief)], { type: "application/json" }));
      anchor.href = url;
      anchor.download = brief.artifact_version + "-planning-brief.json";
      document.body.append(anchor);
      anchor.click();
      setExportStatus("JSON download requested with the current Planning Brief.");
    } catch {
      setExportStatus("JSON download could not start. Your Brief is unchanged; try again or use Print / save PDF.");
    } finally {
      anchor.remove();
      if (url) {
        const downloadUrl = url;
        setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
      }
    }
  };

  return (
    <>
      <button type="button" className="button secondary" onClick={exportJson}>
        Export JSON companion
      </button>
      <span className="brief-export-status subtle" role="status">{exportStatus}</span>
    </>
  );
}

interface FutureConceptControlProps {
  conceptAvailable?: boolean;
  showFutureConcept?: boolean;
  onFutureConceptChange?: (enabled: boolean) => void;
}

export function BriefPage({
  conceptAvailable = false,
  showFutureConcept = false,
  onFutureConceptChange
}: FutureConceptControlProps = {}) {
  const pageRef = useRef<HTMLElement>(null);
  const [includeContextAppendixInPrint, setIncludeContextAppendixInPrint] = useState(false);
  const [contextDetailsOpen, setContextDetailsOpen] = useState(false);
  const [nationalDetailsOpen, setNationalDetailsOpen] = useState(false);
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
      () => Array.from(page.querySelectorAll<HTMLDetailsElement>("details")),
      window
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

  const brief = useMemo(() => {
    if (!bundle) return null;
    const estimates = bundle.burden_domains.flatMap(domain => domain.measures);
    const briefLocalContext = mergeBriefLocalContext(selectedLocalContext, pilotLocalContext);
    const briefContext = deriveBriefContextWithSelectedLocalContext(
      bundle.context, localContextStatus, localContext, briefLocalContext
    );
    const staleSelectedDataRequestCount =
      Math.max(0, briefDataRequestIds.length - selectedDataRequests.length);
    const generatedAt = new Date();
    const baseBrief = buildPlanningBrief({
      context: briefContext,
      estimates,
      localContext: briefLocalContext,
      scenario: scenario && scenarioResult ? { input: scenario, result: scenarioResult } : null,
      evidence: bundle.evidence,
      dataRequests: selectedDataRequests,
      generatedAt: generatedAt.toISOString(),
      evidenceFreshness: getEvidenceFreshness(bundle, localContext, generatedAt)
    });
    return withStaleSelectedDataRequestWarning(baseBrief, staleSelectedDataRequestCount);
  }, [
    bundle, selectedLocalContext, pilotLocalContext, localContextStatus, localContext,
    briefDataRequestIds, selectedDataRequests, scenario, scenarioResult
  ]);

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
  const localContextAvailable = localContextStatus === "loaded" && localContext !== null;

  const printBrief = () => {
    executeBriefPrint(printDisclosureState.current);
  };

  return (
    <section
      className={`page page-stack planning-brief-page${includeContextAppendixInPrint ? " brief-include-context-appendix" : ""}`}
      ref={pageRef}
    >
      <div className="atlas-memo-shell">
        <header className="page-heading atlas-memo-head">
          <p className="eyebrow">05 · PLANNING BRIEF · {COVERAGE_EDITION_BADGE}</p>
          <h1>Long COVID burden and pilot planning brief</h1>
          <p>Reviewed national evidence, selected local context, and explicit pilot assumptions, with interpretation boundaries and data needs intact.</p>
          <WorkspaceSessionNote />
        </header>

        {/* Sticky Export & AI Command Dock */}
        <div id="brief-export-actions" className="brief-dock brief-export-actions" role="toolbar" aria-label="Brief export and AI actions">
          <button type="button" className="button" onClick={printBrief}>Print / save PDF</button>
          <BriefJsonExport brief={brief} />
          <AiHandoff
            brief={brief}
            sourceState={{
              status,
              localContextStatus,
              localArtifactVersion: localContext?.manifest.artifact_version ?? null,
              scenario,
              scenarioValid: !scenario || !!scenarioResult,
              selectedLocalContextIds,
              pilotLocalContextId,
              briefDataRequestIds
            }}
          />
          {conceptAvailable && showFutureConcept && (
            <Link className="button secondary" to="/advisor">
              Open Strategy AI Studio →
            </Link>
          )}
        </div>

        <div className="brief-print-controls">
          <label className="brief-appendix-control">
            <input
              type="checkbox"
              checked={includeContextAppendixInPrint}
              onChange={event => setIncludeContextAppendixInPrint(event.target.checked)}
            />
            <span>
              Include detailed local-context records in print{" "}
              <small>Off by default for a concise Brief. All included records remain in the JSON companion and readable on screen.</small>
            </span>
          </label>

          {conceptAvailable && (
            <div className="brief-concept-strip" role="group" aria-label="Strategy AI Studio status">
              <label className="brief-concept-toggle">
                <input
                  type="checkbox"
                  checked={showFutureConcept}
                  onChange={event => onFutureConceptChange?.(event.target.checked)}
                />
                <span>Show Strategy AI Studio</span>
              </label>
              {showFutureConcept && (
                <Link className="text-button" to="/advisor">Open Strategy AI Studio →</Link>
              )}
              <small className="subtle brief-concept-note">
                {previewGeminiEnabled
                  ? "Authenticated preview guidance (Live Gemini Advisor (authenticated Preview)) active alongside Prompt Studio and Illustrative exploration."
                  : "No on-site Gemini model calls run in public builds; Prompt Studio and Illustrative exploration work locally."}
              </small>
            </div>
          )}
        </div>

        <div className="print-provenance" role="group" aria-label="Planning Brief provenance">
          <strong>Brief provenance</strong>
          <span><b>National reviewed artifact:</b> {brief.artifact_version}</span>
          {brief.context.local_context_id && (
            <span><b>Reviewed local-context artifact:</b> {brief.context.local_context_id}</span>
          )}
          <span><b>Generated:</b> {brief.generated_at}</span>
        </div>

        <BriefExecutiveSummary brief={brief} national={nationalExecutive} checkboxSelectedIds={selectedLocalContextIds} pilotLocalContextId={pilotLocalContextId} staleRequestCount={staleSelectedDataRequestCount} />

        {planningInsightsEnabled && (
          <ErrorBoundary
            fallback={
              <p className="insight-unavailable">
                Planning insights are unavailable. The reviewed Brief and exports remain available below.
              </p>
            }
          >
            <BriefInsights
              brief={brief}
              sources={{
                national: bundle,
                local: localContext,
                localStatus: localContextStatus,
                availableDataRequests
              }}
            />
          </ErrorBoundary>
        )}

        <section className="brief-print-decision-state" aria-label="Decision state summary">
          <h2>Decision state</h2>
          <div><strong>Burden estimates</strong><span>{burdenReadiness.briefStatus}</span></div>
          <div><strong>Scenario arithmetic</strong><span>{brief.scenario ? "Planning assumptions" : "No applied scenario"}</span></div>
          <div><strong>Evidence parameter</strong><span>{evidenceReadiness.status}</span></div>
          <div><strong>Local context</strong><span>{brief.local_context.length > 0 ? `${brief.local_context.length} included` : localContextAvailable ? "Available, not selected" : "Not selected"}</span></div>
          <div><strong>Data requests</strong><span>{selectedDataRequests.length > 0 ? `${selectedDataRequests.length} selected` : "None selected"}</span></div>
        </section>

        <article className="card brief-content atlas-memo-body" aria-label="Planning Brief document">
          <EvidenceTiming entries={brief.evidence_freshness ?? []} />

          <section id="brief-pilot-assumptions">
            <h2>Strategy Lab planning assumptions</h2>
            <p className="subtle"><strong>{PLANNING_DEFAULTS_LABEL}.</strong> These inputs are planning assumptions, not observed evidence.</p>
            {brief.scenario && scenarioBoundary ? (
              <>
                <dl className="brief-applied-assumptions" aria-label={`${pilotInputFields.length} applied planning assumptions`}>
                  {pilotInputFields.map(field => {
                    const formatted = formatAppliedAssumption(brief.scenario!.input, field);
                    return (
                      <div key={field.key}>
                        <dt>{field.label}</dt>
                        <dd>{isScientificNotationText(formatted) ? <span className="brief-scientific-value">{formatted}</span> : formatted}</dd>
                      </div>
                    );
                  })}
                </dl>
                <dl className="brief-scenario-trace">
                  <div><dt>Target step</dt><dd>{scenarioBoundary.pathwayStepLabel}</dd></div>
                  <div><dt>Mechanism</dt><dd>{scenarioBoundary.mechanismLabel}</dd></div>
                  <div><dt>Assumption boundary</dt><dd>{scenarioBoundary.assumptionBoundaryStatement}</dd></div>
                  <div><dt>Outside this model</dt><dd>{scenarioBoundary.outsideModelItems.join("; ")}.</dd></div>
                </dl>
              </>
            ) : (
              <div className="empty-state"><strong>No valid planning scenario available.</strong></div>
            )}
          </section>

          {brief.scenario && (
            <section id="brief-scenario-outputs" className="brief-output-section">
              <h2>Scenario outputs</h2>
              <p className="micro-caption">Deterministic planning quantities from the applied assumptions above; not a forecast or savings, and not observed evidence.</p>
              <dl className="brief-output-list">
                {(() => {
                  const reached = formatPlanningNumber(brief.scenario.result.reached_participants, resultNumber);
                  const diff = formatPlanningNumber(brief.scenario.result.difference_person_months, resultNumber);
                  const res = formatPlanningCurrency(brief.scenario.result.program_resource_requirement);
                  return (
                    <>
                      <div><dt>Participants within capacity</dt><dd>{isScientificNotationText(reached) ? <span className="brief-scientific-value">{reached}</span> : reached}</dd></div>
                      <div><dt>Person-month planning exposure difference</dt><dd>{isScientificNotationText(diff) ? <span className="brief-scientific-value">{diff}</span> : diff} pm</dd></div>
                      <div><dt>Program-resource requirement</dt><dd aria-describedby="brief-resource-scope">{isScientificNotationText(res) ? <span className="brief-scientific-value">{res}</span> : res}</dd></div>
                    </>
                  );
                })()}
              </dl>
              <p id="brief-resource-scope" className="micro-caption">
                {describeProgramResourceRequirement(brief.scenario.result)}
              </p>
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
            </section>
          )}

          <section id="brief-local-context">
            <h2>Local implementation context</h2>
            {brief.local_context.length > 0 && (
              <div className="brief-local-context-executive" aria-label="Local context print synopsis">
                <p>
                  <strong>{brief.local_context.length} reviewed context {brief.local_context.length === 1 ? "record" : "records"} included in this Brief.</strong>{" "}
                  These statewide West Virginia indicators inform implementation planning; they do not estimate state Long COVID prevalence, modify national burden, or prove savings.
                </p>
                <p>
                  HPSA figures describe shortage-area designations, not people; ACS figures describe statewide Census survey measures. A separately attached Strategy Lab record remains distinct from checkbox choices. An active Pilot-used record may be included separately from checkbox choices.
                </p>
                <ul>
                  {localContextPreview.map(record => (
                    <li key={record.indicator_id}>
                      <strong>{record.label}:</strong> {formatLocalContextValue(record)} <span>({record.indicator_id}; {record.source_ref})</span>
                    </li>
                  ))}
                </ul>
                {brief.local_context.length > localContextPreview.length && (
                  <p>
                    Showing {localContextPreview.length} source-traceable examples from the actual included selection, not a ranking, aggregate, or statewide severity score. The canonical JSON companion contains all {brief.local_context.length} complete records, source locators, released interpretations and limitations. Enable the detailed print option to include their full text in the PDF.
                  </p>
                )}
                {brief.context.local_context_id && (
                  <p><strong>Reviewed local artifact:</strong> {brief.context.local_context_id}</p>
                )}
              </div>
            )}
            {brief.local_context.length > 0 ? (
              <>
                <div className="brief-screen-disclosure">
                  <p>{brief.local_context.length} reviewed West Virginia records included. See the summary above for any Strategy Lab attachment.</p>
                  <button type="button" className="text-button" aria-controls="brief-local-records" aria-expanded={contextDetailsOpen} onClick={() => setContextDetailsOpen(open => !open)}>
                    {contextDetailsOpen ? "Hide local records" : "Show local records"}
                  </button>
                </div>
                <div id="brief-local-records" className="brief-local-context-list" data-screen-collapsed={!contextDetailsOpen}>
                  <h3 className="brief-context-appendix-heading">Detailed included context records ({brief.local_context.length})</h3>
                  {brief.context.local_context_id && (
                    <p className="subtle">
                      <strong>Reviewed local-context artifact:</strong> {brief.context.local_context_id}
                    </p>
                  )}
                  {brief.local_context.map(record => (
                    <article className="brief-local-context" key={record.indicator_id}>
                      <div className="brief-local-context-opening">
                        <div className="card-title-row">
                          <div>
                            <strong>{record.label}</strong>
                            <span>{record.geography_name} ({record.geography_type})</span>
                            {pilotLocalContext?.indicator_id === record.indicator_id && (
                              <span className="status status-selection pilot-used-badge">Active in Strategy Lab</span>
                            )}
                          </div>
                          <span className={record.state === "partial" ? "status status-partial" : "status status-reviewed"}>
                            {formatDataStateLabel(record.state)}
                          </span>
                        </div>
                        <p className="brief-local-context-value">{formatLocalContextValue(record)}</p>
                      </div>
                      <p className="subtle">
                        <strong>Source:</strong> {record.source_agency} · {record.source_release_vintage}
                      </p>
                      <p className="subtle">
                        <strong>Published uncertainty:</strong> {formatPublishedLocalContextUncertainty(record)}
                      </p>
                      <p className="subtle">
                        <strong>Availability:</strong> {formatDataStateLabel(record.state)}
                      </p>
                      <p className="limitations"><strong>Allowed interpretation:</strong> {record.allowed_interpretation}</p>
                      {record.prohibited_interpretation.length > 0 && (
                        <p className="limitations"><strong>Not supported:</strong> {record.prohibited_interpretation.join("; ")}</p>
                      )}
                      {record.limitations.length > 0 && (
                        <p className="limitations"><strong>Limitations:</strong> {record.limitations.join(" ")}</p>
                      )}
                    </article>
                  ))}
                </div>
              </>
            ) : (
              <div className="empty-state">
                <strong>
                  {localContextAvailable
                    ? "No local context has been selected for this brief or used in Strategy Lab; reviewed West Virginia state context is available."
                    : "No local context has been selected for this brief."}
                </strong>
                <p>
                  {localContextAvailable
                    ? "Review the available state evidence on the Local context page. Eligible reviewed records are selected for this Brief by default, and an explicit Use-in-Strategy Lab selection remains separate."
                    : "National MEPS burden remains unchanged; no local prevalence or state-specific Long COVID burden is inferred."}
                </p>
                {localContextAvailable && (
                  <Link className="text-button" to="/local-context">Select in Local context →</Link>
                )}
              </div>
            )}
          </section>

          <section id="brief-intervention-evidence">
            <h2>Intervention-effect evidence</h2>
            {brief.evidence.length > 0 ? (
              brief.evidence.map(x => <p key={x.evidence_id}><strong>{x.allowed_use}</strong> — {x.source}</p>)
            ) : (
              <div className="empty-state">
                <strong>No reviewed intervention-effect parameter is loaded.</strong>
                <p>Causal benefit, savings, ROI, and preventable-cost claims remain unavailable.</p>
              </div>
            )}
          </section>

          <section id="brief-data-requests">
            <h2>What to collect next</h2>
            {brief.data_requests.length > 0 ? (
              <>
                <p className="subtle">
                  New analyst requests start included; only requests current for the applied scenario export. Deselect any request before export.
                </p>
                <ul>
                  {brief.data_requests.map(request => (
                    <li key={request.request_id}>
                      <strong>{request.target_question}</strong> — {request.fields_needed.join(", ")}
                      <small className="brief-request-trace">
                        Pathway: {formatPathwayStepLabel(request.pathway_step)}
                        {request.target_mechanism && <> · Mechanism: {formatMechanismLabel(request.target_mechanism)}</>}
                      </small>
                      {brief.acquisition_guidance?.filter(guidance => guidance.request_id === request.request_id).map(guidance => (
                        <AcquisitionGuidanceCard key={guidance.reference.hint_id} guidance={guidance} />
                      ))}
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <div className="empty-state">
                <strong>
                  {availableDataRequests.length > 0
                    ? "Data requests are available, but none has been selected for this brief."
                    : "No data request has been created or loaded."}
                </strong>
                <p>Data requests are planning artifacts, not observed evidence. New requests start selected and only requests current for the applied scenario export; review or deselect them before export.</p>
                <Link className="button secondary" to="/data-requests">Review data requests →</Link>
              </div>
            )}
          </section>

          <section id="brief-interpretation-boundaries" className="interpretation-boundaries">
            <h2>Interpretation boundaries</h2>
            <ul>{brief.warnings.map(warning => <li key={warning}>{warning}</li>)}</ul>
          </section>

          <section id="brief-national-burden">
            <h2>Reviewed national burden findings</h2>
            {brief.burden_findings.length === 0 ? (
              <div className="empty-state">
                <strong>No reviewed analytical estimate is currently export-eligible.</strong>
              </div>
            ) : (
              <>
                <div className="brief-screen-disclosure">
                  <p>{brief.burden_findings.length} released national measures with their reported uncertainty and interpretation.</p>
                  <button type="button" className="text-button" aria-controls="brief-national-records" aria-expanded={nationalDetailsOpen} onClick={() => setNationalDetailsOpen(open => !open)}>
                    {nationalDetailsOpen ? "Hide national findings" : "Show national findings"}
                  </button>
                </div>
                <div id="brief-national-records" className="brief-burden-groups" data-screen-collapsed={!nationalDetailsOpen}>
                  {burdenGroups.map(group => (
                    <section
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
                            {group.findings.map(finding => (
                              <tr key={finding.estimate_id}>
                                <th scope="row">{finding.label}</th>
                                <td>
                                  {canDisplayDistributionSummary(finding)
                                    ? <DistributionSummaryText estimate={finding} />
                                    : formatEstimateValue(finding)}
                                </td>
                                <td><AccessibleEstimateInterval estimate={finding} /></td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <details className="brief-burden-details technical-disclosure">
                        <summary>Interpretation &amp; provenance</summary>
                        {group.limitations.length > 0 && (
                          <p><strong>Domain limitations:</strong> {group.limitations.join(" ")}</p>
                        )}
                        <ul>
                          {group.findings.map(finding => (
                            <li key={finding.estimate_id}>
                              <strong>{finding.label}:</strong> {finding.allowed_interpretation}
                              {finding.system_boundary && <> <span className="subtle">Boundary: {finding.system_boundary}</span></>}
                            </li>
                          ))}
                        </ul>
                      </details>
                    </section>
                  ))}
                </div>
              </>
            )}
          </section>
        </article>

        <div className="brief-print-footer" aria-hidden="true">
          <span>Diagnostic Odyssey</span>
          <span>{brief.artifact_version}</span>
          <span>{brief.generated_at}</span>
        </div>
      </div>
    </section>
  );
}
