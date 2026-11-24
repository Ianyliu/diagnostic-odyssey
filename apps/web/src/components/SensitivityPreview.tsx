import { useMemo } from "react";
import type { Scenario } from "@diagnostic-odyssey/contracts";
import { evaluateScenarioSensitivity } from "../data/decisionVisuals";
import { formatPlanningNumber } from "../data/planningNumberFormatting";
import { getSensitivityBarWidth } from "../data/sensitivityPresentation";

const numbers = new Intl.NumberFormat("en-US");

/** Compact preview of deterministic sensitivity, zero inline styles. */
export function SensitivityPreview({scenario, paused}: {scenario: Scenario; paused: boolean}) {
  const {points, error} = useMemo(() => evaluateScenarioSensitivity(scenario, "capacity"), [scenario]);
  const preview = points.filter((_point, index) => index === 0 || points[index]?.input_value === scenario.capacity || index === points.length - 1);
  const maximum = Math.max(0, ...preview.map(point => point.result.capacity_gap));
  const W = 180;

  return (
    <section className="sensitivity-preview" aria-labelledby="sensitivity-preview-title">
      <h3 id="sensitivity-preview-title">Capacity sensitivity</h3>
      {paused ? <p className="subtle">Fix inputs to view sensitivity.</p>
        : error ? <p className="field-error">{error}</p>
          : (
            <ul>
              {preview.map(point => {
                const fillW = (getSensitivityBarWidth(point.result.capacity_gap, maximum) / 100) * W;
                return (
                  <li key={point.input_value}>
                    <span className="mono-figure">{formatPlanningNumber(point.input_value, numbers)}{point.input_value === scenario.capacity ? " (active)" : ""}</span>
                    <svg className="preview-gap-svg" viewBox={`0 0 ${W} 10`} aria-hidden="true" preserveAspectRatio="none">
                      <rect x={0} y={0} width={W} height={10} rx={5} className="sv-track" />
                      <rect x={0} y={0} width={fillW} height={10} rx={5} className="sv-fill" />
                    </svg>
                    <strong className="mono-figure">{formatPlanningNumber(point.result.capacity_gap, numbers)} gap</strong>
                  </li>
                );
              })}
            </ul>
          )}
    </section>
  );
}
