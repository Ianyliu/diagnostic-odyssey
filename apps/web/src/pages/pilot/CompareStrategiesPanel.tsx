import type { Scenario } from "@diagnostic-odyssey/contracts";
import { formatPlanningCurrency, formatPlanningNumber, formatPlanningPercent } from "../../data/planningNumberFormatting.ts";
import type { PilotStrategyPreset } from "../../data/planningScenarioDefaults";
import { buildScenarioComparisonRows } from "../../data/scenarioComparison";
import { formatSignedDelta, renderPlanningText, resultNumber } from "./pilotFormat";

export function CompareStrategiesPanel({
  scenario,
  applyPreset
}: {
  scenario: Scenario;
  applyPreset: (preset: PilotStrategyPreset) => void;
}) {
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
}
