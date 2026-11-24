import { formatPlanningNumber } from "../data/planningNumberFormatting.ts";
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
  const metric =
    field === "alternative_window_months" ? "difference_person_months" : "capacity_gap";
  const metricLabel =
    field === "alternative_window_months"
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
    setRequestAnnouncement(
      requestStatus === "stale"
        ? "Data request refreshed for the applied scenario. Its Brief selection has not been changed."
        : "Data request created and preselected for the Brief. Review or deselect it in Data Requests."
    );
  };

  return (
    <section id="sensitivity" className="sensitivity-visual" aria-labelledby="sensitivity-title">
      <div className="sensitivity-heading">
        <div>
          <p className="visual-kicker">ONE-WAY SENSITIVITY</p>
          <h3 id="sensitivity-title">Lever sensitivity · {metricLabel}</h3>
        </div>
        <label className="sensitivity-control">
          <span className="sr-only">Test assumption</span>
          <select
            aria-label="Test assumption"
            value={field}
            onChange={event => {
              setField(event.target.value as SensitivityField);
              setRequestAnnouncement("");
            }}
          >
            {(Object.keys(fieldLabels) as SensitivityField[]).map(key => (
              <option key={key} value={key}>
                {fieldLabels[key]}
              </option>
            ))}
          </select>
        </label>
      </div>

      {error ? (
        <p className="field-error" role="status">
          {error}
        </p>
      ) : (
        <>
          <div className="sensitivity-bars">
            {points.map(point => {
              const output = point.result[metric];
              const width = getSensitivityBarWidth(output, maxOutput);
              const barW = (width / 100) * 200;
              const isCurrent = point.input_value === currentValue;
              return (
                <div className={`sensitivity-row${isCurrent ? " current" : ""}`} key={point.input_value}>
                  <span className="sensitivity-input">
                    {formatSensitivityInput(field, point.input_value)}
                    {isCurrent ? <small>applied</small> : null}
                  </span>
                  <svg className="sensitivity-svg" viewBox="0 0 200 10" aria-hidden="true" preserveAspectRatio="none">
                    <rect className="sens-track" x="0" y="2" width="200" height="6" rx="3" />
                    {barW > 0 && (
                      <rect
                        className={`sens-fill${isCurrent ? " is-current" : ""}`}
                        x="0"
                        y="2"
                        width={barW}
                        height="6"
                        rx="3"
                      />
                    )}
                  </svg>
                  <strong className="mono-value">{formatPlanningNumber(output, integer)}</strong>
                </div>
              );
            })}
          </div>

          <details className="visual-table-disclosure">
            <summary>View sensitivity values as a table</summary>
            <div
              className="sensitivity-table-scroll"
              role="region"
              aria-label="Sensitivity values table, horizontally scrollable when needed"
              tabIndex={0}
            >
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
        <div className={`sensitivity-action${requestAnnouncement ? " request-acknowledged" : ""}`}>
          <div>
            <strong>
              {requestStatus === "stale"
                ? "Request stale for applied scenario"
                : requestStatus === "current"
                  ? "Request active in Brief"
                  : "Flag operational uncertainty"}
            </strong>
            <span className="micro-caption">New requests start selected in Brief</span>
          </div>
          <div className="sensitivity-action-controls">
            <button
              className="button secondary"
              type="button"
              aria-disabled={requestStatus === "current"}
              onClick={handleRequest}
            >
              {requestStatus === "current"
                ? "Request current"
                : requestStatus === "stale"
                  ? "Refresh data request"
                  : "Add to data requests"}
            </button>
            {requestStatus === "current" && (
              <Link className="text-button" to="/data-requests">
                Review data request
              </Link>
            )}
          </div>
          <span className="sr-only" aria-live="polite" aria-atomic="true">
            {requestAnnouncement}
          </span>
        </div>
      )}
    </section>
  );
}
