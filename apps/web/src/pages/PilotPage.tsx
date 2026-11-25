import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useLocation } from "react-router-dom";
import type { Scenario, ScenarioResult } from "@diagnostic-odyssey/contracts";
// Import order is stylesheet order: each component below imports its own CSS, and the bundled
// cascade must stay DetailDrawer, DecisionTrace, PilotDecisionVisuals, SensitivityExplorer exactly as
// before the page was split into modules. Guarded by test/pilot-css-order.test.ts.
import { PathwayBoundaryDrawer } from "./pilot/PathwayBoundaryDrawer"; // DetailDrawer
import { QuantitiesPanel } from "./pilot/QuantitiesPanel"; // DecisionTrace
import { ResultsPanel } from "./pilot/ResultsPanel"; // PilotDecisionVisuals
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
  formatPilotResultAnnouncement,
  getPilotResultSignature,
  type PilotInputDraft,
  type PilotNumericField
} from "../data/pilotInputDraft";
import { getPilotFragmentTargetId } from "../data/pilotFragmentScroll";
import { type PilotStrategyPreset } from "../data/planningScenarioDefaults";
import { AssumptionsForm } from "./pilot/AssumptionsForm";
import { CompareStrategiesPanel } from "./pilot/CompareStrategiesPanel";
import { ContextPanel } from "./pilot/ContextPanel";
import { DecisionInspector } from "./pilot/DecisionInspector";
import { BOTTOM_TABS, EXTRA_FIELDS, type BottomTab } from "./pilot/pilotConfig";
import "./PilotPage.css";

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
  const [inspectorOpen, setInspectorOpen] = useState(false);
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
          <p>Adjust reach, capacity, and costs to see what the pilot would require under your assumptions. These calculations cannot predict effectiveness or savings.</p>
        </header>
        <div className="atlas-page-top-actions">
          <button
            type="button"
            className="button secondary"
            aria-expanded={inspectorOpen}
            aria-controls={inspectorOpen ? "pilot-decision-inspector" : undefined}
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
        <AssumptionsForm
          scenario={scenario}
          draft={draft}
          evaluation={evaluation}
          showExtraFields={showExtraFields}
          updateDraft={updateDraft}
          applyPreset={applyPreset}
          onToggleMore={() => setMoreOpen(open => !open)}
        />

        {/* Region 2: Applied Calculations & Visuals */}
        <ResultsPanel
          scenario={scenario}
          scenarioResult={scenarioResult}
          invalidDraft={invalidDraft}
          resultAnnouncement={resultAnnouncement}
        />

        {/* Region 3: Collapsible Contextual Decision Inspector */}
        {inspectorOpen && (
          <DecisionInspector
            scenario={scenario}
            scenarioResult={scenarioResult}
            invalidDraft={invalidDraft}
            pilotLocalContext={pilotLocalContext}
            currentOperationalDataRequests={currentOperationalDataRequests}
            bundle={bundle}
            advisorAvailable={advisorAvailable}
          />
        )}
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

          {bottomTab === "compare" && (
            <CompareStrategiesPanel scenario={scenario} applyPreset={applyPreset} />
          )}

          {bottomTab === "quantities" && (
            <QuantitiesPanel
              scenario={scenario}
              scenarioResult={scenarioResult}
              burdenEstimateCount={burdenEstimateCount}
              pilotLocalContext={pilotLocalContext}
              localContextStatus={localContextStatus}
              currentOperationalDataRequests={currentOperationalDataRequests}
              bundle={bundle}
            />
          )}

          {bottomTab === "context" && (
            <ContextPanel
              pilotLocalContext={pilotLocalContext}
              currentOperationalDataRequests={currentOperationalDataRequests}
              clearPilotLocalContext={clearPilotLocalContext}
            />
          )}
        </div>
      </div>

      <PathwayBoundaryDrawer
        open={boundaryOpen}
        scenario={scenario}
        onClose={() => setBoundaryOpen(false)}
      />
    </section>
  );
}
