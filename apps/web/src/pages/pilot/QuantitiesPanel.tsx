import type { ArtifactBundle, DataRequest, LocalContextRecord, Scenario, ScenarioResult } from "@diagnostic-odyssey/contracts";
import { DecisionTrace } from "../../components/DecisionTrace";
import { formatPlanningCurrency, formatPlanningNumber } from "../../data/planningNumberFormatting.ts";
import { renderPlanningText, resultNumber } from "./pilotFormat";

export function QuantitiesPanel({
  scenario,
  scenarioResult,
  burdenEstimateCount,
  pilotLocalContext,
  localContextStatus,
  currentOperationalDataRequests,
  bundle
}: {
  scenario: Scenario;
  scenarioResult: ScenarioResult;
  burdenEstimateCount: number;
  pilotLocalContext: LocalContextRecord | null;
  localContextStatus: "loading" | "loaded" | "error";
  currentOperationalDataRequests: DataRequest[];
  bundle: ArtifactBundle | null;
}) {
  return (
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
  );
}
