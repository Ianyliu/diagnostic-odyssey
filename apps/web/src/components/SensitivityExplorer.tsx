import "./SensitivityExplorer.css";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type { Scenario } from "@diagnostic-odyssey/contracts";
import { oneWaySensitivity } from "@diagnostic-odyssey/scenario-engine";
import {
  buildSensitivityValues,
  type SensitivityField
} from "../data/decisionVisuals";
import {
  formatSensitivityInput,
  getSensitivityBarWidth
} from "../data/sensitivityPresentation";

const integer = new Intl.NumberFormat("en-US", {maximumFractionDigits: 0});

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
  const values = useMemo(() => buildSensitivityValues(scenario, field), [scenario, field]);
  const points = useMemo(() => oneWaySensitivity(scenario, field, values), [scenario, field, values]);
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
    if (!onUpsertDataRequest || requestStatus === "current") return;
    onUpsertDataRequest(field);
    setRequestAnnouncement(requestStatus === "stale"
      ? "Data request refreshed for the applied scenario. Review its Brief selection separately."
      : "Data request created. Review it in Data Requests; Brief inclusion is a separate choice.");
  };

  return <section id="sensitivity" className="sensitivity-visual" aria-labelledby="sensitivity-title">
    <div className="sensitivity-heading">
      <div>
        <p className="visual-kicker">ONE-WAY SENSITIVITY</p>
        <h3 id="sensitivity-title">What changes when one assumption moves?</h3>
      </div>
      <label className="sensitivity-control">
        <span>Test assumption</span>
        <select value={field} onChange={event => {
          setField(event.target.value as SensitivityField);
          setRequestAnnouncement("");
        }}>
          {(Object.keys(fieldLabels) as SensitivityField[]).map(key =>
            <option key={key} value={key}>{fieldLabels[key]}</option>
          )}
        </select>
      </label>
    </div>
    <p className="visual-note">Mechanical test range around the current analyst assumption; the range is not evidence-derived. All other inputs stay fixed.</p>
    <div className="sensitivity-metric"><strong>Outcome shown:</strong> {metricLabel}</div>
    <div className="sensitivity-bars">
      {points.map((point, index) => {
        const output = outputs[index] ?? 0;
        const width = getSensitivityBarWidth(output, maxOutput);
        const isCurrent = Math.abs(point.input_value - currentValue) < 1e-9;
        return <div className={`sensitivity-row ${isCurrent ? "current" : ""}`} key={point.input_value}>
          <span className="sensitivity-input">{formatSensitivityInput(field, point.input_value)}{isCurrent ? <small>applied assumption</small> : null}</span>
          <div className="sensitivity-track" aria-hidden="true">
            <span className="sensitivity-fill" style={{width: `${width}%`}} />
          </div>
          <strong>{integer.format(output)}</strong>
        </div>;
      })}
    </div>
    <details className="visual-table-disclosure">
      <summary>View sensitivity values as a table</summary>
      <div className="sensitivity-table-scroll" role="region" aria-label="Sensitivity values table, horizontally scrollable when needed" tabIndex={0}>
        <table className="visual-data-table">
          <caption>Mechanical one-way sensitivity values for {fieldLabels[field]}; the tested range is not evidence-derived.</caption>
          <thead><tr><th scope="col">{fieldLabels[field]}</th><th scope="col">{metricLabel}</th><th scope="col">Reached participants</th></tr></thead>
          <tbody>{points.map(point => <tr key={point.input_value}>
            <th scope="row">{formatSensitivityInput(field, point.input_value)}</th>
            <td>{integer.format(point.result[metric])}</td>
            <td>{integer.format(point.result.reached_participants)}</td>
          </tr>)}</tbody>
        </table>
      </div>
    </details>
    {onUpsertDataRequest && <div className="sensitivity-action">
      <div>
        <strong>{requestStatus === "stale"
          ? "Scenario changed since this request was created."
          : requestStatus === "current"
            ? "Request current for this applied scenario."
            : "Uncertain locally?"}</strong>
        <span>
          {requestStatus === "stale"
            ? "Refresh explicitly before this request can be exported in the Planning Brief."
            : requestStatus === "current"
              ? "Review the request and decide separately whether to include it in the Planning Brief."
              : "Create a structured operational data request. Creating it does not automatically include it in the Planning Brief."}
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
    </div>}
  </section>;
}
