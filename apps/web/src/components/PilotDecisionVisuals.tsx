import "./PilotDecisionVisuals.css";
import type { Scenario, ScenarioResult } from "@diagnostic-odyssey/contracts";
import { getCapacityCoveragePresentation } from "../data/pilotDecisionPresentation";

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
  const fixedShare = resourceTotal > 0
    ? clampPercent((result.fixed_program_cost / resourceTotal) * 100)
    : 0;
  const variableShare = resourceTotal > 0
    ? clampPercent((result.variable_program_cost / resourceTotal) * 100)
    : 0;

  return <div className="pilot-visual-stack">
    <section className="decision-visual" aria-labelledby="capacity-coverage-title">
      <div className="decision-visual-heading">
        <div>
          <p className="visual-kicker">FEASIBILITY</p>
          <h3 id="capacity-coverage-title">Capacity coverage</h3>
        </div>
        <strong className="visual-headline">{capacityCoverage.headline}</strong>
      </div>
      <div
        className="capacity-track"
        role="img"
        aria-label={capacityCoverage.ariaLabel}
      >
        <span
          className="capacity-fill"
          style={{width: `${capacityCoverage.coveragePercent ?? 0}%`}}
        />
      </div>
      <div className="visual-stat-row">
        <span><strong>{integer.format(result.reached_participants)}</strong> within capacity</span>
        <span><strong>{integer.format(result.capacity_gap)}</strong> capacity gap</span>
      </div>
      {capacityCoverage.noDemandCopy && <p className="visual-note"><strong>{capacityCoverage.noDemandCopy}</strong></p>}
      <p className="visual-note">This compares analyst-entered reach and capacity assumptions. It is not an observed access rate or forecast.</p>
    </section>

    <section className="decision-visual" aria-labelledby="recognition-window-title">
      <div className="decision-visual-heading">
        <div>
          <p className="visual-kicker">TARGETED PATHWAY ASSUMPTION</p>
          <h3 id="recognition-window-title">Recognition-window comparison</h3>
        </div>
        <strong className="visual-headline">{scenario.baseline_window_months - scenario.alternative_window_months} mo</strong>
      </div>
      <div className="window-bars">
        <div className="window-row">
          <span>Baseline assumption</span>
          <div className="window-track" aria-hidden="true"><span className="window-bar baseline" style={{width: `${baselineWidth}%`}} /></div>
          <strong>{scenario.baseline_window_months} mo</strong>
        </div>
        <div className="window-row">
          <span>Planning assumption</span>
          <div className="window-track" aria-hidden="true"><span className="window-bar planning" style={{width: `${planningWidth}%`}} /></div>
          <strong>{scenario.alternative_window_months} mo</strong>
        </div>
      </div>
      <p className="visual-note">The difference is a scenario assumption tied to <strong>{scenario.target_pathway_step}</strong>; it is not an observed program effect.</p>
    </section>

    <section className="decision-visual" aria-labelledby="resource-composition-title">
      <div className="decision-visual-heading">
        <div>
          <p className="visual-kicker">PROGRAM INPUT</p>
          <h3 id="resource-composition-title">Resource requirement composition</h3>
        </div>
        <strong className="visual-headline">{currency.format(resourceTotal)}</strong>
      </div>
      <div
        className="resource-track"
        role="img"
        aria-label={`Program-resource requirement ${currency.format(resourceTotal)}: fixed ${currency.format(result.fixed_program_cost)}, participant-dependent ${currency.format(result.variable_program_cost)}.`}
      >
        <span className="resource-fixed" style={{width: `${fixedShare}%`}} />
        <span className="resource-variable" style={{width: `${variableShare}%`}} />
      </div>
      <div className="resource-legend">
        <span><i className="legend-swatch fixed" aria-hidden="true" />Fixed {currency.format(result.fixed_program_cost)}</span>
        <span><i className="legend-swatch variable" aria-hidden="true" />Participant-dependent {currency.format(result.variable_program_cost)}</span>
      </div>
      <p className="visual-note">Resource requirement is a planning input, not savings, ROI, or attributable cost.</p>
    </section>
  </div>;
}
