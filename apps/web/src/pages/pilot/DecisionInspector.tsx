import { Link } from "react-router-dom";
import type { ArtifactBundle, DataRequest, LocalContextRecord, Scenario, ScenarioResult } from "@diagnostic-odyssey/contracts";
import { formatLocalContextValue } from "../../data/formatLocalContextValue";
import { formatPlanningCurrency, formatPlanningNumber } from "../../data/planningNumberFormatting.ts";
import { resultNumber } from "./pilotFormat";

export function DecisionInspector({
  scenario,
  scenarioResult,
  invalidDraft,
  pilotLocalContext,
  currentOperationalDataRequests,
  bundle,
  advisorAvailable
}: {
  scenario: Scenario;
  scenarioResult: ScenarioResult;
  invalidDraft: boolean;
  pilotLocalContext: LocalContextRecord | null;
  currentOperationalDataRequests: DataRequest[];
  bundle: ArtifactBundle | null;
  advisorAvailable: boolean;
}) {
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
}
