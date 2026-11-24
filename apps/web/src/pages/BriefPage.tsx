import { formatPlanningCurrency, formatPlanningNumber } from "../data/planningNumberFormatting.ts";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { buildPlanningBrief, serializeBriefJson, type PlanningBrief } from "@diagnostic-odyssey/brief-core";
import { AcquisitionGuidanceCard } from "../components/AcquisitionGuidanceCard";
import { BriefExecutiveSummary } from "../components/BriefExecutiveSummary";
import { buildVerifiedNationalBriefSection } from "../data/planningInsights";
import { AiHandoff } from "../components/AiHandoff";
import {
  canDisplayDistributionSummary,
  type Estimate
} from "@diagnostic-odyssey/contracts";
import { getEvidenceParameterReadiness, getNationalBurdenReadiness } from "../data/workspaceReadiness";
import { DistributionSummaryText } from "../components/DistributionSummaryText";
import { useArtifact } from "../data/ArtifactContext";
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
import { formatAppliedAssumption } from "./briefAssumptions";
import { createBriefPrintDisclosureState, executeBriefPrint, watchBriefPrintMedia } from "./briefPrint";
import "./BriefPage.css";

declare const __DO_GEMINI_STAGE2_PREVIEW__: boolean;
const previewGeminiEnabled = typeof __DO_GEMINI_STAGE2_PREVIEW__ === "boolean" && __DO_GEMINI_STAGE2_PREVIEW__;

const resultNumber = new Intl.NumberFormat("en-US");

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
      setExportStatus("JSON downloaded.");
    } catch {
      setExportStatus("JSON download could not start.");
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
        JSON
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
    const baseBrief = buildPlanningBrief({
      context: briefContext,
      estimates,
      localContext: briefLocalContext,
      scenario: scenario && scenarioResult ? { input: scenario, result: scenarioResult } : null,
      evidence: bundle.evidence,
      dataRequests: selectedDataRequests
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
          <p className="eyebrow">04 · EXECUTIVE BRIEF · {COVERAGE_EDITION_BADGE}</p>
          <h1>Care-strategy &amp; pilot planning brief</h1>
          <p>Reviewed evidence, selected terrain, and explicit assumptions.</p>
        </header>

        {/* Minimal Floating / Sticky Command Dock */}
        <div className="brief-dock brief-export-actions" role="toolbar" aria-label="Brief export and AI actions">
          <button type="button" className="button" onClick={printBrief}>PDF</button>
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
              Ask Strategy AI →
            </Link>
          )}
        </div>

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
            <small className="subtle">
              {previewGeminiEnabled
                ? "Live Gemini Advisor (authenticated Preview) active."
                : "No on-site Gemini model calls run in public builds."}
            </small>
          </div>
        )}

        <div className="print-provenance" role="group" aria-label="Planning Brief provenance">
          <strong>Brief provenance</strong>
          <span><b>National reviewed artifact:</b> {brief.artifact_version}</span>
          {brief.context.local_context_id && (
            <span><b>Reviewed local-context artifact:</b> {brief.context.local_context_id}</span>
          )}
          <span><b>Generated:</b> {brief.generated_at}</span>
        </div>

        <BriefExecutiveSummary brief={brief} national={nationalExecutive} checkboxSelectedIds={selectedLocalContextIds} pilotLocalContextId={pilotLocalContextId} staleRequestCount={staleSelectedDataRequestCount} />

        <section className="brief-print-decision-state" aria-label="Decision state summary">
          <h2>Decision state</h2>
          <div><strong>Burden estimates</strong><span>{burdenReadiness.briefStatus}</span></div>
          <div><strong>Scenario arithmetic</strong><span>{brief.scenario ? "Planning assumptions" : "No applied scenario"}</span></div>
          <div><strong>Evidence parameter</strong><span>{evidenceReadiness.status}</span></div>
          <div><strong>Local context</strong><span>{brief.local_context.length > 0 ? `${brief.local_context.length} included` : localContextAvailable ? "Available, not selected" : "Not selected"}</span></div>
          <div><strong>Data requests</strong><span>{selectedDataRequests.length > 0 ? `${selectedDataRequests.length} selected` : "None selected"}</span></div>
        </section>

        <article className="card brief-content atlas-memo-body" aria-label="Planning Brief document">
          <details className="technical-disclosure brief-guardrails-sheet">
            <summary>Sources &amp; Guardrails ({brief.warnings.length} boundaries)</summary>
            <section id="brief-interpretation-boundaries" className="interpretation-boundaries">
              <h2>Interpretation boundaries</h2>
              <ul>{brief.warnings.map(warning => <li key={warning}>{warning}</li>)}</ul>
            </section>
            <label className="brief-appendix-control">
              <input
                type="checkbox"
                checked={includeContextAppendixInPrint}
                onChange={event => setIncludeContextAppendixInPrint(event.target.checked)}
              />
              <span>Include full local-context appendix in PDF print</span>
            </label>
          </details>

          <section id="brief-national-burden">
            <h2>Reviewed national burden findings</h2>
            {brief.burden_findings.length === 0 ? (
              <div className="empty-state">
                <strong>No reviewed analytical estimate is currently export-eligible.</strong>
              </div>
            ) : (
              <div className="brief-burden-groups">
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
            )}
          </section>

          <section id="brief-pilot-assumptions">
            <h2>Pilot planning assumptions</h2>
            <p className="subtle"><strong>{PLANNING_DEFAULTS_LABEL}</strong></p>
            {brief.scenario && scenarioBoundary ? (
              <>
                <dl className="brief-applied-assumptions" aria-label={`${pilotInputFields.length} applied planning assumptions`}>
                  {pilotInputFields.map(field => (
                    <div key={field.key}>
                      <dt>{field.label}</dt>
                      <dd>{formatAppliedAssumption(brief.scenario!.input, field)}</dd>
                    </div>
                  ))}
                </dl>
                <dl className="brief-scenario-trace">
                  <div><dt>Target step</dt><dd>{scenarioBoundary.pathwayStepLabel}</dd></div>
                  <div><dt>Mechanism</dt><dd>{scenarioBoundary.mechanismLabel}</dd></div>
                </dl>
              </>
            ) : (
              <div className="empty-state"><strong>No valid planning scenario available.</strong></div>
            )}
          </section>

          {brief.scenario && (
            <section id="brief-scenario-outputs" className="brief-output-section">
              <h2>Scenario outputs</h2>
              <p className="micro-caption">Deterministic planning math · Not a forecast or savings.</p>
              <dl className="brief-output-list">
                <div><dt>Participants within capacity</dt><dd>{formatPlanningNumber(brief.scenario.result.reached_participants, resultNumber)}</dd></div>
                <div><dt>Exposure difference</dt><dd>{formatPlanningNumber(brief.scenario.result.difference_person_months, resultNumber)} pm</dd></div>
                <div><dt>Resource requirement</dt><dd>{formatPlanningCurrency(brief.scenario.result.program_resource_requirement)}</dd></div>
              </dl>
            </section>
          )}

          <section id="brief-local-context">
            <h2>Local implementation context</h2>
            {brief.local_context.length > 0 && (
              <div className="brief-local-context-executive" aria-label="Local context print synopsis">
                <p><strong>{brief.local_context.length} reviewed West Virginia indicators included.</strong></p>
                <ul>
                  {localContextPreview.map(record => (
                    <li key={record.indicator_id}>
                      <strong>{record.label}:</strong> {formatLocalContextValue(record)} <span>({record.indicator_id})</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {brief.local_context.length > 0 ? (
              <div className="brief-local-context-list">
                <h3 className="brief-context-appendix-heading">Included context records ({brief.local_context.length})</h3>
                {brief.local_context.map(record => (
                  <article className="brief-local-context" key={record.indicator_id}>
                    <div className="brief-local-context-opening">
                      <div className="card-title-row">
                        <div>
                          <strong>{record.label}</strong>
                          <span>{record.geography_name} ({record.geography_type})</span>
                          {pilotLocalContext?.indicator_id === record.indicator_id && (
                            <span className="status status-selection pilot-used-badge">Active in Simulate</span>
                          )}
                        </div>
                        <span className={record.state === "partial" ? "status status-warning" : "status status-reviewed"}>
                          {formatDataStateLabel(record.state)}
                        </span>
                      </div>
                      <p className="brief-local-context-value">{formatLocalContextValue(record)}</p>
                    </div>
                    <p className="subtle">
                      <strong>Source:</strong> {record.source_agency} · {record.source_release_vintage} · {formatPublishedLocalContextUncertainty(record)}
                    </p>
                    <p className="limitations">{record.allowed_interpretation}</p>
                  </article>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <strong>No local context selected for this brief.</strong>
                <Link className="text-button" to="/local-context">Select in Terrain →</Link>
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
                <p>Causal benefit, savings, and ROI remain unavailable.</p>
              </div>
            )}
          </section>

          <section id="brief-data-requests">
            <h2>What to collect next</h2>
            {brief.data_requests.length > 0 ? (
              <ul>
                {brief.data_requests.map(request => (
                  <li key={request.request_id}>
                    <strong>{request.target_question}</strong> — {request.fields_needed.join(", ")}
                    <small className="brief-request-trace">
                      {formatPathwayStepLabel(request.pathway_step)}
                      {request.target_mechanism && <> · {formatMechanismLabel(request.target_mechanism)}</>}
                    </small>
                    {brief.acquisition_guidance?.filter(guidance => guidance.request_id === request.request_id).map(guidance => (
                      <AcquisitionGuidanceCard key={guidance.reference.hint_id} guidance={guidance} />
                    ))}
                  </li>
                ))}
              </ul>
            ) : (
              <div className="empty-state">
                <strong>No data request selected.</strong>
                <Link className="text-button" to="/data-requests">Open Data Requests →</Link>
              </div>
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
