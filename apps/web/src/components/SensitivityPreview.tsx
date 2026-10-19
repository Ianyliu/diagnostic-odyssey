import { useMemo } from "react";
import type { Scenario } from "@diagnostic-odyssey/contracts";
import { evaluateScenarioSensitivity } from "../data/decisionVisuals";
import { formatPlanningNumber } from "../data/planningNumberFormatting";
import { getSensitivityBarWidth } from "../data/sensitivityPresentation";

const numbers = new Intl.NumberFormat("en-US");

/** A smaller view of the existing deterministic explorer, never a new model. */
export function SensitivityPreview({scenario, paused}: {scenario: Scenario; paused: boolean}) {
  const {points, error} = useMemo(() => evaluateScenarioSensitivity(scenario, "capacity"), [scenario]);
  const preview = points.filter((point, index) => index === 0 || point.input_value === scenario.capacity || index === points.length - 1);
  const maximum = Math.max(0, ...preview.map(point => point.result.capacity_gap));
  return <section className="sensitivity-preview" aria-labelledby="sensitivity-preview-title">
    <h3 id="sensitivity-preview-title">How much does capacity matter?</h3>
    <p className="subtle">Vary one assumption; keep the others fixed. This range is assumption testing, not measured effects or a forecast.</p>
    {paused ? <p>Fix the highlighted draft inputs to explore sensitivity.</p>
      : error ? <p className="field-error">{error}</p>
        : <ul>{preview.map(point => <li key={point.input_value}>
          <span>{formatPlanningNumber(point.input_value, numbers)} capacity{point.input_value === scenario.capacity ? " (applied)" : ""}</span>
          <span className="preview-gap-track" aria-hidden="true"><span style={{width: `${getSensitivityBarWidth(point.result.capacity_gap, maximum)}%`}} /></span>
          <strong>{formatPlanningNumber(point.result.capacity_gap, numbers)} gap</strong>
        </li>)}</ul>}
    <a className="text-button" href="#sensitivity">Explore sensitivity →</a>
  </section>;
}
