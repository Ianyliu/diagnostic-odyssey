import { formatPlanningCurrency, formatPlanningNumber } from "../data/planningNumberFormatting.ts";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import type { Scenario, ScenarioResult } from "@diagnostic-odyssey/contracts";
import { DecisionTrace } from "../components/DecisionTrace";
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
import { PILOT_STRATEGY_PRESETS } from "../data/planningScenarioDefaults";
import { getPathwayBoundaryPresentation } from "../data/pathwayBoundary";
import { formatAppliedAssumption } from "./briefAssumptions";
import "./PilotPage.css";

const resultNumber = new Intl.NumberFormat("en-US");

const sliderSpecs: Partial<Record<PilotNumericField, { min: number; max: number; step: number }>> = {
  eligible_population: { min: 1000, max: 30000, step: 500 },
  reach: { min: 0, max: 100, step: 1 },
  capacity: { min: 0, max: 10000, step: 100 },
  baseline_window_months: { min: 1, max: 24, step: 1 },
  alternative_window_months: { min: 1, max: 24, step: 1 },
  horizon_months: { min: 1, max: 36, step: 1 },
  fixed_cost: { min: 0, max: 1000000, step: 10000 },
  per_participant_cost: { min: 0, max: 1500, step: 25 }
};

export function PilotPage() {
  const { scenario, scenarioResult } = useArtifact();
  const location = useLocation();
  const sensitivityReady = scenario !== null && scenarioResult !== null;

  useEffect(() => {
    const targetId = getPilotFragmentTargetId(location.hash);
    if (!targetId || !sensitivityReady) return;
    document.getElementById(targetId)?.scrollIntoView({ block: "start" });
  }, [location.hash, sensitivityReady]);

  if (!scenario || !scenarioResult) {
    return (
      <section className="page page-stack">
        <header className="page-heading">
          <p className="eyebrow">03 · SCENARIO SIMULATOR</p>
          <h1>Test navigation capacity and reach</h1>
          <p>Planning assumptions are unavailable or invalid.</p>
        </header>
        <div className="empty-state">
          <strong>No valid planning scenario result is available.</strong>
          <p>Reviewed national burden remains unchanged.</p>
        </div>
      </section>
    );
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
    pilotInputDraft,
    setPilotInputDraft,
    analystDataRequests,
    upsertAnalystDataRequest,
    pilotLocalContext,
    localContextStatus,
    clearPilotLocalContext
  } = useArtifact();

  const [traceDrawerOpen, setTraceDrawerOpen] = useState(false);

  const draft: PilotInputDraft = pilotInputDraft ?? createPilotInputDraft(scenario);
  const evaluation = useMemo(() => evaluatePilotInputDraft(draft, scenario), [draft, scenario]);
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
    const nextDraft = { ...draft, [key]: raw };
    setPilotInputDraft(nextDraft);
    const nextEvaluation = evaluatePilotInputDraft(nextDraft, scenario);
    if (nextEvaluation.candidate) {
      setScenario(nextEvaluation.candidate);
    }
  };

  const applyPreset = (values: (typeof PILOT_STRATEGY_PRESETS)[number]["values"]) => {
    const nextScenario: Scenario = { ...scenario, ...values };
    setScenario(nextScenario);
    setPilotInputDraft(createPilotInputDraft(nextScenario));
  };

  const addSensitivityDataRequest = (field: SensitivityField) => {
    upsertAnalystDataRequest(createSensitivityDataRequest(scenario, field));
  };

  const sensitivityDataRequestStatus = (field: SensitivityField) =>
    getSensitivityDataRequestStatus(scenario, field, analystDataRequests);

  const activePresetId =
    PILOT_STRATEGY_PRESETS.find(
      preset =>
        preset.values.eligible_population === scenario.eligible_population &&
        preset.values.reach === scenario.reach &&
        preset.values.capacity === scenario.capacity &&
        preset.values.alternative_window_months === scenario.alternative_window_months &&
        preset.values.fixed_cost === scenario.fixed_cost &&
        preset.values.per_participant_cost === scenario.per_participant_cost
    )?.id ?? null;

  return (
    <section className="page page-stack pilot-command-page">
      <header className="section-header-bar">
        <div className="page-heading">
          <p className="eyebrow">03 · SCENARIO SIMULATOR</p>
          <h1>Test navigation capacity and reach</h1>
          <p>Deterministic planning math across reach, capacity, and timing.</p>
          <p className="micro-caption">Planning math · Not savings</p>
        </div>
        <div className="section-header-actions">
          <button
            type="button"
            className="button secondary"
            onClick={() => setTraceDrawerOpen(true)}
            aria-haspopup="dialog"
          >
            Boundary &amp; Trace
          </button>
          <Link className="button secondary" to="/data-requests">
            Data Requests
          </Link>
          {invalidDraft ? (
            <button className="button" type="button" disabled>Review planning brief</button>
          ) : (
            <Link className="button" to="/brief">
              04 Brief →
            </Link>
          )}
        </div>
      </header>

      <div className="pilot-warroom-grid">
        <div className="pilot-controls-col">
          <div className="preset-bar" role="group" aria-label="Strategy presets">
            {PILOT_STRATEGY_PRESETS.map(preset => (
              <button
                key={preset.id}
                type="button"
                aria-pressed={activePresetId === preset.id}
                className={`preset-pill${activePresetId === preset.id ? " is-active" : ""}`}
                onClick={() => applyPreset(preset.values)}
              >
                <strong>{preset.label}</strong>
                <span>{preset.summary}</span>
              </button>
            ))}
          </div>

          <form
            id="pilot-assumptions"
            className="card pilot-sliders-card"
            onSubmit={event => event.preventDefault()}
          >
            <div className="pilot-card-head">
              <p className="eyebrow">PLANNING LEVERS</p>
              <h2>Illustrative defaults — edit before use</h2>
            </div>

            {pilotInputFields.map(field => {
              const inputId = "pilot-" + field.key;
              const sliderId = inputId + "-slider";
              const helperId = inputId + "-helper";
              const errorId = inputId + "-error";
              const error = evaluation.errors[field.key];
              const helper = error ? null : formatPilotInputHelper(field.key, draft[field.key]);
              const spec = sliderSpecs[field.key];
              const numericDraft = Number(draft[field.key]);
              const sliderVal = Number.isFinite(numericDraft)
                ? Math.max(spec?.min ?? 0, Math.min(spec?.max ?? 100, numericDraft))
                : spec?.min ?? 0;

              return (
                <div className="lever-row" key={field.key}>
                  <div className="lever-label-row">
                    <label htmlFor={inputId}>{field.label}</label>
                    <span className="input-wrap-inline">
                      <span className={`input-wrap${error ? " invalid" : ""}`}>
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
                    </span>
                  </div>

                  {spec && (
                    <input
                      id={sliderId}
                      type="range"
                      min={spec.min}
                      max={spec.max}
                      step={spec.step}
                      value={sliderVal}
                      aria-label={`${field.label} slider`}
                      aria-valuetext={helper ?? draft[field.key]}
                      onChange={event => updateDraft(field.key, event.target.value)}
                    />
                  )}
                  <div className="lever-meta">
                    <span id={helperId} className="micro-caption">
                      {helper}
                    </span>
                    <span id={errorId} className="field-error" aria-live="polite">
                      {error ?? ""}
                    </span>
                  </div>
                </div>
              );
            })}

            {evaluation.formError && (
              <p className="field-error" aria-live="polite">
                {evaluation.formError}
              </p>
            )}
          </form>

          <section id="pilot-context" className="pinned-terrain-chip" aria-label="Local planning context">
            {pilotLocalContext ? (
              <div className="pinned-terrain-row">
                <div>
                  <span className="eyebrow">PINNED TERRAIN (CONTEXT ONLY)</span>
                  <strong>{pilotLocalContext.label}</strong>
                  <span className="mono-value">{formatLocalContextValue(pilotLocalContext)}</span>
                </div>
                <div className="pinned-terrain-actions">
                  <Link className="text-button" to="/local-context">
                    Change
                  </Link>
                  <button type="button" className="text-button" onClick={clearPilotLocalContext}>
                    Remove
                  </button>
                </div>
              </div>
            ) : (
              <div className="pinned-terrain-row">
                <span>No local terrain pinned.</span>
                <Link className="text-button" to="/local-context">
                  Pin from 02 Terrain →
                </Link>
              </div>
            )}
          </section>
        </div>

        <div id="pilot-results" className="pilot-telemetry-col">
          {invalidDraft && (
            <div className="draft-not-applied" role="status">
              <strong>Draft not applied</strong>
              <span>
                Results show last valid planning assumptions. Apply valid planning inputs before continuing from this draft.
              </span>
            </div>
          )}

          <dl className="pilot-kpi-grid" aria-label="Four applied planning quantities">
            <div className="pilot-kpi-card">
              <dt>Reached participants</dt>
              <dd>{formatPlanningNumber(scenarioResult.reached_participants, resultNumber)}</dd>
              <span className="micro-caption">Within capacity</span>
            </div>
            <div
              className={`pilot-kpi-card${
                scenarioResult.capacity_gap > 0 ? " is-bottleneck" : ""
              }`}
            >
              <dt>Capacity gap</dt>
              <dd>{formatPlanningNumber(scenarioResult.capacity_gap, resultNumber)}</dd>
              <span className="micro-caption">Unmet intended reach</span>
            </div>
            <div className="pilot-kpi-card">
              <dt>Person-month delta</dt>
              <dd>{formatPlanningNumber(scenarioResult.difference_person_months, resultNumber)}</dd>
              <span className="micro-caption">Exposure difference</span>
            </div>
            <div className="pilot-kpi-card is-gold">
              <dt>Program-resource requirement</dt>
              <dd>{formatPlanningCurrency(scenarioResult.program_resource_requirement)}</dd>
              <span className="micro-caption">Planning math · Not savings</span>
            </div>
          </dl>

          <PilotDecisionVisuals scenario={scenario} result={scenarioResult} />

          <div className="sr-only" aria-live="polite" aria-atomic="true">
            {resultAnnouncement}
          </div>

          {invalidDraft ? <section id="sensitivity" className="empty-state" aria-labelledby="sensitivity-paused-title">
              <strong id="sensitivity-paused-title">Sensitivity analysis paused</strong>
              <p>
                Fix the Pilot planner inputs before running sensitivity analysis or creating data requests.
              </p>
            </section> : <SensitivityExplorer
              scenario={scenario}
              onUpsertDataRequest={addSensitivityDataRequest}
              dataRequestStatus={sensitivityDataRequestStatus}
            />}
        </div>
      </div>

      {traceDrawerOpen && (
        <div
          className="inspector-drawer-backdrop"
          onClick={event => {
            if (event.target === event.currentTarget) setTraceDrawerOpen(false);
          }}
        >
          <aside
            className="inspector-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Pathway boundary and decision trace"
          >
            <div className="inspector-drawer-head">
              <div>
                <p className="eyebrow">BOUNDARY &amp; AUDIT TRACE</p>
                <h2>Modeled pathway boundary</h2>
              </div>
              <button
                type="button"
                className="button secondary"
                onClick={() => setTraceDrawerOpen(false)}
              >
                Close
              </button>
            </div>

            <dl className="inspector-dl">
              <div>
                <dt>Target pathway step</dt>
                <dd>{pathwayBoundary.pathwayStepLabel}</dd>
              </div>
              <div>
                <dt>Assumed mechanism</dt>
                <dd>{pathwayBoundary.mechanismLabel}</dd>
              </div>
              <div>
                <dt>Boundary rule</dt>
                <dd>{pathwayBoundary.assumptionBoundaryStatement}</dd>
              </div>
              <div>
                <dt>Outside this model</dt>
                <dd>{pathwayBoundary.outsideModelItems.join("; ")}.</dd>
              </div>
            </dl>

            <div className="drawer-section">
              <p className="eyebrow">ALL APPLIED INPUTS</p>
              <dl className="inspector-dl">
                {pilotInputFields.map(field => (
                  <div key={field.key}>
                    <dt>{field.label}</dt>
                    <dd>{formatAppliedAssumption(scenario, field)}</dd>
                  </div>
                ))}
              </dl>
            </div>

            <div className="drawer-section">
              <p className="eyebrow">DECISION TRACE</p>
              <DecisionTrace
                burdenEstimateCount={burdenEstimateCount}
                pilotLocalContext={pilotLocalContext}
                localContextStatus={localContextStatus}
                scenario={scenario}
                currentDataRequestCount={currentOperationalDataRequests.length}
                evidence={bundle?.evidence ?? []}
                dataRequestHref="/pilot#sensitivity"
              />
            </div>
          </aside>
        </div>
      )}
    </section>
  );
}
