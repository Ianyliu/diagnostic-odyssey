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
  const coveragePct = clampPercent(capacityCoverage.coveragePercent ?? 0);
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

  // Gauge arc math (semi-circle radius 56, circumference PI*56 = 175.93)
  const radius = 56;
  const halfCircumference = Math.PI * radius;
  const gaugeFilled = (coveragePct / 100) * halfCircumference;

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

        <div className="capacity-gauge-wrap">
          <svg
            className="capacity-gauge-svg"
            viewBox="0 0 140 82"
            role="img"
            aria-label={capacityCoverage.ariaLabel}
          >
            <path
              d="M 14 70 A 56 56 0 0 1 126 70"
              fill="none"
              className="gauge-track"
              strokeWidth="12"
              strokeLinecap="round"
            />
            <path
              d="M 14 70 A 56 56 0 0 1 126 70"
              fill="none"
              className={`gauge-fill${result.capacity_gap > 0 ? " has-gap" : ""}`}
              strokeWidth="12"
              strokeLinecap="round"
              strokeDasharray={`${gaugeFilled} ${halfCircumference}`}
            />
            <text x="70" y="64" textAnchor="middle" className="gauge-value">
              {capacityCoverage.coveragePercent === null ? "N/A" : `${Math.round(coveragePct)}%`}
            </text>
          </svg>
        </div>

        <div className="visual-stat-row">
          <span><strong>{formatPlanningNumber(result.reached_participants, integer)}</strong> served</span>
          <span><strong>{formatPlanningNumber(result.capacity_gap, integer)}</strong> gap</span>
        </div>
        {capacityCoverage.noDemandCopy && <p className="visual-note"><strong>{capacityCoverage.noDemandCopy}</strong></p>}
      </section>

      <section className="decision-visual" aria-labelledby="recognition-window-title">
        <div className="decision-visual-heading">
          <div>
            <p className="visual-kicker">PATHWAY WINDOW</p>
            <h3 id="recognition-window-title">Recognition window</h3>
          </div>
          <strong className="visual-headline visual-headline-compact">
            {formatRecognitionWindowDifference(
              scenario.baseline_window_months,
              scenario.alternative_window_months
            )} mo
          </strong>
        </div>
        <div className="window-bars">
          <div className="window-row">
            <span>Baseline</span>
            <svg className="window-svg" viewBox="0 0 1000 12" preserveAspectRatio="none" aria-hidden="true">
              <rect x="0" y="0" width="1000" height="12" rx="6" className="bar-svg-track" />
              <rect x="0" y="0" width={baselineWidth * 10} height="12" rx="6" className="bar-svg-baseline" />
            </svg>
            <strong>{scenario.baseline_window_months} mo</strong>
          </div>
          <div className="window-row">
            <span>Planning</span>
            <svg className="window-svg" viewBox="0 0 1000 12" preserveAspectRatio="none" aria-hidden="true">
              <rect x="0" y="0" width="1000" height="12" rx="6" className="bar-svg-track" />
              <rect x="0" y="0" width={planningWidth * 10} height="12" rx="6" className="bar-svg-planning" />
            </svg>
            <strong>{scenario.alternative_window_months} mo</strong>
          </div>
        </div>
        <p className="micro-caption">Target: {formatPathwayStepLabel(scenario.target_pathway_step)}</p>
      </section>

      <section className="decision-visual" aria-labelledby="resource-composition-title">
        <div className={`decision-visual-heading${scientificResource ? " decision-visual-heading-scientific" : ""}`}>
          <div>
            <p className="visual-kicker">BUDGET INPUT</p>
            <h3 id="resource-composition-title">Resource split</h3>
          </div>
          <strong className={`visual-headline${scientificResource ? " visual-headline-scientific" : ""}`}>{resourceLabel}</strong>
        </div>
        <svg
          className="resource-svg"
          viewBox="0 0 1000 14"
          preserveAspectRatio="none"
          role="img"
          aria-label={`Program-resource requirement ${formatPlanningCurrency(resourceTotal, currency)}: fixed ${formatPlanningCurrency(result.fixed_program_cost, currency)}, participant-dependent ${formatPlanningCurrency(result.variable_program_cost, currency)}.`}
        >
          <defs>
            <pattern id="pilot-fixed-stripe" width="12" height="14" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <rect width="12" height="14" fill="var(--do-surface)" />
              <path d="M0 0V14" stroke="var(--do-chart-2)" strokeWidth="5" />
            </pattern>
          </defs>
          <rect x="0" y="0" width="1000" height="14" rx="7" className="bar-svg-track" />
          <rect x="0" y="0" width={fixedShare * 10} height="14" fill="url(#pilot-fixed-stripe)" className="bar-svg-fixed" />
          {variableShare > 0 && (
            <rect
              x={fixedShare > 0 ? Math.min(1000, fixedShare * 10 + 4) : 0}
              y="0"
              width={Math.max(0, variableShare * 10 - (fixedShare > 0 ? 4 : 0))}
              height="14"
              className="bar-svg-variable"
            />
          )}
        </svg>
        <div className="resource-legend">
          <span><i className="legend-swatch fixed" aria-hidden="true" />Fixed {formatPlanningCurrency(result.fixed_program_cost, currency)}</span>
          <span><i className="legend-swatch variable" aria-hidden="true" />Variable {formatPlanningCurrency(result.variable_program_cost, currency)}</span>
        </div>
        <p className="micro-caption">
          The resource calculation includes fixed program costs and per-participant costs. It does not independently model the cost of increasing capacity.
        </p>
      </section>
    </div>
  );
}
