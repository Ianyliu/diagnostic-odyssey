import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import type { Scenario, ScenarioResult } from "@diagnostic-odyssey/contracts";
import { AppleDetailModal } from "../components/AppleDetailModal";
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
import { formatLocalContextValue } from "../data/formatLocalContextValue";
import { formatPublishedLocalContextUncertainty } from "../data/localContextPresentation";
import { getPathwayBoundaryPresentation } from "../data/pathwayBoundary";
import { getPilotFragmentTargetId } from "../data/pilotFragmentScroll";
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
import { formatPlanningCurrency, formatPlanningNumber } from "../data/planningNumberFormatting";
import {
  PILOT_STRATEGY_PRESETS,
  PLANNING_DEFAULTS_DESCRIPTION,
  PLANNING_DEFAULTS_LABEL
} from "../data/planningScenarioDefaults";
import { formatAppliedAssumption } from "./briefAssumptions";
import "./PilotPage.css";

const resultNumber = new Intl.NumberFormat("en-US");

type PilotSubView = "visuals" | "sensitivity" | "data";

const SLIDER_CONFIG: Partial<Record<PilotNumericField, {
  min: number;
  max: number;
  step: number;
  toSlider: (scenario: Scenario) => number;
  fromSlider: (val: number) => string;
  formatBubble: (scenario: Scenario) => string;
}>> = {
  eligible_population: {
    min: 1000,
    max: 30000,
    step: 500,
    toSlider: s => s.eligible_population,
    fromSlider: v => String(v),
    formatBubble: s => `${resultNumber.format(s.eligible_population)} adults`
  },
  reach: {
    min: 5,
    max: 60,
    step: 1,
    toSlider: s => Math.round(s.reach * 100),
    fromSlider: v => String(v),
    formatBubble: s => `${Math.round(s.reach * 100)}%`
  },
  capacity: {
    min: 200,
    max: 10000,
    step: 100,
    toSlider: s => s.capacity,
    fromSlider: v => String(v),
    formatBubble: s => `${resultNumber.format(s.capacity)} slots`
  },
  alternative_window_months: {
    min: 1,
    max: 18,
    step: 1,
    toSlider: s => s.alternative_window_months,
    fromSlider: v => String(v),
    formatBubble: s => `${s.alternative_window_months} mo`
  }
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
        <header className="apple-page-header">
          <p className="apple-kicker">Edition 01 · Simulator</p>
          <h1>Test a care pilot.</h1>
          <p className="apple-subtitle">Planning assumptions are currently unavailable.</p>
        </header>
        <div className="empty-state">
          <strong>No valid planning scenario result is available.</strong>
          <p>National MEPS burden remains available without inferring savings or ROI.</p>
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
  const location = useLocation();

  const [subView, setSubView] = useState<PilotSubView>(() =>
    location.hash === "#sensitivity" ? "sensitivity" : "visuals"
  );
  const [boundaryModalOpen, setBoundaryModalOpen] = useState(false);

  useEffect(() => {
    if (location.hash === "#sensitivity") setSubView("sensitivity");
  }, [location.hash]);

  const draft: PilotInputDraft = pilotInputDraft ?? createPilotInputDraft(scenario);
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
    const nextDraft = { ...draft, [key]: raw };
    setPilotInputDraft(nextDraft);
    const nextEvaluation = evaluatePilotInputDraft(nextDraft, scenario);
    if (nextEvaluation.candidate) {
      setScenario(nextEvaluation.candidate);
    }
  };

  const applyPreset = (presetId: string) => {
    const preset = PILOT_STRATEGY_PRESETS.find(item => item.id === presetId);
    if (!preset) return;
    const nextScenario: Scenario = { ...scenario, ...preset.values };
    setScenario(nextScenario);
    setPilotInputDraft(createPilotInputDraft(nextScenario));
  };

  const activePresetId = PILOT_STRATEGY_PRESETS.find(preset =>
    Object.entries(preset.values).every(([k, v]) => scenario[k as keyof Scenario] === v)
  )?.id ?? null;

  const primaryFields: readonly PilotNumericField[] = [
    "eligible_population",
    "reach",
    "capacity",
    "alternative_window_months"
  ];
  const secondaryFields: readonly PilotNumericField[] = [
    "baseline_window_months",
    "horizon_months",
    "fixed_cost",
    "per_participant_cost"
  ];
  const hasSecondaryError = secondaryFields.some(k => Boolean(evaluation.errors[k])) || Boolean(evaluation.formError);

  const addSensitivityDataRequest = (field: SensitivityField) => {
    upsertAnalystDataRequest(createSensitivityDataRequest(scenario, field));
  };

  const sensitivityDataRequestStatus = (field: SensitivityField) =>
    getSensitivityDataRequestStatus(scenario, field, analystDataRequests);

  return (
    <section className="page page-stack pilot-page">
      <header className="apple-page-header centered">
        <p className="apple-kicker">Edition 01 · Care Pilot Simulator</p>
        <h1>Test a care pilot.</h1>
        <p className="apple-subtitle">
          Adjust reach, capacity, timing, and budget to test feasibility.
        </p>
        <p className="micro-caption">Planning math · Not savings or ROI</p>
      </header>

      {/* 3 Segmented Presets */}
      <div className="pilot-presets-bar">
        <div className="apple-segmented" role="group" aria-label="Strategy presets">
          {PILOT_STRATEGY_PRESETS.map(preset => (
            <button
              key={preset.id}
              type="button"
              aria-pressed={activePresetId === preset.id}
              onClick={() => applyPreset(preset.id)}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {/* 4 Giant Clean KPI Squircle Tiles */}
      <dl className="pilot-kpi-grid" id="pilot-results" aria-label="Four applied planning quantities">
        <div className="apple-card pilot-kpi-tile">
          <dt>Served within capacity</dt>
          <dd className="mono-figure">{formatPlanningNumber(scenarioResult.reached_participants, resultNumber)}</dd>
        </div>
        <div className={`apple-card pilot-kpi-tile${scenarioResult.capacity_gap > 0 ? " is-gap" : ""}`}>
          <dt>Capacity gap</dt>
          <dd className="mono-figure">{formatPlanningNumber(scenarioResult.capacity_gap, resultNumber)}</dd>
        </div>
        <div className="apple-card pilot-kpi-tile">
          <dt>Exposure difference</dt>
          <dd className="mono-figure">{formatPlanningNumber(scenarioResult.difference_person_months, resultNumber)} mo</dd>
        </div>
        <div className="apple-card pilot-kpi-tile">
          <dt>Program budget</dt>
          <dd className="mono-figure">{formatPlanningCurrency(scenarioResult.program_resource_requirement)}</dd>
        </div>
      </dl>

      {invalidDraft && (
        <div className="apple-card pilot-draft-warning" role="status">
          <strong>Draft not applied</strong>
          <span>Fix the highlighted input below to update the applied scenario.</span>
        </div>
      )}

      {/* Silky Sliders + Synchronized Inputs */}
      <form id="pilot-assumptions" className="apple-card pilot-controls-card" onSubmit={e => e.preventDefault()}>
        <div className="pilot-controls-head">
          <div>
            <h2>Program levers</h2>
            <p className="micro-caption">{PLANNING_DEFAULTS_LABEL}</p>
          </div>
          <button
            type="button"
            className="apple-info-btn"
            aria-label="Inspect pathway boundary and defaults"
            onClick={() => setBoundaryModalOpen(true)}
          >
            i
          </button>
        </div>

        <div className="pilot-slider-grid">
          {primaryFields.map(key => {
            const field = pilotInputFields.find(f => f.key === key)!;
            const slider = SLIDER_CONFIG[key]!;
            const inputId = "pilot-" + key;
            const sliderId = inputId + "-slider";
            const error = evaluation.errors[key];
            const helper = error ? null : formatPilotInputHelper(key, draft[key]);
            const sliderValue = Math.max(slider.min, Math.min(slider.max, slider.toSlider(scenario)));

            return (
              <div className="pilot-slider-item" key={key}>
                <div className="pilot-slider-label-row">
                  <label htmlFor={inputId}>{field.label}</label>
                  <span className="pilot-value-bubble mono-figure">{slider.formatBubble(scenario)}</span>
                </div>
                <input
                  id={sliderId}
                  className="apple-slider"
                  type="range"
                  min={slider.min}
                  max={slider.max}
                  step={slider.step}
                  value={sliderValue}
                  aria-label={`${field.label} slider`}
                  aria-valuetext={slider.formatBubble(scenario)}
                  onChange={e => updateDraft(key, slider.fromSlider(Number(e.target.value)))}
                />
                <div className="pilot-exact-row">
                  <span className={"input-wrap" + (error ? " invalid" : "")}>
                    <input
                      id={inputId}
                      type="text"
                      inputMode="decimal"
                      value={draft[key]}
                      onChange={e => updateDraft(key, e.target.value)}
                      aria-invalid={Boolean(error)}
                      aria-describedby={`${inputId}-helper ${inputId}-error`}
                    />
                    {field.suffix && <small aria-hidden="true">{field.suffix}</small>}
                  </span>
                  <span id={`${inputId}-helper`} className="micro-caption">{helper}</span>
                </div>
                <span id={`${inputId}-error`} className="field-error" aria-live="polite">{error ?? ""}</span>
              </div>
            );
          })}
        </div>

        <details className="apple-accordion" open={hasSecondaryError || undefined}>
          <summary>Timing &amp; budget inputs</summary>
          <div className="pilot-secondary-grid">
            {secondaryFields.map(key => {
              const field = pilotInputFields.find(f => f.key === key)!;
              const inputId = "pilot-" + key;
              const error = evaluation.errors[key];
              const helper = error ? null : formatPilotInputHelper(key, draft[key]);

              return (
                <div className="pilot-exact-field" key={key}>
                  <label htmlFor={inputId}>{field.label}</label>
                  <span className={"input-wrap" + (error ? " invalid" : "")}>
                    <input
                      id={inputId}
                      type="text"
                      inputMode="decimal"
                      value={draft[key]}
                      onChange={e => updateDraft(key, e.target.value)}
                      aria-invalid={Boolean(error)}
                      aria-describedby={`${inputId}-helper ${inputId}-error`}
                    />
                    {field.suffix && <small aria-hidden="true">{field.suffix}</small>}
                  </span>
                  <span id={`${inputId}-helper`} className="micro-caption">{helper}</span>
                  <span id={`${inputId}-error`} className="field-error" aria-live="polite">{error ?? ""}</span>
                </div>
              );
            })}
          </div>
        </details>

        {evaluation.formError && <p className="field-error" aria-live="polite">{evaluation.formError}</p>}
      </form>

      {/* Segmented Sub-View */}
      <div className="pilot-subview-header">
        <div className="apple-segmented" role="tablist" aria-label="Simulator analysis views">
          <button
            type="button"
            role="tab"
            aria-selected={subView === "visuals"}
            onClick={() => setSubView("visuals")}
          >
            Visual Impact
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={subView === "sensitivity"}
            onClick={() => setSubView("sensitivity")}
          >
            What-If Sensitivity
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={subView === "data"}
            onClick={() => setSubView("data")}
          >
            Data Needs ({currentOperationalDataRequests.length})
          </button>
        </div>

        <div className="pilot-next-cta">
          {invalidDraft ? (
            <button className="button" type="button" disabled>Review planning brief</button>
          ) : (
            <Link className="button" to="/brief">Review planning brief</Link>
          )}
        </div>
      </div>

      {/* Sub-view panels */}
      {subView === "visuals" && (
        <div className="pilot-subview-panel">
          <div className="apple-card">
            <PilotDecisionVisuals scenario={scenario} result={scenarioResult} />
          </div>

          <details className="apple-accordion" id="pilot-all-results">
            <summary>All 7 modeled quantities</summary>
            <dl className="pilot-all-grid">
              <div><dt>Intended reach</dt><dd className="mono-figure">{formatPlanningNumber(scenarioResult.intended_reach, resultNumber)}</dd></div>
              <div><dt>Reached participants</dt><dd className="mono-figure">{formatPlanningNumber(scenarioResult.reached_participants, resultNumber)}</dd></div>
              <div><dt>Capacity gap</dt><dd className="mono-figure">{formatPlanningNumber(scenarioResult.capacity_gap, resultNumber)}</dd></div>
              <div><dt>Baseline exposure</dt><dd className="mono-figure">{formatPlanningNumber(scenarioResult.baseline_person_months, resultNumber)}</dd></div>
              <div><dt>Planning exposure</dt><dd className="mono-figure">{formatPlanningNumber(scenarioResult.alternative_person_months, resultNumber)}</dd></div>
              <div><dt>Exposure difference</dt><dd className="mono-figure">{formatPlanningNumber(scenarioResult.difference_person_months, resultNumber)}</dd></div>
              <div><dt>Program budget</dt><dd className="mono-figure">{formatPlanningCurrency(scenarioResult.program_resource_requirement)}</dd></div>
            </dl>
          </details>

          <section id="pilot-context" className="apple-card pilot-local-context-card" aria-labelledby="pilot-local-context-title">
            <div className="pilot-controls-head">
              <div>
                <p className="apple-kicker">Reference Context</p>
                <h2 id="pilot-local-context-title">Selected local terrain</h2>
              </div>
              <Link className="text-button" to="/local-context">
                {pilotLocalContext ? "Change in Terrain" : "Select in Terrain"}
              </Link>
            </div>
            {pilotLocalContext ? (
              <div className="pilot-context-selected">
                <div>
                  <strong>{pilotLocalContext.label}</strong>
                  <p className="micro-caption">
                    {pilotLocalContext.source_agency} · {formatPublishedLocalContextUncertainty(pilotLocalContext)}
                  </p>
                </div>
                <div className="pilot-context-right">
                  <strong className="mono-figure">{formatLocalContextValue(pilotLocalContext)}</strong>
                  <button className="text-button" type="button" onClick={clearPilotLocalContext}>Remove</button>
                </div>
              </div>
            ) : (
              <p className="subtle">No local context attached. Selecting one never alters numeric levers.</p>
            )}
          </section>
        </div>
      )}

      {subView === "sensitivity" && (
        <div className="apple-card pilot-subview-panel">
          {invalidDraft ? (
            <section id="sensitivity" className="empty-state" aria-labelledby="sensitivity-paused-title">
              <strong id="sensitivity-paused-title">Sensitivity analysis paused</strong>
              <p>Fix the highlighted inputs above to run sensitivity analysis.</p>
            </section>
          ) : (
            <SensitivityExplorer
              scenario={scenario}
              onUpsertDataRequest={addSensitivityDataRequest}
              dataRequestStatus={sensitivityDataRequestStatus}
            />
          )}
        </div>
      )}

      {subView === "data" && (
        <div className="apple-card pilot-subview-panel" id="pilot-trace">
          <div className="pilot-controls-head">
            <div>
              <h2>Decision trace &amp; data requests</h2>
              <p className="micro-caption">{currentOperationalDataRequests.length} current operational request(s)</p>
            </div>
            <Link className="button secondary" to="/data-requests">Manage data requests</Link>
          </div>
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
      )}

      <div className="sr-only" aria-live="polite" aria-atomic="true">{resultAnnouncement}</div>

      <AppleDetailModal
        open={boundaryModalOpen}
        kicker="Scientific Boundary"
        title="Modeled pathway & assumptions"
        onClose={() => setBoundaryModalOpen(false)}
      >
        <p>{PLANNING_DEFAULTS_DESCRIPTION}</p>
        <dl className="apple-detail-list">
          <div>
            <dt>Target pathway step</dt>
            <dd>{pathwayBoundary.pathwayStepLabel}</dd>
          </div>
          <div>
            <dt>Assumed mechanism</dt>
            <dd>{pathwayBoundary.mechanismLabel}</dd>
          </div>
          <div>
            <dt>Modeled boundary</dt>
            <dd>{pathwayBoundary.modeledBoundaryStatement}</dd>
          </div>
          <div>
            <dt>Assumption boundary</dt>
            <dd>{pathwayBoundary.assumptionBoundaryStatement}</dd>
          </div>
          <div>
            <dt>Outside this model</dt>
            <dd>{pathwayBoundary.outsideModelItems.join("; ")}</dd>
          </div>
          <div>
            <dt>Applied inputs</dt>
            <dd>{pilotInputFields.map(f => `${f.label}: ${formatAppliedAssumption(scenario, f)}`).join(" · ")}</dd>
          </div>
        </dl>
      </AppleDetailModal>
    </section>
  );
}
