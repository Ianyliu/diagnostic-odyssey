import { formatPlanningCurrency, formatPlanningNumber, formatPlanningPercent, isScientificNotationText } from "../data/planningNumberFormatting.ts";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
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
import { buildScenarioComparisonRows, presetMatchesScenario } from "../data/scenarioComparison";
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
}

const SLIDERS: readonly SliderSpec[] = [
  { key: "reach", shortLabel: "Intended reach", min: 0, max: 100, step: 1 },
  { key: "capacity", shortLabel: "Program capacity", min: 200, max: 8000, step: 100 },
  { key: "alternative_window_months", shortLabel: "Planning recognition window", min: 1, max: 12, step: 1 },
  { key: "per_participant_cost", shortLabel: "Cost per participant", min: 50, max: 1000, step: 25 }
];

const EXTRA_FIELDS: readonly PilotNumericField[] = [
  "eligible_population",
  "baseline_window_months",
  "horizon_months",
  "fixed_cost"
];

function renderPlanningText(text: string) {
  return isScientificNotationText(text) ? <span className="scientific-value">{text}</span> : text;
}

type BottomTab = "sensitivity" | "compare" | "quantities" | "context";
const BOTTOM_TABS: readonly { id: BottomTab; label: string }[] = [
  { id: "sensitivity", label: "Sensitivity" },
  { id: "compare", label: "Compare Strategies" },
  { id: "quantities", label: "All Quantities" },
  { id: "context", label: "Context & Requests" }
];

function formatSignedDelta(value: number | null, isCurrency = false): string | null {
  if (value === null || value === 0 || !Number.isFinite(value)) return null;
  const sign = value > 0 ? "+" : "−";
  const absText = isCurrency
    ? formatPlanningCurrency(Math.abs(value))
    : formatPlanningNumber(Math.abs(value), resultNumber);
  return `${sign}${absText}`;
}

export function PilotPage({ advisorAvailable = false }: { advisorAvailable?: boolean }) {
  const { scenario, scenarioResult } = useArtifact();
  const location = useLocation();
  const sensitivityReady = scenario !== null && scenarioResult !== null;

  useEffect(() => {
    const targetId = getPilotFragmentTargetId(location.hash);
    if (!targetId || !sensitivityReady) return;
    requestAnimationFrame(() => {
      document.getElementById(targetId)?.scrollIntoView({ block: "start" });
    });
  }, [location.hash, sensitivityReady]);

  if (!scenario || !scenarioResult) {
    return (
      <section className="page page-stack">
        <header className="page-heading">
          <p className="eyebrow">03 · STRATEGY LAB</p>
          <h1>Scope a feasible pilot</h1>
          <p>Planning assumptions are unavailable or invalid.</p>
        </header>
        <div className="empty-state">
          <strong>No valid scenario result is available.</strong>
          <p>National burden evidence remains unaffected.</p>
        </div>
      </section>
    );
  }

  return (
    <PilotPlannerWorkspace
      scenario={scenario}
      scenarioResult={scenarioResult}
      advisorAvailable={advisorAvailable}
      hash={location.hash}
    />
  );
}

function PilotPlannerWorkspace({
  scenario,
  scenarioResult,
  advisorAvailable,
  hash
}: {
  scenario: Scenario;
  scenarioResult: ScenarioResult;
  advisorAvailable: boolean;
  hash: string;
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

  const [bottomTab, setBottomTab] = useState<BottomTab>(() =>
    hash === "#pilot-context" ? "context" : "sensitivity"
  );
  const [boundaryOpen, setBoundaryOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [inspectorOpen, setInspectorOpen] = useState(true);
  const tabButtonRefs = useRef<Partial<Record<BottomTab, HTMLButtonElement | null>>>({});

  useEffect(() => {
    if (getPilotFragmentTargetId(hash) === "sensitivity") setBottomTab("sensitivity");
    if (hash === "#pilot-context") setBottomTab("context");
  }, [hash]);

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

  const handleTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>, currentId: BottomTab) => {
    const ids = BOTTOM_TABS.map(t => t.id);
    const index = ids.indexOf(currentId);
    let nextIndex = -1;
    if (event.key === "ArrowRight") nextIndex = (index + 1) % ids.length;
    else if (event.key === "ArrowLeft") nextIndex = (index - 1 + ids.length) % ids.length;
    else if (event.key === "Home") nextIndex = 0;
    else if (event.key === "End") nextIndex = ids.length - 1;
    if (nextIndex < 0) return;
    event.preventDefault();
    const targetId = ids[nextIndex]!;
    setBottomTab(targetId);
    tabButtonRefs.current[targetId]?.focus();
  };

  const showExtraFields =
    moreOpen ||
    EXTRA_FIELDS.some(key => Boolean(evaluation.errors[key])) ||
    Boolean(evaluation.formError);

  return (
    <section className="page page-stack pilot-page">
      <div className="atlas-page-top">
        <header className="page-heading">
          <p className="eyebrow">03 · STRATEGY LAB</p>
          <h1>Scope a feasible pilot</h1>
          <p>Deterministic scenario arithmetic · Not observed effectiveness or savings.</p>
        </header>
        <div className="atlas-page-top-actions">
          <button
            type="button"
            className="button secondary"
            aria-expanded={inspectorOpen}
            aria-controls="pilot-decision-inspector"
            onClick={() => setInspectorOpen(open => !open)}
          >
            {inspectorOpen ? "Hide inspector" : "Show inspector"}
          </button>
          <button
            type="button"
            className="button secondary"
            onClick={() => setBoundaryOpen(true)}
          >
            Pathway boundary
          </button>
        </div>
      </div>

      <nav className="atlas-section-jump" aria-label="Strategy Lab sections">
        <a className="text-button" href="#pilot-assumptions">Assumptions</a>
        <a className="text-button" href="#pilot-results">Outputs</a>
        <a
          className="text-button"
          href="#sensitivity"
          onClick={() => setBottomTab("sensitivity")}
        >
          Sensitivity
        </a>
      </nav>

      {/* Three-region workspace */}
      <div className={`atlas-studio-grid${inspectorOpen ? "" : " is-inspector-collapsed"}`}>
        {/* Region 1: Presets + Sliders */}
        <form id="pilot-assumptions" className="card atlas-studio-controls" onSubmit={event => event.preventDefault()}>
          <div className="atlas-presets" role="group" aria-label="Strategy presets">
            {PILOT_STRATEGY_PRESETS.map(preset => {
              const active = presetMatchesScenario(preset, scenario);
              return (
                <button
                  key={preset.id}
                  type="button"
                  aria-pressed={active}
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
              const helperId = `${inputId}-helper`;
              const errorId = `${inputId}-error`;
              const error = evaluation.errors[spec.key];
              const helper = error ? null : formatPilotInputHelper(spec.key, draft[spec.key]);
              const numericVal = Number(draft[spec.key]);
              const appliedNumeric = spec.key === "reach" ? scenario.reach * 100 : scenario[spec.key];
              const appliedSliderVal = Number.isFinite(appliedNumeric)
                ? Math.min(spec.max, Math.max(spec.min, appliedNumeric))
                : spec.min;
              const sliderDecoupled = Boolean(error) || !Number.isFinite(numericVal);
              const sliderVal = sliderDecoupled
                ? appliedSliderVal
                : Math.min(spec.max, Math.max(spec.min, numericVal));
              const describedBy = [helper ? helperId : null, error ? errorId : null]
                .filter(Boolean)
                .join(" ") || undefined;

              return (
                <div className="atlas-slider-row" key={spec.key}>
                  <div className="atlas-slider-head">
                    <label htmlFor={inputId}>{spec.shortLabel}</label>
                    <div className={`input-wrap atlas-slider-num${error ? " invalid" : ""}`}>
                      <input
                        id={inputId}
                        type="text"
                        inputMode="decimal"
                        value={draft[spec.key]}
                        onChange={event => updateDraft(spec.key, event.target.value)}
                        aria-invalid={Boolean(error)}
                        aria-label={field.label}
                        aria-describedby={describedBy}
                      />
                      {field.suffix && <small aria-hidden="true">{field.suffix}</small>}
                    </div>
                  </div>
                  <input
                    id={rangeId}
                    type="range"
                    className={`atlas-range${sliderDecoupled ? " is-decoupled" : ""}`}
                    min={spec.min}
                    max={spec.max}
                    step={spec.step}
                    value={sliderVal}
                    aria-label={`${field.label} slider`}
                    onChange={event => updateDraft(spec.key, event.target.value)}
                  />
                  {helper && <small id={helperId} className="subtle">{helper}</small>}
                  {sliderDecoupled && (
                    <small className="subtle">Slider reflects last applied scenario until draft is fixed.</small>
                  )}
                  {error && <span id={errorId} className="field-error" aria-live="polite">{error}</span>}
                </div>
              );
            })}
          </div>

          <div className="atlas-more-params">
            <button
              type="button"
              className="text-button"
              onClick={() => setMoreOpen(open => !open)}
              aria-expanded={showExtraFields}
            >
              {showExtraFields ? "Hide base parameters" : "More parameters (Population, Horizon, Fixed cost)"}
            </button>

            {showExtraFields && (
              <div className="atlas-extra-grid">
                {EXTRA_FIELDS.map(key => {
                  const field = pilotInputFields.find(item => item.key === key)!;
                  const inputId = `pilot-${key}`;
                  const helperId = `${inputId}-helper`;
                  const errorId = `${inputId}-error`;
                  const error = evaluation.errors[key];
                  const helper = error ? null : formatPilotInputHelper(key, draft[key]);
                  const describedBy = [helper ? helperId : null, error ? errorId : null]
                    .filter(Boolean)
                    .join(" ") || undefined;
                  return (
                    <div className="atlas-extra-field" key={key}>
                      <label htmlFor={inputId}>{field.label}</label>
                      <div className={`input-wrap atlas-slider-num${error ? " invalid" : ""}`}>
                        <input
                          id={inputId}
                          type="text"
                          inputMode="decimal"
                          value={draft[key]}
                          onChange={event => updateDraft(key, event.target.value)}
                          aria-invalid={Boolean(error)}
                          aria-describedby={describedBy}
                        />
                        {field.suffix && <small aria-hidden="true">{field.suffix}</small>}
                      </div>
                      {helper && !error && <small id={helperId} className="subtle">{helper}</small>}
                      {error && <span id={errorId} className="field-error" aria-live="polite">{error}</span>}
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

        {/* Region 2: Applied Calculations & Visuals */}
        <article id="pilot-results" className="card atlas-studio-output">
          {invalidDraft && (
            <div className="caution draft-not-applied" role="status">
              <strong>Draft not applied</strong>
              <span>Showing last valid planning assumptions.</span>
            </div>
          )}

          <dl className="atlas-kpi-grid pilot-headlines" aria-label="Four applied planning quantities">
            <div className="atlas-kpi">
              <dt>Participants served</dt>
              <dd>{renderPlanningText(formatPlanningNumber(scenarioResult.reached_participants, resultNumber))}</dd>
            </div>
            <div className={`atlas-kpi${scenarioResult.capacity_gap > 0 ? " is-gap" : ""}`}>
              <dt>Capacity gap</dt>
              <dd>{renderPlanningText(formatPlanningNumber(scenarioResult.capacity_gap, resultNumber))}</dd>
            </div>
            <div className="atlas-kpi">
              <dt>Exposure difference</dt>
              <dd>{renderPlanningText(formatPlanningNumber(scenarioResult.difference_person_months, resultNumber))} pm</dd>
            </div>
            <div className="atlas-kpi">
              <dt>Resource requirement</dt>
              <dd>{renderPlanningText(formatPlanningCurrency(scenarioResult.program_resource_requirement))}</dd>
            </div>
          </dl>

          <PilotDecisionVisuals scenario={scenario} result={scenarioResult} />

          <div className="atlas-output-footer">
            <p className="micro-caption">Planning math · Not savings or ROI.</p>
            <div className="atlas-output-actions">
              {invalidDraft ? (
                <button className="button" type="button" disabled>Open Brief</button>
              ) : (
                <Link className="button" to="/brief">Open Planning Brief →</Link>
              )}
            </div>
          </div>

          <div className="sr-only" aria-live="polite" aria-atomic="true">{resultAnnouncement}</div>
        </article>

        {/* Region 3: Collapsible Contextual Decision Inspector */}
        {inspectorOpen && (() => {
          const roundedCap = Math.max(0, Math.round(scenario.capacity));
          const unusedSlots = Math.max(0, roundedCap - scenarioResult.reached_participants);
          const windowDelta = scenario.baseline_window_months - scenario.alternative_window_months;
          return (
            <aside id="pilot-decision-inspector" className="card atlas-decision-inspector" aria-labelledby="pilot-inspector-title">
              <header>
                <p className="eyebrow">DECISION INTELLIGENCE</p>
                <h2 id="pilot-inspector-title">Scenario boundary &amp; gap checks</h2>
                <p className="subtle">Rule-based checks on the applied scenario, not AI predictions or forecasts.</p>
              </header>
              <div className="atlas-inspector-item">
                <h3>Capacity &amp; reach</h3>
                {invalidDraft ? (
                  <p>Draft inputs contain validation errors; cards and counts reflect the last valid scenario.</p>
                ) : scenarioResult.capacity_gap > 0 ? (
                  <p>
                    <strong>{formatPlanningNumber(scenarioResult.capacity_gap, resultNumber)}</strong> intended participants exceed assumed capacity ({formatPlanningNumber(scenarioResult.intended_reach, resultNumber)} intended vs. {formatPlanningNumber(roundedCap, resultNumber)} effective slots).
                  </p>
                ) : (
                  <p>
                    Assumed capacity ({formatPlanningNumber(roundedCap, resultNumber)} effective slots) covers all {formatPlanningNumber(scenarioResult.intended_reach, resultNumber)} intended participants ({formatPlanningNumber(unusedSlots, resultNumber)} unused slots). Real-world staffing feasibility remains unverified.
                  </p>
                )}
              </div>
              <div className="atlas-inspector-item">
                <h3>Window &amp; cost boundaries</h3>
                <p>
                  Recognition window assumption shifts {scenario.baseline_window_months} → {scenario.alternative_window_months} mo (−{windowDelta} mo; {formatPlanningNumber(scenarioResult.difference_person_months, resultNumber)} pm exposure difference). Resource split: {formatPlanningCurrency(scenarioResult.fixed_program_cost)} fixed + {formatPlanningCurrency(scenarioResult.variable_program_cost)} variable; capacity expansion cost is excluded.
                </p>
              </div>
              <div className="atlas-inspector-item">
                <h3>Implementation context</h3>
                {pilotLocalContext ? (
                  <p>
                    <strong>{pilotLocalContext.label}:</strong>{" "}
                    <span className="pilot-local-context-value">{formatLocalContextValue(pilotLocalContext)}</span>{" "}
                    — implementation context only; it never changes the arithmetic.
                  </p>
                ) : (
                  <p>No local indicator attached. Context informs interpretation; it never changes the arithmetic.</p>
                )}
                <Link className="text-button" to="/local-context">Inspect local indicators →</Link>
              </div>
              <div className="atlas-inspector-item">
                <h3>Information needs &amp; evidence</h3>
                <p>
                  {currentOperationalDataRequests.length} current analyst-generated operational data {currentOperationalDataRequests.length === 1 ? "request" : "requests"} ({bundle?.evidence.length ?? 0} approved intervention-effect records loaded). Requests remain separate from evidence.
                </p>
                <Link className="text-button" to="/data-requests">Review requests →</Link>
              </div>
              {advisorAvailable && <div className="atlas-inspector-ai">
                <h3>Strategy AI Studio</h3>
                <p>Prompt Studio, Illustrative exploration, and gated preview guidance. AI output does not set scenario parameters or establish effectiveness.</p>
                <Link className="button secondary" to="/advisor">Open Strategy AI Studio →</Link>
              </div>}
            </aside>
          );
        })()}
      </div>

      {/* Bottom Tabs: Sensitivity | All Quantities | Context & Requests */}
      <div className="atlas-studio-tabs">
        <div className="atlas-tab-bar" role="tablist" aria-label="Simulator analysis panels">
          {BOTTOM_TABS.map(tab => (
            <button
              key={tab.id}
              ref={el => { tabButtonRefs.current[tab.id] = el; }}
              id={`pilot-tab-${tab.id}`}
              type="button"
              role="tab"
              tabIndex={bottomTab === tab.id ? 0 : -1}
              aria-selected={bottomTab === tab.id}
              aria-controls={`pilot-panel-${tab.id}`}
              className={`atlas-tab${bottomTab === tab.id ? " is-active" : ""}`}
              onKeyDown={event => handleTabKeyDown(event, tab.id)}
              onClick={() => setBottomTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div
          id={`pilot-panel-${bottomTab}`}
          className="card atlas-tab-panel"
          role="tabpanel"
          aria-labelledby={`pilot-tab-${bottomTab}`}
        >
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

          {bottomTab === "compare" && (() => {
            const rows = buildScenarioComparisonRows(scenario);
            return (
              <section id="pilot-compare" className="atlas-compare-panel" aria-labelledby="compare-strategies-title">
                <div className="atlas-compare-head">
                  <div>
                    <p className="visual-kicker">MULTI-SCENARIO COMPARISON</p>
                    <h3 id="compare-strategies-title">Compare candidate strategies deterministically</h3>
                  </div>
                </div>
                <p className="micro-caption">
                  Arithmetic comparison across presets and current inputs via the canonical engine. Not observed evidence, effectiveness rankings, or ROI.
                </p>
                <p className="micro-caption comparison-cap-note">
                  When scenarios with different intended reach both exceed the same capacity cap, served participants is capped at capacity (reached = min(intended reach, capacity)), so participant counts and variable resource costs match until capacity increases.
                </p>
                <div
                  className="comparison-table-wrap"
                  role="region"
                  aria-labelledby="compare-strategies-title"
                  tabIndex={0}
                >
                  <table className="comparison-table">
                    <caption className="sr-only">
                      Deterministic scenario comparison across Strategy Lab presets and current active inputs
                    </caption>
                    <thead>
                      <tr>
                        <th scope="col">Strategy</th>
                        <th scope="col">Reach</th>
                        <th scope="col">Capacity</th>
                        <th scope="col">Served</th>
                        <th scope="col">Capacity gap</th>
                        <th scope="col">Exposure diff.</th>
                        <th scope="col">Resources</th>
                        <th scope="col">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map(row => {
                        const res = row.result;
                        const dReached = formatSignedDelta(row.deltaReached);
                        const dGap = formatSignedDelta(row.deltaGap);
                        const dExp = formatSignedDelta(row.deltaExposure);
                        const dCost = formatSignedDelta(row.deltaCost, true);
                        return (
                          <tr key={row.id} className={row.isCurrent ? "is-active-row" : undefined}>
                            <th scope="row">
                              <span className="comparison-strategy-name">{row.label}</span>
                              {row.isCurrent && <span className="status status-selection">Active</span>}
                              <small>{row.summary}</small>
                            </th>
                            <td>{formatPlanningPercent(row.scenario.reach)}</td>
                            <td>{renderPlanningText(formatPlanningNumber(row.scenario.capacity, resultNumber))}</td>
                            <td>
                              {res ? (
                                <>
                                  {renderPlanningText(formatPlanningNumber(res.reached_participants, resultNumber))}
                                  {dReached && <small className="comparison-delta">{dReached}</small>}
                                </>
                              ) : "Invalid"}
                            </td>
                            <td>
                              {res ? (
                                <>
                                  {renderPlanningText(formatPlanningNumber(res.capacity_gap, resultNumber))}
                                  {dGap && <small className="comparison-delta">{dGap}</small>}
                                </>
                              ) : "Invalid"}
                            </td>
                            <td>
                              {res ? (
                                <>
                                  {renderPlanningText(formatPlanningNumber(res.difference_person_months, resultNumber))} pm
                                  {dExp && <small className="comparison-delta">{dExp} pm</small>}
                                </>
                              ) : "Invalid"}
                            </td>
                            <td>
                              {res ? (
                                <>
                                  {renderPlanningText(formatPlanningCurrency(res.program_resource_requirement))}
                                  {dCost && <small className="comparison-delta">{dCost}</small>}
                                </>
                              ) : "Invalid"}
                            </td>
                            <td>
                              {row.preset ? (
                                <button
                                  type="button"
                                  className="button secondary comparison-load-btn"
                                  disabled={row.isCurrent}
                                  onClick={() => applyPreset(row.preset!)}
                                >
                                  {row.isCurrent ? "Active" : "Load preset"}
                                </button>
                              ) : (
                                <span className="subtle">Applied</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            );
          })()}

          {bottomTab === "quantities" && (
            <div className="atlas-quantities-panel">
              <dl className="atlas-quantities-list pilot-result-ledger">
                <div><dt>Intended reach</dt><dd>{renderPlanningText(formatPlanningNumber(scenarioResult.intended_reach, resultNumber))}</dd></div>
                <div><dt>Reached participants</dt><dd>{renderPlanningText(formatPlanningNumber(scenarioResult.reached_participants, resultNumber))}</dd></div>
                <div><dt>Capacity gap</dt><dd>{renderPlanningText(formatPlanningNumber(scenarioResult.capacity_gap, resultNumber))}</dd></div>
                <div><dt>Baseline person-months</dt><dd>{renderPlanningText(formatPlanningNumber(scenarioResult.baseline_person_months, resultNumber))}</dd></div>
                <div><dt>Planning person-months</dt><dd>{renderPlanningText(formatPlanningNumber(scenarioResult.alternative_person_months, resultNumber))}</dd></div>
                <div><dt>Difference in person-months</dt><dd>{renderPlanningText(formatPlanningNumber(scenarioResult.difference_person_months, resultNumber))}</dd></div>
                <div><dt>Program-resource requirement</dt><dd>{renderPlanningText(formatPlanningCurrency(scenarioResult.program_resource_requirement))}</dd></div>
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
                  <p className="eyebrow">ATTACHED LOCAL CONTEXT</p>
                  <h3>Local planning context</h3>
                </div>
                <Link className="text-button" to="/local-context">
                  {pilotLocalContext ? "Change in Local context →" : "Select in Local context →"}
                </Link>
              </div>
              {pilotLocalContext ? (
                <div className="atlas-context-chip-card">
                  <strong>{pilotLocalContext.label}</strong>
                  <span>{formatLocalContextValue(pilotLocalContext)}</span>
                  <small>{pilotLocalContext.geography_name} · {formatPublishedLocalContextUncertainty(pilotLocalContext)}</small>
                  <button type="button" className="text-button" onClick={clearPilotLocalContext}>
                    Remove from Strategy Lab
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
