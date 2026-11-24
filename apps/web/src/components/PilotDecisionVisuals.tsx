import { formatPlanningCurrency, formatPlanningNumber } from "../data/planningNumberFormatting.ts";
import "./PilotDecisionVisuals.css";
import type { Scenario, ScenarioResult } from "@diagnostic-odyssey/contracts";
import {
  formatRecognitionWindowDifference,
  getCapacityCoveragePresentation
} from "../data/pilotDecisionPresentation";
import { formatPathwayStepLabel } from "../data/pathwayBoundary";

const integer = new Intl.NumberFormat("en-US", {maximumFractionDigits: 0});
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
  const fixedShare = resourceTotal > 0
    ? clampPercent((result.fixed_program_cost / resourceTotal) * 100)
    : 0;
  const variableShare = resourceTotal > 0
    ? clampPercent((result.variable_program_cost / resourceTotal) * 100)
    : 0;

  const W = 320;
  const capacityW = ((capacityCoverage.coveragePercent ?? 0) / 100) * W;
  const baselineW = (baselineWidth / 100) * W;
  const planningW = (planningWidth / 100) * W;
  const fixedW = (fixedShare / 100) * W;
  const variableW = (variableShare / 100) * W;

  return (
    <div className="pilot-visual-stack">
      <section className="decision-visual" aria-labelledby="capacity-coverage-title">
        <div className="decision-visual-heading">
          <div>
            <p className="visual-kicker">FEASIBILITY</p>
            <h3 id="capacity-coverage-title">Capacity coverage</h3>
          </div>
          <strong className="visual-headline">{capacityCoverage.headline}</strong>
        </div>
        <svg
          className="decision-svg-bar"
          viewBox={`0 0 ${W} 12`}
          role="img"
          aria-label={capacityCoverage.ariaLabel}
          preserveAspectRatio="none"
        >
          <rect x={0} y={0} width={W} height={12} rx={6} className="dv-track" />
          <rect x={0} y={0} width={capacityW} height={12} rx={6} className="dv-fill-primary" />
        </svg>
        <div className="visual-stat-row">
          <span><strong className="mono-figure">{formatPlanningNumber(result.reached_participants, integer)}</strong> within capacity</span>
          <span><strong className="mono-figure">{formatPlanningNumber(result.capacity_gap, integer)}</strong> gap</span>
        </div>
        {capacityCoverage.noDemandCopy && <p className="micro-caption"><strong>{capacityCoverage.noDemandCopy}</strong></p>}
        <p className="micro-caption">Planning math · Not observed access</p>
      </section>

      <section className="decision-visual" aria-labelledby="recognition-window-title">
        <div className="decision-visual-heading">
          <div>
            <p className="visual-kicker">PATHWAY WINDOW</p>
            <h3 id="recognition-window-title">Recognition window</h3>
          </div>
          <strong className="visual-headline visual-headline-compact mono-figure">
            {formatRecognitionWindowDifference(
              scenario.baseline_window_months,
              scenario.alternative_window_months
            )} mo
          </strong>
        </div>
        <div className="window-bars">
          <div className="window-row">
            <span>Baseline</span>
            <svg viewBox={`0 0 ${W} 10`} className="decision-svg-bar-sm" aria-hidden="true" preserveAspectRatio="none">
              <rect x={0} y={0} width={W} height={10} rx={5} className="dv-track" />
              <rect x={0} y={0} width={baselineW} height={10} rx={5} className="dv-fill-muted" />
            </svg>
            <strong className="mono-figure">{scenario.baseline_window_months} mo</strong>
          </div>
          <div className="window-row">
            <span>Planning</span>
            <svg viewBox={`0 0 ${W} 10`} className="decision-svg-bar-sm" aria-hidden="true" preserveAspectRatio="none">
              <rect x={0} y={0} width={W} height={10} rx={5} className="dv-track" />
              <rect x={0} y={0} width={planningW} height={10} rx={5} className="dv-fill-amber" />
            </svg>
            <strong className="mono-figure">{scenario.alternative_window_months} mo</strong>
          </div>
        </div>
        <p className="micro-caption">Targets {formatPathwayStepLabel(scenario.target_pathway_step)} · Not an observed effect</p>
      </section>

      <section className="decision-visual" aria-labelledby="resource-composition-title">
        <div className={`decision-visual-heading${scientificResource ? " decision-visual-heading-scientific" : ""}`}>
          <div>
            <p className="visual-kicker">PROGRAM BUDGET</p>
            <h3 id="resource-composition-title">Resource composition</h3>
          </div>
          <strong className={`visual-headline mono-figure${scientificResource ? " visual-headline-scientific" : ""}`}>{resourceLabel}</strong>
        </div>
        <svg
          className="decision-svg-bar"
          viewBox={`0 0 ${W} 12`}
          role="img"
          aria-label={`Program-resource requirement ${formatPlanningCurrency(resourceTotal, currency)}: fixed ${formatPlanningCurrency(result.fixed_program_cost, currency)}, participant-dependent ${formatPlanningCurrency(result.variable_program_cost, currency)}.`}
          preserveAspectRatio="none"
        >
          <rect x={0} y={0} width={W} height={12} rx={6} className="dv-track" />
          <rect x={0} y={0} width={fixedW} height={12} className="dv-fill-primary" />
          <rect x={fixedW} y={0} width={variableW} height={12} className="dv-fill-amber" />
        </svg>
        <div className="resource-legend">
          <span><i className="legend-swatch fixed" aria-hidden="true" />Fixed <span className="mono-figure">{formatPlanningCurrency(result.fixed_program_cost, currency)}</span></span>
          <span><i className="legend-swatch variable" aria-hidden="true" />Variable <span className="mono-figure">{formatPlanningCurrency(result.variable_program_cost, currency)}</span></span>
        </div>
        <p className="micro-caption">Planning math · Not savings or ROI</p>
      </section>
    </div>
  );
}
