import { useMemo } from "react";
import type { Scenario } from "@diagnostic-odyssey/contracts";
import { evaluateScenarioSensitivity } from "../data/decisionVisuals";
import { formatPlanningNumber } from "../data/planningNumberFormatting";
import { getSensitivityBarWidth } from "../data/sensitivityPresentation";

const numbers = new Intl.NumberFormat("en-US");

/** A smaller view of the existing deterministic explorer, never a new model. */
export function SensitivityPreview({ scenario, paused }: { scenario: Scenario; paused: boolean }) {
  const { points, error } = useMemo(() => evaluateScenarioSensitivity(scenario, "capacity"), [scenario]);
  const preview = points.filter(
    (_point, index) => index === 0 || points[index]!.input_value === scenario.capacity || index === points.length - 1
  );
  const maximum = Math.max(0, ...preview.map(point => point.result.capacity_gap));

  return (
    <section className="sensitivity-preview" aria-labelledby="sensitivity-preview-title">
      <h3 id="sensitivity-preview-title">Capacity sensitivity snapshot</h3>
      {paused ? (
        <p className="subtle">Fix the highlighted draft inputs to explore sensitivity.</p>
      ) : error ? (
        <p className="field-error">{error}</p>
      ) : (
        <ul>
          {preview.map(point => {
            const width = getSensitivityBarWidth(point.result.capacity_gap, maximum);
            return (
              <li key={point.input_value}>
                <span>
                  {formatPlanningNumber(point.input_value, numbers)} cap
                  {point.input_value === scenario.capacity ? " (active)" : ""}
                </span>
                <svg viewBox="0 0 120 8" aria-hidden="true" preserveAspectRatio="none">
                  <rect className="sens-track" x="0" y="1" width="120" height="6" rx="3" />
                  <rect className="sens-fill" x="0" y="1" width={(width / 100) * 120} height="6" rx="3" />
                </svg>
                <strong className="mono-value">{formatPlanningNumber(point.result.capacity_gap, numbers)} gap</strong>
              </li>
            );
          })}
        </ul>
      )}
      <a className="text-button" href="#sensitivity">
        Explore sensitivity →
      </a>
    </section>
  );
}
