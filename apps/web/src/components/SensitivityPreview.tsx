import { useMemo } from "react";
import type { Scenario } from "@diagnostic-odyssey/contracts";
import { evaluateScenarioSensitivity } from "../data/decisionVisuals";
import { formatPlanningNumber } from "../data/planningNumberFormatting";
import { getSensitivityBarWidth } from "../data/sensitivityPresentation";

const numbers = new Intl.NumberFormat("en-US");

/** A smaller view of the existing deterministic explorer, never a new model. */
export function SensitivityPreview({ scenario, paused }: { scenario: Scenario; paused: boolean }) {
  const { points, error } = useMemo(() => evaluateScenarioSensitivity(scenario, "capacity"), [scenario]);
  const preview = points.filter((point, index) => index === 0 || point.input_value === scenario.capacity || index === points.length - 1);
  const maximum = Math.max(0, ...preview.map(point => point.result.capacity_gap));

  return (
    <section className="sensitivity-preview" aria-labelledby="sensitivity-preview-title">
      <h3 id="sensitivity-preview-title">Capacity sensitivity</h3>
      {paused ? (
        <p className="subtle">Fix draft inputs to preview sensitivity.</p>
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
                <svg className="preview-gap-svg" viewBox="0 0 1000 10" preserveAspectRatio="none" aria-hidden="true">
                  <rect x="0" y="0" width="1000" height="10" rx="5" className="preview-svg-track" />
                  <rect x="0" y="0" width={width * 10} height="10" rx="5" className="preview-svg-fill" />
                </svg>
                <strong>{formatPlanningNumber(point.result.capacity_gap, numbers)} gap</strong>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
