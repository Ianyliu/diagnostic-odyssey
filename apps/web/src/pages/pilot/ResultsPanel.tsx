import { Link } from "react-router-dom";
import type { Scenario, ScenarioResult } from "@diagnostic-odyssey/contracts";
import { PilotDecisionVisuals } from "../../components/PilotDecisionVisuals";
import { formatPlanningCurrency, formatPlanningNumber } from "../../data/planningNumberFormatting.ts";
import { renderPlanningText, resultNumber } from "./pilotFormat";

export function ResultsPanel({
  scenario,
  scenarioResult,
  invalidDraft,
  resultAnnouncement
}: {
  scenario: Scenario;
  scenarioResult: ScenarioResult;
  invalidDraft: boolean;
  resultAnnouncement: string;
}) {
  return (
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
  );
}
