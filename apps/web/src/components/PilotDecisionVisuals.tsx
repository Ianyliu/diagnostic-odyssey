import { formatPlanningCurrency, formatPlanningNumber } from "../data/planningNumberFormatting.ts";
import "./PilotDecisionVisuals.css";
import type { Scenario, ScenarioResult } from "@diagnostic-odyssey/contracts";
import {
  formatRecognitionWindowDifference,
  getCapacityCoveragePresentation
} from "../data/pilotDecisionPresentation";
import { formatPathwayStepLabel } from "../data/pathwayBoundary";

const integer = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0
});

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, value));
}

export function PilotDecisionVisuals({
  scenario,
  result
}: {
  scenario: Scenario;
  result: ScenarioResult;
}) {
  const capacityCoverage = getCapacityCoveragePresentation(result);
  const windowScale = Math.max(
    scenario.baseline_window_months,
    scenario.alternative_window_months,
    1
  );
  const baselineWidth = clampPercent((scenario.baseline_window_months / windowScale) * 100);
  const planningWidth = clampPercent((scenario.alternative_window_months / windowScale) * 100);
  const resourceTotal = result.program_resource_requirement;
  const resourceLabel = formatPlanningCurrency(resourceTotal, currency);
  const scientificResource = resourceLabel.includes("e+");
  const fixedShare =
    resourceTotal > 0 ? clampPercent((result.fixed_program_cost / resourceTotal) * 100) : 0;
  const variableShare =
    resourceTotal > 0 ? clampPercent((result.variable_program_cost / resourceTotal) * 100) : 0;

  const coverageW = ((capacityCoverage.coveragePercent ?? 0) / 100) * 300;
  const baselineW = (baselineWidth / 100) * 240;
  const planningW = (planningWidth / 100) * 240;
  const fixedW = (fixedShare / 100) * 300;
  const variableW = (variableShare / 100) * 300;

  return (
    <div className="pilot-visual-stack">
      <section className="decision-visual" aria-labelledby="capacity-coverage-title">
        <div className="decision-visual-heading">
          <div>
            <p className="visual-kicker">CAPACITY COVERAGE</p>
            <h3 id="capacity-coverage-title">Intended reach inside capacity</h3>
          </div>
          <strong className="visual-headline">{capacityCoverage.headline}</strong>
        </div>

        <svg
          className="pilot-meter-svg"
          viewBox="0 0 300 14"
          role="img"
          aria-label={capacityCoverage.ariaLabel}
          preserveAspectRatio="none"
        >
          <rect className="pm-track" x="0" y="3" width="300" height="8" rx="4" />
          <rect
            className={`pm-fill${result.capacity_gap > 0 ? " has-gap" : ""}`}
            x="0"
            y="3"
            width={Math.max(0, coverageW)}
            height="8"
            rx="4"
          />
        </svg>

        <div className="visual-stat-row">
          <span>
            <strong>{formatPlanningNumber(result.reached_participants, integer)}</strong> served
          </span>
          <span>
            <strong>{formatPlanningNumber(result.capacity_gap, integer)}</strong> bottleneck gap
          </span>
        </div>
        {capacityCoverage.noDemandCopy && (
          <p className="micro-caption">{capacityCoverage.noDemandCopy}</p>
        )}
      </section>

      <section className="decision-visual" aria-labelledby="recognition-window-title">
        <div className="decision-visual-heading">
          <div>
            <p className="visual-kicker">{formatPathwayStepLabel(scenario.target_pathway_step)}</p>
            <h3 id="recognition-window-title">Recognition window delta</h3>
          </div>
          <strong className="visual-headline visual-headline-compact">
            {formatRecognitionWindowDifference(
              scenario.baseline_window_months,
              scenario.alternative_window_months
            )}{" "}
            mo
          </strong>
        </div>

        <div className="window-bars">
          <div className="window-row">
            <span>Baseline</span>
            <svg className="window-svg" viewBox="0 0 240 10" aria-hidden="true" preserveAspectRatio="none">
              <rect className="pm-track" x="0" y="2" width="240" height="6" rx="3" />
              <rect className="pm-baseline" x="0" y="2" width={Math.max(2, baselineW)} height="6" rx="3" />
            </svg>
            <strong className="mono-value">{scenario.baseline_window_months} mo</strong>
          </div>
          <div className="window-row">
            <span>Target</span>
            <svg className="window-svg" viewBox="0 0 240 10" aria-hidden="true" preserveAspectRatio="none">
              <rect className="pm-track" x="0" y="2" width="240" height="6" rx="3" />
              <rect className="pm-planning" x="0" y="2" width={Math.max(2, planningW)} height="6" rx="3" />
            </svg>
            <strong className="mono-value">{scenario.alternative_window_months} mo</strong>
          </div>
        </div>
      </section>

      <section className="decision-visual" aria-labelledby="resource-composition-title">
        <div
          className={`decision-visual-heading${
            scientificResource ? " decision-visual-heading-scientific" : ""
          }`}
        >
          <div>
            <p className="visual-kicker">RESOURCE COMPOSITION</p>
            <h3 id="resource-composition-title">Fixed vs participant-dependent</h3>
          </div>
          <strong
            className={`visual-headline${
              scientificResource ? " visual-headline-scientific" : ""
            }`}
          >
            {resourceLabel}
          </strong>
        </div>

        <svg
          className="pilot-meter-svg"
          viewBox="0 0 300 14"
          role="img"
          aria-label={`Program-resource requirement ${formatPlanningCurrency(
            resourceTotal,
            currency
          )}: fixed ${formatPlanningCurrency(
            result.fixed_program_cost,
            currency
          )}, participant-dependent ${formatPlanningCurrency(
            result.variable_program_cost,
            currency
          )}.`}
          preserveAspectRatio="none"
        >
          <rect className="pm-track" x="0" y="3" width="300" height="8" rx="4" />
          <rect className="pm-fixed" x="0" y="3" width={Math.max(0, fixedW)} height="8" rx="4" />
          <rect
            className="pm-variable"
            x={fixedW}
            y="3"
            width={Math.max(0, variableW)}
            height="8"
            rx="4"
          />
        </svg>

        <div className="resource-legend">
          <span>
            <i className="legend-swatch fixed" aria-hidden="true" />
            Fixed {formatPlanningCurrency(result.fixed_program_cost, currency)}
          </span>
          <span>
            <i className="legend-swatch variable" aria-hidden="true" />
            Variable {formatPlanningCurrency(result.variable_program_cost, currency)}
          </span>
        </div>
      </section>
    </div>
  );
}
