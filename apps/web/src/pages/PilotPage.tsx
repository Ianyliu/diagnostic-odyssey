import { formatPlanningCurrency, formatPlanningNumber } from "../data/planningNumberFormatting.ts";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import type { Scenario, ScenarioResult } from "@diagnostic-odyssey/contracts";
import { DetailDrawer } from "../components/DetailDrawer";
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
import { formatPublishedLocalContextUncertainty } from "../data/localContextPresentation";
import { PILOT_STRATEGY_PRESETS, type PilotStrategyPreset } from "../data/planningScenarioDefaults";
import { getPathwayBoundaryPresentation } from "../data/pathwayBoundary";
import { formatAppliedAssumption } from "./briefAssumptions";
import "./PilotPage.css";

const resultNumber = new Intl.NumberFormat("en-US");

interface SliderSpec {
  key: PilotNumericField;
  shortLabel: string;
  min: number;
  max: number;
  step: number;
  formatValue: (v: number) => string;
}

const SLIDERS: readonly SliderSpec[] = [
  { key: "reach", shortLabel: "Reach", min: 5, max: 60, step: 1, formatValue: v => `${v}%` },
  { key: "capacity", shortLabel: "Capacity", min: 200, max: 8000, step: 100, formatValue: v => resultNumber.format(v) },
  { key: "alternative_window_months", shortLabel: "Speed (window)", min: 1, max: 12, step: 1, formatValue: v => `${v} mo` },
  { key: "per_participant_cost", shortLabel: "Budget / person", min: 50, max: 1000, step: 25, formatValue: v => `$${resultNumber.format(v)}` }
];

const EXTRA_FIELDS: readonly PilotNumericField[] = [
  "eligible_population",
  "baseline_window_months",
  "horizon_months",
  "fixed_cost"
];

type BottomTab = "sensitivity" | "quantities" | "context";

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
          <p className="eyebrow">03 · SIMULATE</p>
          <h1>Pilot simulator</h1>
          <p>Planning assumptions are unavailable or invalid.</p>
        </header>
        <div className="empty-state">
          <strong>No valid scenario result is available.</strong>
          <p>National burden evidence remains unaffected.</p>
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

  const [bottomTab, setBottomTab] = useState<BottomTab>("sensitivity");
  const [boundaryOpen, setBoundaryOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

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

  const applyPreset = (preset: PilotStrategyPreset) => {
    const nextScenario: Scenario = {
      ...scenario,
      ...preset.values,
      scenario_id: preset.id
    };
    setPilotInputDraft(createPilotInputDraft(nextScenario));
    setScenario(nextScenario);
  };

  const addSensitivityDataRequest = (field: SensitivityField) => {
    upsertAnalystDataRequest(createSensitivityDataRequest(scenario, field));
  };

  const sensitivityDataRequestStatus = (field: SensitivityField) =>
    getSensitivityDataRequestStatus(scenario, field, analystDataRequests);

  return (
    <section className="page page-stack pilot-page">
      <div className="atlas-page-top">
        <header className="page-heading">
          <p className="eyebrow">03 · SIMULATE</p>
          <h1>Pilot simulator</h1>
          <p>Planning math · Not savings.</p>
        </header>
        <button
          type="button"
          className="button secondary"
          onClick={() => setBoundaryOpen(true)}
        >
          Pathway boundary
        </button>
      </div>

      {/* Split Studio */}
      <div className="atlas-studio-grid">
        {/* Left: Presets + Sliders */}
        <form id="pilot-assumptions" className="card atlas-studio-controls" onSubmit={event => event.preventDefault()}>
          <div className="atlas-presets" role="group" aria-label="Strategy presets">
            {PILOT_STRATEGY_PRESETS.map(preset => {
              const active =
                scenario.eligible_population === preset.values.eligible_population &&
                scenario.reach === preset.values.reach &&
                scenario.capacity === preset.values.capacity &&
                scenario.alternative_window_months === preset.values.alternative_window_months;
              return (
                <button
                  key={preset.id}
                  type="button"
                  className={`atlas-preset-card${active ? " is-active" : ""}`}
                  onClick={() => applyPreset(preset)}
                >
                  <strong>{preset.label}</strong>
                  <span>{preset.summary}</span>
                </button>
              );
            })}
          </div>

          <div className="atlas-slider-stack">
            {SLIDERS.map(spec => {
              const field = pilotInputFields.find(item => item.key === spec.key)!;
              const inputId = `pilot-${spec.key}`;
              const rangeId = `${inputId}-range`;
              const error = evaluation.errors[spec.key];
              const numericVal = Number(draft[spec.key]);
              const sliderVal = Number.isFinite(numericVal)
                ? Math.min(spec.max, Math.max(spec.min, numericVal))
                : spec.min;

              return (
                <div className="atlas-slider-row" key={spec.key}>
                  <div className="atlas-slider-head">
                    <label htmlFor={inputId}>{spec.shortLabel}</label>
                    <div className={`atlas-slider-num${error ? " invalid" : ""}`}>
                      <input
                        id={inputId}
                        type="text"
                        inputMode="decimal"
                        value={draft[spec.key]}
                        onChange={event => updateDraft(spec.key, event.target.value)}
                        aria-invalid={Boolean(error)}
                        aria-label={field.label}
                      />
                      {field.suffix && <small aria-hidden="true">{field.suffix}</small>}
                    </div>
                  </div>
                  <input
                    id={rangeId}
                    type="range"
                    className="atlas-range"
                    min={spec.min}
                    max={spec.max}
                    step={spec.step}
                    value={sliderVal}
                    aria-label={`${field.label} slider`}
                    onChange={event => updateDraft(spec.key, event.target.value)}
                  />
                  {error && <span className="field-error" aria-live="polite">{error}</span>}
                </div>
              );
            })}
          </div>

          <div className="atlas-more-params">
            <button
              type="button"
              className="text-button"
              onClick={() => setMoreOpen(open => !open)}
              aria-expanded={moreOpen}
            >
              {moreOpen ? "Hide base parameters" : "More parameters (Population, Horizon, Fixed cost)"}
            </button>

            {(moreOpen || EXTRA_FIELDS.some(key => Boolean(evaluation.errors[key]))) && (
              <div className="atlas-extra-grid">
                {EXTRA_FIELDS.map(key => {
                  const field = pilotInputFields.find(item => item.key === key)!;
                  const inputId = `pilot-${key}`;
                  const error = evaluation.errors[key];
                  const helper = error ? null : formatPilotInputHelper(key, draft[key]);
                  return (
                    <div className="atlas-extra-field" key={key}>
                      <label htmlFor={inputId}>{field.label}</label>
                      <div className={`atlas-slider-num${error ? " invalid" : ""}`}>
                        <input
                          id={inputId}
                          type="text"
                          inputMode="decimal"
                          value={draft[key]}
                          onChange={event => updateDraft(key, event.target.value)}
                          aria-invalid={Boolean(error)}
                        />
                        {field.suffix && <small aria-hidden="true">{field.suffix}</small>}
                      </div>
                      {helper && !error && <small className="subtle">{helper}</small>}
                      {error && <span className="field-error" aria-live="polite">{error}</span>}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {evaluation.formError && (
            <p className="field-error form-error" aria-live="polite">{evaluation.formError}</p>
          )}
        </form>

        {/* Right: Oversized KPIs + Live Gauge */}
        <article id="pilot-results" className="card atlas-studio-output">
          {invalidDraft && (
            <div className="caution" role="status">
              <strong>Draft not applied</strong>
              <span>Showing last valid planning assumptions.</span>
            </div>
          )}

          <dl className="atlas-kpi-grid" aria-label="Four applied planning quantities">
            <div className="atlas-kpi">
              <dt>Participants served</dt>
              <dd>{formatPlanningNumber(scenarioResult.reached_participants, resultNumber)}</dd>
            </div>
            <div className={`atlas-kpi${scenarioResult.capacity_gap > 0 ? " is-gap" : ""}`}>
              <dt>Capacity gap</dt>
              <dd>{formatPlanningNumber(scenarioResult.capacity_gap, resultNumber)}</dd>
            </div>
            <div className="atlas-kpi">
              <dt>Exposure difference</dt>
              <dd>{formatPlanningNumber(scenarioResult.difference_person_months, resultNumber)} pm</dd>
            </div>
            <div className="atlas-kpi">
              <dt>Resource requirement</dt>
              <dd>{formatPlanningCurrency(scenarioResult.program_resource_requirement)}</dd>
            </div>
          </dl>

          <PilotDecisionVisuals scenario={scenario} result={scenarioResult} />

          <div className="atlas-output-footer">
            <p className="micro-caption">Planning math · Not savings or ROI.</p>
            <div className="atlas-output-actions">
              {invalidDraft ? (
                <button className="button" type="button" disabled>Open Brief</button>
              ) : (
                <Link className="button" to="/brief">Open Brief →</Link>
              )}
            </div>
          </div>

          <div className="sr-only" aria-live="polite" aria-atomic="true">{resultAnnouncement}</div>
        </article>
      </div>

      {/* Bottom Tabs: Sensitivity | All Quantities | Context & Requests */}
      <div className="atlas-studio-tabs">
        <div className="atlas-tab-bar" role="tablist" aria-label="Simulator analysis panels">
          <button
            type="button"
            role="tab"
            aria-selected={bottomTab === "sensitivity"}
            className={`atlas-tab${bottomTab === "sensitivity" ? " is-active" : ""}`}
            onClick={() => setBottomTab("sensitivity")}
          >
            Sensitivity
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={bottomTab === "quantities"}
            className={`atlas-tab${bottomTab === "quantities" ? " is-active" : ""}`}
            onClick={() => setBottomTab("quantities")}
          >
            All Quantities
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={bottomTab === "context"}
            className={`atlas-tab${bottomTab === "context" ? " is-active" : ""}`}
            onClick={() => setBottomTab("context")}
          >
            Context &amp; Requests
          </button>
        </div>

        <div className="card atlas-tab-panel" role="tabpanel">
          {bottomTab === "sensitivity" && (
            invalidDraft ? (
              <section id="sensitivity" className="empty-state" aria-labelledby="sensitivity-paused-title">
                <h3 id="sensitivity-paused-title">Sensitivity analysis paused</h3>
                <p>Fix invalid draft inputs before running sensitivity.</p>
              </section>
            ) : (
              <SensitivityExplorer
                scenario={scenario}
                onUpsertDataRequest={addSensitivityDataRequest}
                dataRequestStatus={sensitivityDataRequestStatus}
              />
            )
          )}

          {bottomTab === "quantities" && (
            <div className="atlas-quantities-panel">
              <dl className="atlas-quantities-list">
                <div><dt>Intended reach</dt><dd>{formatPlanningNumber(scenarioResult.intended_reach, resultNumber)}</dd></div>
                <div><dt>Reached participants</dt><dd>{formatPlanningNumber(scenarioResult.reached_participants, resultNumber)}</dd></div>
                <div><dt>Capacity gap</dt><dd>{formatPlanningNumber(scenarioResult.capacity_gap, resultNumber)}</dd></div>
                <div><dt>Baseline person-months</dt><dd>{formatPlanningNumber(scenarioResult.baseline_person_months, resultNumber)}</dd></div>
                <div><dt>Planning person-months</dt><dd>{formatPlanningNumber(scenarioResult.alternative_person_months, resultNumber)}</dd></div>
                <div><dt>Difference in person-months</dt><dd>{formatPlanningNumber(scenarioResult.difference_person_months, resultNumber)}</dd></div>
                <div><dt>Program-resource requirement</dt><dd>{formatPlanningCurrency(scenarioResult.program_resource_requirement)}</dd></div>
              </dl>
              <DecisionTrace
                burdenEstimateCount={burdenEstimateCount}
                pilotLocalContext={pilotLocalContext}
                localContextStatus={localContextStatus}
                scenario={scenario}
                currentDataRequestCount={currentOperationalDataRequests.length}
                evidence={bundle?.evidence ?? []}
                dataRequestHref="/data-requests"
              />
            </div>
          )}

          {bottomTab === "context" && (
            <section id="pilot-context" className="atlas-pilot-context">
              <div className="card-title-row">
                <div>
                  <p className="eyebrow">ATTACHED TERRAIN</p>
                  <h3>Local planning context</h3>
                </div>
                <Link className="text-button" to="/local-context">
                  {pilotLocalContext ? "Change in Terrain →" : "Select in Terrain →"}
                </Link>
              </div>
              {pilotLocalContext ? (
                <div className="atlas-context-chip-card">
                  <strong>{pilotLocalContext.label}</strong>
                  <span>{formatLocalContextValue(pilotLocalContext)}</span>
                  <small>{pilotLocalContext.geography_name} · {formatPublishedLocalContextUncertainty(pilotLocalContext)}</small>
                  <button type="button" className="text-button" onClick={clearPilotLocalContext}>
                    Remove from Simulate
                  </button>
                </div>
              ) : (
                <p className="subtle">No local indicator attached; context never alters numeric scenario math.</p>
              )}
              <div className="atlas-footer-links">
                <Link className="button secondary" to="/data-requests">
                  Open Data Requests ({currentOperationalDataRequests.length})
                </Link>
              </div>
            </section>
          )}
        </div>
      </div>

      <DetailDrawer
        open={boundaryOpen}
        eyebrow="SCIENTIFIC BOUNDARY"
        title="Modeled pathway boundary"
        onClose={() => setBoundaryOpen(false)}
      >
        <dl className="atlas-drawer-list">
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
            <dt>Assumption limit</dt>
            <dd>{pathwayBoundary.assumptionBoundaryStatement}</dd>
          </div>
          <div>
            <dt>Outside this model</dt>
            <dd>{pathwayBoundary.outsideModelItems.join("; ")}.</dd>
          </div>
          <div>
            <dt>Applied values</dt>
            <dd>
              <ul className="atlas-compact-list">
                {pilotInputFields.map(field => (
                  <li key={field.key}>{field.label}: {formatAppliedAssumption(scenario, field)}</li>
                ))}
              </ul>
            </dd>
          </div>
        </dl>
      </DetailDrawer>
    </section>
  );
}
