import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import type { Scenario, ScenarioResult } from "@diagnostic-odyssey/contracts";
import { ContextBar } from "../components/ContextBar";
import { DecisionTrace } from "../components/DecisionTrace";
import { InterpretationGuide } from "../components/InterpretationGuide";
import { PilotDecisionVisuals } from "../components/PilotDecisionVisuals";
import { SensitivityExplorer } from "../components/SensitivityExplorer";
import { useArtifact } from "../data/ArtifactContext";
import {
  createSensitivityDataRequest,
  getSensitivityDataRequestStatus,
  isDataRequestCurrentForScenario
} from "../data/dataRequestTemplates";
import type { SensitivityField } from "../data/decisionVisuals";
import {
  createPilotInputDraft,
  evaluatePilotInputDraft,
  formatPilotInputHelper,
  formatPilotResultAnnouncement,
  getPilotResultSignature,
  pilotInputFields,
  type PilotInputDraft,
  type PilotNumericField
} from "../data/pilotInputDraft";
import { getPilotFragmentTargetId } from "../data/pilotFragmentScroll";
import { formatLocalContextValue } from "../data/formatLocalContextValue";
import { formatPublishedLocalContextUncertainty } from "../data/localContextPresentation";
import {
  PLANNING_DEFAULTS_DESCRIPTION,
  PLANNING_DEFAULTS_LABEL
} from "../data/planningScenarioDefaults";
import { getPathwayBoundaryPresentation } from "../data/pathwayBoundary";

export function PilotPage() {
  const {scenario, scenarioResult} = useArtifact();
  const location = useLocation();
  const sensitivityReady = scenario !== null && scenarioResult !== null;

  useEffect(() => {
    const targetId = getPilotFragmentTargetId(location.hash);
    if (!targetId || !sensitivityReady) return;
    document.getElementById(targetId)?.scrollIntoView({block: "start"});
  }, [location.hash, sensitivityReady]);

  if (!scenario || !scenarioResult) {
    return <section className="page page-stack">
      <ContextBar />
      <header className="page-heading">
        <p className="eyebrow">PILOT PLANNER</p>
        <h1>Scope a feasible pilot</h1>
        <p>Planning assumptions are currently unavailable or invalid. Reviewed national burden remains available; no causal effect or savings estimate is inferred.</p>
      </header>
      <div className="empty-state">
        <strong>No valid planning scenario result is available.</strong>
        <p>Planning inputs are separate from reviewed analytical evidence and can be restored without changing the MEPS burden artifact.</p>
      </div>
    </section>;
  }

  return <PilotPlannerWorkspace scenario={scenario} scenarioResult={scenarioResult} />;
}

function PilotPlannerWorkspace({
  scenario,
  scenarioResult
}: {
  scenario: Scenario;
  scenarioResult: ScenarioResult;
}) {
  const {
    bundle,
    setScenario,
    analystDataRequests,
    upsertAnalystDataRequest,
    pilotLocalContext,
    localContextStatus,
    clearPilotLocalContext
  } = useArtifact();
  const [draft, setDraft] = useState<PilotInputDraft>(
    () => createPilotInputDraft(scenario)
  );
  const evaluation = useMemo(
    () => evaluatePilotInputDraft(draft, scenario),
    [draft, scenario]
  );
  const invalidDraft = evaluation.candidate === null;
  const pathwayBoundary = getPathwayBoundaryPresentation(scenario);
  const currentOperationalDataRequests = analystDataRequests.filter(request =>
    isDataRequestCurrentForScenario(request, scenario)
  );
  const burdenEstimateCount =
    bundle?.burden_domains.reduce((count, domain) => count + domain.measures.length, 0) ?? 0;

  const initialResultSignature = useRef(getPilotResultSignature(scenarioResult));
  const [resultAnnouncement, setResultAnnouncement] = useState("");

  useEffect(() => {
    const nextSignature = getPilotResultSignature(scenarioResult);
    if (initialResultSignature.current === nextSignature) return;
    initialResultSignature.current = nextSignature;
    setResultAnnouncement(formatPilotResultAnnouncement(scenarioResult));
  }, [scenarioResult]);

  const updateDraft = (key: PilotNumericField, raw: string) => {
    const nextDraft = {...draft, [key]: raw};
    setDraft(nextDraft);
    const nextEvaluation = evaluatePilotInputDraft(nextDraft, scenario);
    if (nextEvaluation.candidate) {
      setScenario(nextEvaluation.candidate);
    }
  };

  const addSensitivityDataRequest = (field: SensitivityField) => {
    upsertAnalystDataRequest(createSensitivityDataRequest(scenario, field));
  };

  const sensitivityDataRequestStatus = (field: SensitivityField) =>
    getSensitivityDataRequestStatus(scenario, field, analystDataRequests);

  return <section className="page page-stack">
    <ContextBar />
    <div className="heading-row">
      <header className="page-heading"><p className="eyebrow">PILOT PLANNER</p><h1>Scope a feasible pilot</h1><p>Transparent recognition/navigation arithmetic from analyst-supplied assumptions. This is not a prediction or causal ROI estimate.</p></header>
      <div className="caution cool"><strong>Plan · Test · Learn</strong><span>Every scenario names the pathway step and mechanism it is allowed to change.</span></div>
    </div>
    <div className="pilot-grid">
      <form className="card assumption-card" onSubmit={event => event.preventDefault()}>
        <h2>Planning assumptions</h2>
        <p className="subtle"><strong>{PLANNING_DEFAULTS_LABEL}</strong><br />{PLANNING_DEFAULTS_DESCRIPTION}</p>
        {pilotInputFields.map(field => {
          const inputId = "pilot-" + field.key;
          const helperId = inputId + "-helper";
          const errorId = inputId + "-error";
          const error = evaluation.errors[field.key];
          const helper = error ? null : formatPilotInputHelper(field.key, draft[field.key]);

          return <div className="pilot-field" key={field.key}>
            <label className="pilot-field-label" htmlFor={inputId}>{field.label}</label>
            <div className="pilot-field-control">
              <span className={"input-wrap" + (error ? " invalid" : "")}>
                <input
                  id={inputId}
                  type="text"
                  inputMode="decimal"
                  value={draft[field.key]}
                  onChange={event => updateDraft(field.key, event.target.value)}
                  aria-invalid={Boolean(error)}
                  aria-describedby={helperId + " " + errorId}
                />
                {field.suffix && <small aria-hidden="true">{field.suffix}</small>}
              </span>
              <span id={helperId} className="input-helper">{helper}</span>
              <span id={errorId} className="field-error" aria-live="polite">{error ?? ""}</span>
            </div>
          </div>;
        })}
        {evaluation.formError && <p className="field-error form-error" aria-live="polite">{evaluation.formError}</p>}
        <section className="pathway-boundary" aria-labelledby="pilot-pathway-boundary-title">
          <div>
            <p className="visual-kicker">SCIENTIFIC BOUNDARY</p>
            <h3 id="pilot-pathway-boundary-title">Modeled pathway boundary</h3>
          </div>
          <dl className="pathway-boundary-facts">
            <div><dt>Target step</dt><dd>{pathwayBoundary.pathwayStepLabel}</dd></div>
            <div><dt>Assumed mechanism</dt><dd>{pathwayBoundary.mechanismLabel}</dd></div>
          </dl>
          <p>{pathwayBoundary.modeledBoundaryStatement}</p>
          <p>{pathwayBoundary.assumptionBoundaryStatement}</p>
          <p><strong>Outside this model:</strong> {pathwayBoundary.outsideModelItems.join("; ")}.</p>
          <div className="pathway-boundary-actions" aria-label="Pathway boundary follow-up">
            <Link className="text-button" to="/pilot#sensitivity">Stress-test these assumptions</Link>
            <Link className="text-button" to="/evidence">Review evidence limits</Link>
          </div>
        </section>

        <section className="pilot-local-context" aria-labelledby="pilot-local-context-title">
          <div className="pilot-local-context-heading">
            <div>
              <p className="visual-kicker">ANALYST-SELECTED CONTEXT</p>
              <h3 id="pilot-local-context-title">Local planning context</h3>
            </div>
            <Link className="text-button" to="/local-context">
              {pilotLocalContext ? "Replace in Local Context" : "Review Local Context"}
            </Link>
          </div>
          {pilotLocalContext ? <>
            <div className="pilot-local-context-record">
              <strong>{pilotLocalContext.label}</strong>
              <span className="pilot-local-context-value">{formatLocalContextValue(pilotLocalContext)}</span>
              <span>{pilotLocalContext.geography_name} ({pilotLocalContext.geography_type})</span>
              <span><b>Source:</b> {pilotLocalContext.source_agency} · {pilotLocalContext.source_release_vintage}</span>
              <span><b>Published uncertainty:</b> {formatPublishedLocalContextUncertainty(pilotLocalContext)}</span>
              <span><b>Allowed interpretation:</b> {pilotLocalContext.allowed_interpretation}</span>
            </div>
            <div className="pilot-local-context-actions">
              <button className="text-button" type="button" onClick={clearPilotLocalContext}>Remove from Pilot</button>
            </div>
          </> : <div className="empty-state compact">
            <strong>No local implementation context is currently attached to this Pilot scenario.</strong>
            <p>Absence of a selected record does not mean there is no implementation constraint.</p>
          </div>}
          <p className="subtle">
            Reviewed local implementation context is for analyst judgment only. Attaching, replacing, or removing it does not alter reach, capacity, timing, cost, pathway, or mechanism parameters.
          </p>
        </section>

        <section className="pilot-decision-trace" aria-labelledby="pilot-decision-trace-title">
          <h3 id="pilot-decision-trace-title">Decision trace</h3>
          <DecisionTrace
            burdenEstimateCount={burdenEstimateCount}
            pilotLocalContext={pilotLocalContext}
            localContextStatus={localContextStatus}
            scenario={scenario}
            currentDataRequestCount={currentOperationalDataRequests.length}
            evidence={bundle?.evidence ?? []}
            dataRequestHref="/pilot#sensitivity"
          />
        </section>
      </form>
      <article className="card result-card">
        <h2>Baseline vs recognition/navigation scenario</h2>
        <p className="subtle">Deterministic planning arithmetic · not observed evidence or an evidence-derived effect</p>
        {invalidDraft && <div className="draft-not-applied" role="status">
          <strong>Draft not applied</strong>
          <span>These results still reflect the last valid planning assumptions. Fix the highlighted inputs to apply this draft.</span>
        </div>}
        <InterpretationGuide
          id="pilot-result-interpretation"
          title="How to read these results"
          whatThisShows="The mechanical planning consequences of the currently applied assumptions."
          whyItMatters="Whether intended reach, capacity, recognition-window assumptions, and program resources appear operationally feasible together."
          whatItDoesNotShow="A forecast, observed improvement, treatment effectiveness, causal effect, savings, or ROI."
          whatToDoNext={invalidDraft
            ? "Fix the draft inputs, then stress-test an assumption and create a structured data request where uncertainty matters."
            : "Stress-test an assumption and create a structured data request where uncertainty matters."}
        />
        <PilotDecisionVisuals scenario={scenario} result={scenarioResult} />
        <dl className="result-list">
          <div><dt>Intended reach</dt><dd>{scenarioResult.intended_reach.toLocaleString()}</dd></div>
          <div><dt>Reached participants</dt><dd>{scenarioResult.reached_participants.toLocaleString()}</dd></div>
          <div><dt>Capacity gap</dt><dd>{scenarioResult.capacity_gap.toLocaleString()}</dd></div>
          <div><dt>Baseline person-month exposure</dt><dd>{scenarioResult.baseline_person_months.toLocaleString()}</dd></div>
          <div><dt>Planning person-month exposure</dt><dd>{scenarioResult.alternative_person_months.toLocaleString()}</dd></div>
          <div><dt>Difference in person-month exposure</dt><dd>{scenarioResult.difference_person_months.toLocaleString()}</dd></div>
          <div><dt>Program-resource requirement</dt><dd>{new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",maximumFractionDigits:0}).format(scenarioResult.program_resource_requirement)}</dd></div>
        </dl>
        <div className="sr-only" aria-live="polite" aria-atomic="true">{resultAnnouncement}</div>
        {invalidDraft ? <section id="sensitivity" className="sensitivity-paused-state" aria-labelledby="sensitivity-paused-title">
          <h3 id="sensitivity-paused-title">Sensitivity analysis paused</h3>
          <p>Fix the Pilot Planner inputs before running sensitivity analysis or creating data requests.</p>
        </section> : <SensitivityExplorer
          scenario={scenario}
          onUpsertDataRequest={addSensitivityDataRequest}
          dataRequestStatus={sensitivityDataRequestStatus}
        />}
        <div className="guardrail compact"><strong>Not savings or ROI.</strong><p>The resource requirement is a program input. The person-month difference is a planning exposure quantity, not observed improvement.</p></div>
        {invalidDraft ? <div className="brief-action-paused">
          <button className="button" type="button" disabled>Preview Planning Brief</button>
          <span>Apply valid planning inputs before continuing from this draft.</span>
        </div> : <Link className="button" to="/brief">Preview Planning Brief</Link>}
      </article>
    </div>
  </section>;
}
