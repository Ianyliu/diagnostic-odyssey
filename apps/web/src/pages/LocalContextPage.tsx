import { Link } from "react-router-dom";
import type { LocalContextRecord } from "@diagnostic-odyssey/contracts";
import { ContextBar } from "../components/ContextBar";
import { useArtifact } from "../data/ArtifactContext";
import { formatLocalContextValue } from "../data/formatLocalContextValue";
import { isSelectableLocalContextRecord } from "../data/localContextSelection";

function IndicatorDisclosure({record}: {record: LocalContextRecord}) {
  return <details>
    <summary>Source, universe, and interpretation boundary</summary>
    <p><strong>Source:</strong> {record.source_agency} · {record.source_ref}</p>
    <p><strong>Vintage:</strong> {record.source_release_vintage}</p>
    <p><strong>Observation as of:</strong> {record.observation_as_of_date ?? "Missing / not available"}</p>
    <p><strong>Geography:</strong> {record.geography_name} ({record.geography_type})</p>
    <p><strong>Universe:</strong> {record.universe}</p>
    <p><strong>Unit:</strong> {record.unit}</p>
    <p><strong>Published margin of error:</strong> {record.margin_of_error === null ? "Not applicable / not published" : record.margin_of_error} {record.margin_of_error === null ? "" : "at native confidence level " + String(record.confidence_level)}</p>
    <p><strong>Allowed use:</strong> {record.allowed_interpretation}</p>
    <p><strong>Not supported:</strong> {record.prohibited_interpretation.join("; ")}</p>
    <p><strong>Limitations:</strong> {record.limitations.join(" ")}</p>
    <p><strong>Release/data state:</strong> {record.release_status} / {record.state}</p>
  </details>;
}

function SelectableIndicatorRow({
  record,
  selected,
  onSelectedChange,
  displayLabel
}: {
  record: LocalContextRecord;
  selected: boolean;
  onSelectedChange: (indicatorId: string, selected: boolean) => void;
  displayLabel?: string;
}) {
  const selectable = isSelectableLocalContextRecord(record);
  const controlId = "select-local-context-" + record.indicator_id.replace(/[^a-zA-Z0-9_-]/g, "-");

  return <div className="measure">
    <div>
      <strong>{displayLabel ?? record.label}</strong>
      <span>{record.universe}</span>
      <label className="selection-control" htmlFor={controlId}>
        <input
          id={controlId}
          type="checkbox"
          checked={selected}
          disabled={!selectable}
          onChange={event => onSelectedChange(record.indicator_id, event.target.checked)}
        />
        <span>Include in Planning Brief</span>
      </label>
    </div>
    <div className="measure-value">
      {formatLocalContextValue(record)}
      <small>{record.release_status} · {record.state}</small>
    </div>
  </div>;
}

function BreakdownList({
  records,
  selectedIds,
  onSelectedChange
}: {
  records: LocalContextRecord[];
  selectedIds: string[];
  onSelectedChange: (indicatorId: string, selected: boolean) => void;
}) {
  return <div>
    {records.map(record =>
      <SelectableIndicatorRow
        key={record.indicator_id}
        record={record}
        selected={selectedIds.includes(record.indicator_id)}
        onSelectedChange={onSelectedChange}
      />
    )}
  </div>;
}

export function LocalContextPage() {
  const {
    bundle,
    localContext,
    localContextStatus,
    localContextError,
    selectedLocalContextIds,
    setLocalContextSelected,
    clearSelectedLocalContext
  } = useArtifact();
  if (!bundle) return null;

  if (localContextStatus === "loading") {
    return <section className="page page-stack">
      <ContextBar />
      <header className="page-heading">
        <h1>Local implementation context</h1>
        <p>Reviewed state context is loading independently from national burden.</p>
      </header>
      <div className="state-card" role="status">
        <strong>Loading reviewed local context…</strong>
        <span>National MEPS burden remains available and unchanged.</span>
      </div>
    </section>;
  }

  if (localContextStatus === "error" || !localContext) {
    return <section className="page page-stack">
      <ContextBar />
      <header className="page-heading">
        <h1>Local implementation context</h1>
        <p>Local implementation evidence is a separate runtime layer from national burden.</p>
      </header>
      <div className="empty-state" role="alert">
        <strong>Reviewed local implementation context is unavailable.</strong>
        <p>{localContextError ?? "The reviewed local-context artifact could not be loaded."}</p>
        <p>National MEPS burden, Pilot Planner, and Planning Brief remain usable. No fixture or illustrative local data are substituted.</p>
      </div>
      <div className="guardrail">
        <strong>Missing local data is not zero constraint.</strong>
        <p>Missing designation/data does not mean no shortage or no implementation constraint.</p>
      </div>
    </section>;
  }

  const indicators = localContext.indicators;
  const primaryCount = indicators.find(record =>
    record.indicator_id === "wv.hrsa.primary-care.designated-distinct-count"
  )!;
  const primaryScore = indicators.find(record =>
    record.indicator_id === "wv.hrsa.primary-care.max-score"
  )!;
  const mentalCount = indicators.find(record =>
    record.indicator_id === "wv.hrsa.mental-health.designated-distinct-count"
  )!;
  const mentalScore = indicators.find(record =>
    record.indicator_id === "wv.hrsa.mental-health.max-score"
  )!;

  const primaryBreakdowns = indicators.filter(record =>
    record.source_ref === "hrsa-hpsa-primary-care-current" &&
    record.indicator_id !== primaryCount.indicator_id &&
    record.indicator_id !== primaryScore.indicator_id
  );
  const mentalBreakdowns = indicators.filter(record =>
    record.source_ref === "hrsa-hpsa-mental-health-current" &&
    record.indicator_id !== mentalCount.indicator_id &&
    record.indicator_id !== mentalScore.indicator_id
  );
  const acsRecords = [
    "wv.acs.uninsured_pct",
    "wv.acs.no_vehicle_pct",
    "wv.acs.broadband_pct",
    "wv.acs.poverty_pct"
  ].map(indicatorId => indicators.find(record => record.indicator_id === indicatorId)!);

  const primarySource = localContext.sources.find(source =>
    source.source_ref === "hrsa-hpsa-primary-care-current"
  );
  const acsSource = localContext.sources.find(source =>
    source.source_ref === "acs-2024-5year-profile"
  );

  const selectedCount = selectedLocalContextIds.length;

  return <section className="page page-stack">
    <ContextBar />
    <header className="page-heading">
      <p className="eyebrow">REVIEWED IMPLEMENTATION CONTEXT</p>
      <h1>West Virginia statewide implementation constraints</h1>
      <p>What statewide implementation constraints are documented, and what can they legitimately be used for?</p>
    </header>

    <div className="guardrail">
      <strong>Separate evidence layer — not a West Virginia burden estimate.</strong>
      <p>This state context may inform implementation/access planning. It does not change national MEPS burden and is not West Virginia Long COVID prevalence, West Virginia Long COVID cost, a causal effect modifier, a calibrated access severity score, savings, or ROI.</p>
      <p>Missing designation/data does not mean no shortage or zero constraint.</p>
    </div>

    <div className="guardrail">
      <strong>Planning Brief selection boundary</strong>
      <p>Selecting an indicator includes its reviewed value, source, geography, vintage, uncertainty, and interpretation boundaries in the Planning Brief. It does not change national burden or Pilot Planner assumptions.</p>
    </div>

    <div className="card selection-summary" aria-live="polite">
      <div>
        <strong>{selectedCount} {selectedCount === 1 ? "indicator" : "indicators"} selected for Planning Brief</strong>
        <p className="subtle">Only explicit selections from the currently loaded reviewed artifact are eligible.</p>
      </div>
      <div className="selection-actions">
        {selectedCount > 0 && <Link className="button" to="/brief">Review selected context in Planning Brief</Link>}
        {selectedCount > 0 && <button className="button secondary" type="button" onClick={clearSelectedLocalContext}>Clear selections</button>}
      </div>
    </div>

    <div className="guardrail">
      <strong>Source/vintage boundary</strong>
      <p><strong>HRSA:</strong> {primarySource?.source_release_vintage ?? "Current HPSA snapshot retrieved 2026-09-24"}.</p>
      <p><strong>ACS:</strong> {acsSource?.source_release_vintage ?? "2020–2024 ACS 5-year estimates / 2024 release"}.</p>
      <p>These sources have different time bases and should not be interpreted as one common observation year.</p>
    </div>

    <article className="card">
      <h2>A. Primary Care HPSA context</h2>
      <p className="subtle">{primaryCount.source_agency} · {primaryCount.source_release_vintage}</p>
      <SelectableIndicatorRow
        record={primaryCount}
        selected={selectedLocalContextIds.includes(primaryCount.indicator_id)}
        onSelectedChange={setLocalContextSelected}
      />
      <SelectableIndicatorRow
        record={primaryScore}
        selected={selectedLocalContextIds.includes(primaryScore.indicator_id)}
        onSelectedChange={setLocalContextSelected}
        displayLabel="Maximum source-published HPSA score among included designations"
      />
      <p className="limitations">The maximum score is a maximum across included individual designations; it is not a statewide shortage severity score.</p>
      <details>
        <summary>Designation-type and rural-status breakdowns</summary>
        <BreakdownList
          records={primaryBreakdowns}
          selectedIds={selectedLocalContextIds}
          onSelectedChange={setLocalContextSelected}
        />
      </details>
      <IndicatorDisclosure record={primaryCount} />
    </article>

    <article className="card">
      <h2>B. Mental Health HPSA context</h2>
      <p className="subtle">{mentalCount.source_agency} · {mentalCount.source_release_vintage}</p>
      <SelectableIndicatorRow
        record={mentalCount}
        selected={selectedLocalContextIds.includes(mentalCount.indicator_id)}
        onSelectedChange={setLocalContextSelected}
      />
      <SelectableIndicatorRow
        record={mentalScore}
        selected={selectedLocalContextIds.includes(mentalScore.indicator_id)}
        onSelectedChange={setLocalContextSelected}
        displayLabel="Maximum source-published HPSA score among included designations"
      />
      <p className="limitations">The maximum score is a maximum across included individual designations; it is not a statewide shortage severity score.</p>
      <details>
        <summary>Designation-type and rural-status breakdowns</summary>
        <BreakdownList
          records={mentalBreakdowns}
          selectedIds={selectedLocalContextIds}
          onSelectedChange={setLocalContextSelected}
        />
      </details>
      <IndicatorDisclosure record={mentalCount} />
    </article>

    <article className="card">
      <h2>C. ACS implementation/access context</h2>
      <p className="subtle">U.S. Census Bureau · 2020–2024 ACS 5-year estimates / 2024 release. Native 90% margins of error are preserved.</p>
      {acsRecords.map(record => <div key={record.indicator_id}>
        <SelectableIndicatorRow
          record={record}
          selected={selectedLocalContextIds.includes(record.indicator_id)}
          onSelectedChange={setLocalContextSelected}
        />
        <p className="subtle">{record.source_agency} · {record.source_release_vintage} · {record.uncertainty_type} · confidence level {record.confidence_level}</p>
        <IndicatorDisclosure record={record} />
      </div>)}
    </article>
  </section>;
}
