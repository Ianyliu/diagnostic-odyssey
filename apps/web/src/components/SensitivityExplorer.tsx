import { formatPlanningNumber } from "../data/planningNumberFormatting.ts";
import { buildCapacityThresholdCurve } from "../data/capacityThresholdCurve.ts";
import "./SensitivityExplorer.css";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type { Scenario } from "@diagnostic-odyssey/contracts";
import {
  evaluateScenarioSensitivity,
  type SensitivityField
} from "../data/decisionVisuals";
import {
  formatSensitivityInput,
  getSensitivityBarWidth
} from "../data/sensitivityPresentation";

const integer = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

const fieldLabels: Record<SensitivityField, string> = {
  reach: "Intended reach",
  capacity: "Program capacity",
  alternative_window_months: "Planning recognition window"
};

export function SensitivityExplorer({
  scenario,
  onUpsertDataRequest,
  dataRequestStatus
}: {
  scenario: Scenario;
  onUpsertDataRequest?: (field: SensitivityField) => void;
  dataRequestStatus?: (field: SensitivityField) => "absent" | "current" | "stale";
}) {
  const [field, setField] = useState<SensitivityField>("capacity");
  const [requestAnnouncement, setRequestAnnouncement] = useState("");
  const { points, error } = useMemo(() => evaluateScenarioSensitivity(scenario, field), [scenario, field]);
  const thresholdCurve = useMemo(
    () => (field === "capacity" ? buildCapacityThresholdCurve(scenario) : null),
    [scenario, field]
  );
  const metric = field === "alternative_window_months"
    ? "difference_person_months"
    : "capacity_gap";
  const metricLabel = field === "alternative_window_months"
    ? "Difference in person-month exposure"
    : "Capacity gap";
  const outputs = points.map(point => point.result[metric]);
  const maxOutput = Math.max(...outputs, 0);
  const currentValue = scenario[field];
  const requestStatus = dataRequestStatus?.(field) ?? "absent";

  const handleRequest = () => {
    if (error) return;
    if (!onUpsertDataRequest || requestStatus === "current") return;
    onUpsertDataRequest(field);
    setRequestAnnouncement(requestStatus === "stale"
      ? "Data request refreshed for the applied scenario. Its Brief selection has not been changed."
      : "Data request created and preselected for the Brief. Review or deselect it in Data Requests.");
  };

  return (
    <section id="sensitivity" className="sensitivity-visual" aria-labelledby="sensitivity-title">
      <div className="sensitivity-heading">
        <div>
          <p className="visual-kicker">ONE-WAY SENSITIVITY</p>
          <h3 id="sensitivity-title">Test one assumption at a time</h3>
        </div>
        <label className="sensitivity-control">
          <span>Test assumption</span>
          <select
            value={field}
            onChange={event => {
              setField(event.target.value as SensitivityField);
              setRequestAnnouncement("");
            }}
          >
            {(Object.keys(fieldLabels) as SensitivityField[]).map(key => (
              <option key={key} value={key}>{fieldLabels[key]}</option>
            ))}
          </select>
        </label>
      </div>
      <p className="micro-caption">Mechanical test range · other inputs fixed · not evidence-derived.</p>
      {error ? <p className="field-error" role="status">{error}</p> : (
        <>
          <div className="sensitivity-metric"><strong>Outcome:</strong> {metricLabel}</div>
          <div className="sensitivity-bars">
            {points.map(point => {
              const output = point.result[metric];
              const width = getSensitivityBarWidth(output, maxOutput);
              const isCurrent = point.input_value === currentValue;
              return (
                <div className={`sensitivity-row ${isCurrent ? "current" : ""}`} key={point.input_value}>
                  <span className="sensitivity-input">
                    {formatSensitivityInput(field, point.input_value)}
                    {isCurrent ? <small>active</small> : null}
                  </span>
                  <svg className="sensitivity-svg" viewBox="0 0 1000 12" preserveAspectRatio="none" aria-hidden="true">
                    <rect x="0" y="0" width="1000" height="12" rx="6" className="sensitivity-svg-track" />
                    <rect x="0" y="0" width={width * 10} height="12" rx="6" className="sensitivity-svg-fill" />
                  </svg>
                  <strong>{formatPlanningNumber(output, integer)}</strong>
                </div>
              );
            })}
          </div>
          <details className="visual-table-disclosure">
            <summary>View sensitivity values as a table</summary>
            <div className="sensitivity-table-scroll" role="region" aria-label="Sensitivity values table, horizontally scrollable when needed" tabIndex={0}>
              <table className="visual-data-table">
                <caption>Mechanical one-way sensitivity values for {fieldLabels[field]}; the tested range is not evidence-derived.</caption>
                <thead>
                  <tr>
                    <th scope="col">{fieldLabels[field]}</th>
                    <th scope="col">{metricLabel}</th>
                    <th scope="col">Reached participants</th>
                  </tr>
                </thead>
                <tbody>
                  {points.map(point => (
                    <tr key={point.input_value}>
                      <th scope="row">{formatSensitivityInput(field, point.input_value)}</th>
                      <td>{formatPlanningNumber(point.result[metric], integer)}</td>
                      <td>{formatPlanningNumber(point.result.reached_participants, integer)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </>
      )}
      {!error && onUpsertDataRequest && (
        <div className={"sensitivity-action" + (requestAnnouncement ? " request-acknowledged" : "")}>
          <div>
            <strong>
              {requestStatus === "stale"
                ? "Scenario changed since request creation."
                : requestStatus === "current"
                  ? "Request current for this scenario."
                  : "Uncertain locally?"}
            </strong>
            <span>
              {requestStatus === "stale"
                ? "Refresh before exporting in the Brief."
                : requestStatus === "current"
                  ? "Adjust Brief selection in Data Requests."
                  : "Create a structured data request. New requests start selected in the Brief."}
            </span>
          </div>
          <div className="sensitivity-action-controls">
            <button
              className="button secondary"
              type="button"
              aria-disabled={requestStatus === "current"}
              onClick={handleRequest}
            >
              {requestStatus === "current" ? "Request current" : requestStatus === "stale" ? "Refresh data request" : "Add to data requests"}
            </button>
            {requestStatus === "current" && <Link className="text-button" to="/data-requests">Review data request</Link>}
          </div>
          <span className="sr-only" aria-live="polite" aria-atomic="true">{requestAnnouncement}</span>
        </div>
      )}
      {!error && thresholdCurve ? (() => {
        const padL = 44;
        const padR = 16;
        const padT = 16;
        const padB = 26;
        const plotW = 420 - padL - padR;
        const plotH = 148 - padT - padB;
        const xAt = (cap: number) =>
          padL + (thresholdCurve.maxCapacity > 0 ? (cap / thresholdCurve.maxCapacity) * plotW : 0);
        const yAt = (val: number) =>
          padT + plotH - (thresholdCurve.maxY > 0 ? (val / thresholdCurve.maxY) * plotH : 0);
        const reachedPolyline = thresholdCurve.points
          .map(point => `${xAt(point.capacity).toFixed(1)},${yAt(point.reachedParticipants).toFixed(1)}`)
          .join(" ");
        const gapPolyline = thresholdCurve.points
          .map(point => `${xAt(point.capacity).toFixed(1)},${yAt(point.capacityGap).toFixed(1)}`)
          .join(" ");
        const breakEvenX = xAt(thresholdCurve.breakEvenCapacity);
        const activeX = xAt(thresholdCurve.currentCapacity);
        const activeReachedY = yAt(thresholdCurve.currentReached);

        return (
          <figure className="capacity-threshold-figure">
            <div className="threshold-header">
              <strong>Capacity sufficiency threshold</strong>
              <span>Break-even: {formatPlanningNumber(thresholdCurve.breakEvenCapacity, integer)} slots</span>
            </div>
            <svg
              className="capacity-threshold-svg"
              viewBox="0 0 420 148"
              role="img"
              aria-label={`Capacity sufficiency threshold curve. At ${formatPlanningNumber(thresholdCurve.currentCapacity, integer)} configured slots, reached participants is ${formatPlanningNumber(thresholdCurve.currentReached, integer)} and capacity gap is ${formatPlanningNumber(thresholdCurve.currentGap, integer)}. Break-even occurs at ${formatPlanningNumber(thresholdCurve.breakEvenCapacity, integer)} slots.`}
            >
              <line x1={padL} y1={padT} x2={padL} y2={padT + plotH} className="threshold-axis" />
              <line x1={padL} y1={padT + plotH} x2={padL + plotW} y2={padT + plotH} className="threshold-axis" />
              <line
                x1={breakEvenX}
                y1={padT}
                x2={breakEvenX}
                y2={padT + plotH}
                className="threshold-breakeven-line"
              />
              <polyline points={gapPolyline} className="threshold-gap-path" />
              <polyline points={reachedPolyline} className="threshold-reached-path" />
              <circle cx={activeX} cy={activeReachedY} r="4.5" className="threshold-current-dot" />
              <text x={padL - 6} y={padT + 4} textAnchor="end" className="threshold-svg-label">
                {formatPlanningNumber(thresholdCurve.maxY, integer)}
              </text>
              <text x={padL - 6} y={padT + plotH} textAnchor="end" className="threshold-svg-label">
                0
              </text>
              <text x={padL} y={padT + plotH + 16} textAnchor="start" className="threshold-svg-label">
                0 slots
              </text>
              <text x={padL + plotW} y={padT + plotH + 16} textAnchor="end" className="threshold-svg-label">
                {formatPlanningNumber(thresholdCurve.maxCapacity, integer)} slots
              </text>
            </svg>
            <figcaption className="threshold-legend">
              <span><i className="threshold-swatch is-reached" aria-hidden="true" />Reached participants</span>
              <span><i className="threshold-swatch is-gap" aria-hidden="true" />Capacity gap</span>
              <span><i className="threshold-swatch is-breakeven" aria-hidden="true" />Break-even threshold</span>
              <span>Active capacity: {formatPlanningNumber(thresholdCurve.currentCapacity, integer)} slots</span>
            </figcaption>
            <details className="visual-table-disclosure">
              <summary>Threshold curve summary values</summary>
              <dl className="threshold-summary-list">
                <div>
                  <dt>Intended reach (break-even)</dt>
                  <dd>{formatPlanningNumber(thresholdCurve.breakEvenCapacity, integer)} slots</dd>
                </div>
                <div>
                  <dt>Active capacity</dt>
                  <dd>{formatPlanningNumber(thresholdCurve.currentCapacity, integer)} slots</dd>
                </div>
                <div>
                  <dt>Active reached participants</dt>
                  <dd>{formatPlanningNumber(thresholdCurve.currentReached, integer)}</dd>
                </div>
                <div>
                  <dt>Active capacity gap</dt>
                  <dd>{formatPlanningNumber(thresholdCurve.currentGap, integer)}</dd>
                </div>
              </dl>
            </details>
          </figure>
        );
      })() : null}
    </section>
  );
}
