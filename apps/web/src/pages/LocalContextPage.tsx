import { Link } from "react-router-dom";
import type { LocalContextRecord } from "@diagnostic-odyssey/contracts";
import { ContextBar } from "../components/ContextBar";
import { HpsaRuralComposition } from "../components/HpsaRuralComposition";
import { InterpretationGuide } from "../components/InterpretationGuide";
import { MetricVisual } from "../components/MetricVisual";
import { useArtifact } from "../data/ArtifactContext";
import { formatLocalContextValue } from "../data/formatLocalContextValue";
import { isSelectableLocalContextRecord } from "../data/localContextSelection";
import { formatPublishedLocalContextUncertainty, getLocalContextSelectionAccessibility } from "../data/localContextPresentation";
import { formatDataStateLabel, formatReleaseStatusLabel } from "../data/presentationLabels";
import "./Ledger.css";

function IndicatorDisclosure({record}: {record: LocalContextRecord}) {
  return <details className="technical-disclosure ledger-record-details">
    <summary>Source timing and technical details</summary>
    <p><strong>Source:</strong> {record.source_agency} · {record.source_ref}</p>
    <p><strong>Source locator:</strong> {record.source_locator}</p>
    <p><strong>Vintage:</strong> {record.source_release_vintage}</p>
    <p><strong>Observation as of:</strong> {record.observation_as_of_date ?? "Missing / not available"}</p>
    <p><strong>Geography:</strong> {record.geography_name} ({record.geography_type})</p>
    <p><strong>Universe:</strong> {record.universe}</p>
    <p><strong>Unit:</strong> {record.unit}</p>
    <p><strong>Uncertainty type:</strong> {record.uncertainty_type ?? "Not published"}</p>
    <p><strong>Published margin of error:</strong> {record.margin_of_error === null ? "Not applicable / not published" : formatPublishedLocalContextUncertainty(record)}</p>
    <p><strong>Allowed use:</strong> {record.allowed_interpretation}</p>
    <p><strong>Not supported:</strong> {record.prohibited_interpretation.join("; ")}</p>
    <p><strong>Limitations:</strong> {record.limitations.join(" ")}</p>
    <p><strong>Release/data state:</strong> {formatReleaseStatusLabel(record.release_status)} / {formatDataStateLabel(record.state)}</p>
  </details>;
}

function SelectableIndicatorRow({
  record,
  selected,
  onSelectedChange,
  pilotSelected,
  onPilotSelect,
  onPilotClear,
  displayLabel
}: {
  record: LocalContextRecord;
  selected: boolean;
  onSelectedChange: (indicatorId: string, selected: boolean) => void;
  pilotSelected: boolean;
  onPilotSelect: (indicatorId: string) => void;
  onPilotClear: () => void;
  displayLabel?: string;
}) {
  const selectable = isSelectableLocalContextRecord(record);
  const accessibility = getLocalContextSelectionAccessibility(record, displayLabel);

  return <div className={`measure ledger-indicator-row${selected ? " ledger-row-selected" : ""}${pilotSelected ? " ledger-row-pilot" : ""}`}>
    <div>
      <strong id={accessibility.titleId}>{accessibility.displayTitle}</strong>
      {accessibility.disambiguatorId && <span id={accessibility.disambiguatorId} className="sr-only">{record.label}</span>}
      <span className="ledger-record-universe">{record.universe}</span>
      <label className="selection-control" htmlFor={accessibility.controlId}>
        <input
          id={accessibility.controlId}
          type="checkbox"
          aria-labelledby={accessibility.labelledBy}
          checked={selected}
          disabled={!selectable}
          onChange={event => onSelectedChange(record.indicator_id, event.target.checked)}
        />
        <span id={accessibility.actionLabelId}>Include in Planning Brief</span>
      </label>
      <div className="pilot-context-action">
        {pilotSelected ? <>
          <span className="ledger-pilot-selection">Active Pilot planning context</span>
          <button className="text-button" type="button" aria-label={`Remove ${record.label} from Pilot planning`} onClick={onPilotClear}>Remove from Pilot</button>
        </> : <button
          className="text-button"
          type="button"
          disabled={!selectable}
          aria-label={`Use ${record.label} in Pilot planning`}
          onClick={() => onPilotSelect(record.indicator_id)}
        >
          Use in Pilot planning
        </button>}
      </div>
    </div>
    <div className="measure-value ledger-record-value">
      {formatLocalContextValue(record)}
      {typeof record.value === "number" && <MetricVisual
        label={accessibility.displayTitle}
        value={record.value}
        unit={record.unit}
        low={record.margin_of_error === null ? null : record.value - record.margin_of_error}
        high={record.margin_of_error === null ? null : record.value + record.margin_of_error}
        intervalLabel={record.margin_of_error === null ? null : `${record.confidence_level === null ? "" : `${(record.confidence_level * 100).toFixed(0)}% `}published margin`}
        source={record.source_agency}
        universe={record.universe}
      />}
      <small>{formatReleaseStatusLabel(record.release_status)} · {formatDataStateLabel(record.state)}</small>
    </div>
  </div>;
}

function BreakdownList({
  records,
  selectedIds,
  onSelectedChange,
  pilotContextId,
  onPilotSelect,
  onPilotClear
}: {
  records: LocalContextRecord[];
  selectedIds: string[];
  onSelectedChange: (indicatorId: string, selected: boolean) => void;
  pilotContextId: string | null;
  onPilotSelect: (indicatorId: string) => void;
  onPilotClear: () => void;
}) {
  return <div>
    {records.map(record => <div className="ledger-record-group" key={record.indicator_id}>
      <SelectableIndicatorRow
        record={record}
        selected={selectedIds.includes(record.indicator_id)}
        onSelectedChange={onSelectedChange}
        pilotSelected={pilotContextId === record.indicator_id}
        onPilotSelect={onPilotSelect}
        onPilotClear={onPilotClear}
      />
      <IndicatorDisclosure record={record} />
    </div>)}
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
    clearSelectedLocalContext,
    pilotLocalContextId,
    setPilotLocalContext,
    clearPilotLocalContext
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
        <p>National MEPS burden, Pilot planner, and Planning Brief remain usable. No fixture or illustrative local data are substituted.</p>
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
  const activePilotRecord = indicators.find(record => record.indicator_id === pilotLocalContextId);

  return <section className="page page-stack local-ledger-page">
    <ContextBar />
    <header className="page-heading">
      <p className="eyebrow">REVIEWED IMPLEMENTATION CONTEXT</p>
      <h1>West Virginia statewide implementation constraints</h1>
      <p>What statewide implementation constraints are documented, and what can they legitimately be used for?</p>
    </header>

    <div className="ledger-layout">
      <nav className="ledger-section-nav" aria-label="Local context sections">
        <p className="ledger-index-heading">On this page</p>
        <ol>
          <li><a href="#local-selection-summary">Selections</a></li>
          <li><a href="#local-primary-care">Primary care HPSA</a></li>
          <li><a href="#local-mental-health">Mental health HPSA</a></li>
          <li><a href="#local-acs">ACS access context</a></li>
        </ol>
      </nav>
      <div className="ledger-main">
    <InterpretationGuide
      id="local-context-interpretation"
      headingLevel={2}
      whatThisShows="Statewide implementation and access context from reviewed Health Resources and Services Administration (HRSA) and U.S. Census Bureau sources."
      whyItMatters="These indicators can identify operational constraints that may matter when planning implementation."
      whatItDoesNotShow="West Virginia Long COVID prevalence, burden, cost, causal effect, savings, ROI, or a composite access-severity score."
      whatToDoNext="Choose independently whether a reviewed record should be included in the Planning Brief, used as the one active Pilot planning context, both, or neither."
    />
    <div className="guardrail compact">
      <strong>Missing does not mean zero.</strong>
      <p>Missing designation/data does not mean no shortage or zero implementation constraint. "Include in Planning Brief" and "Use in Pilot planning" are separate analyst choices. Neither changes national burden or Pilot planner numeric assumptions.</p>
    </div>

    <div className="card selection-summary ledger-selection-summary" id="local-selection-summary">
      <div>
        <strong>{selectedCount} {selectedCount === 1 ? "indicator" : "indicators"} explicitly selected by checkbox for Planning Brief</strong>
        <p className="subtle">
          {pilotLocalContextId
            ? "The active Pilot-used context will also appear in the Planning Brief, deduplicated if it is checkbox-selected too."
            : "Only explicit selections from the currently loaded reviewed artifact are eligible."}
        </p>
      </div>
      <div className="selection-actions">
        {(selectedCount > 0 || pilotLocalContextId) && <Link className="button" to="/brief">Review context in Planning Brief</Link>}
        {selectedCount > 0 && <button className="button secondary" type="button" onClick={clearSelectedLocalContext}>Clear selections</button>}
      </div>
    </div>
    <p className="sr-only" role="status" aria-live="polite">
      {selectedCount} {selectedCount === 1 ? "record" : "records"} selected for Planning Brief. {activePilotRecord ? `Pilot context: ${activePilotRecord.label}.` : "No Pilot context selected."}
    </p>

    <details className="technical-disclosure">
      <summary>Source timing and technical details</summary>
      <p><strong>Health Resources and Services Administration (HRSA):</strong> {primarySource?.source_release_vintage ?? "Current HPSA snapshot retrieved 2026-09-24"}.</p>
      <p><strong>American Community Survey (ACS):</strong> {acsSource?.source_release_vintage ?? "2020–2024 ACS 5-year estimates / 2024 release"}.</p>
      <p>These sources have different time bases and should not be interpreted as one common observation year. Record disclosures below retain observation dates, universe, uncertainty, allowed and prohibited interpretation, and limitations.</p>
    </details>

    <article className="card ledger-panel ledger-source-group" id="local-primary-care">
      <h2>A. Primary Care Health Professional Shortage Area (HPSA) context</h2>
      <p className="subtle">{primaryCount.source_agency} · {primaryCount.source_release_vintage}</p>
      <SelectableIndicatorRow
        record={primaryCount}
        selected={selectedLocalContextIds.includes(primaryCount.indicator_id)}
        onSelectedChange={setLocalContextSelected}
        pilotSelected={pilotLocalContextId === primaryCount.indicator_id}
        onPilotSelect={setPilotLocalContext}
        onPilotClear={clearPilotLocalContext}
      />
      <IndicatorDisclosure record={primaryCount} />
      <SelectableIndicatorRow
        record={primaryScore}
        selected={selectedLocalContextIds.includes(primaryScore.indicator_id)}
        onSelectedChange={setLocalContextSelected}
        pilotSelected={pilotLocalContextId === primaryScore.indicator_id}
        onPilotSelect={setPilotLocalContext}
        onPilotClear={clearPilotLocalContext}
        displayLabel="Maximum source-published HPSA score among included designations"
      />
      <p className="limitations">The maximum score is a maximum across included individual designations; it is not a statewide shortage severity score.</p>
      <IndicatorDisclosure record={primaryScore} />
      <details>
        <summary>Designation-type and rural-status breakdowns</summary>
        <HpsaRuralComposition records={primaryBreakdowns} serviceLabel="Primary Care" />
        <BreakdownList
          records={primaryBreakdowns}
          selectedIds={selectedLocalContextIds}
          onSelectedChange={setLocalContextSelected}
          pilotContextId={pilotLocalContextId}
          onPilotSelect={setPilotLocalContext}
          onPilotClear={clearPilotLocalContext}
        />
      </details>
    </article>

    <article className="card ledger-panel ledger-source-group" id="local-mental-health">
      <h2>B. Mental Health HPSA context</h2>
      <p className="subtle">{mentalCount.source_agency} · {mentalCount.source_release_vintage}</p>
      <SelectableIndicatorRow
        record={mentalCount}
        selected={selectedLocalContextIds.includes(mentalCount.indicator_id)}
        onSelectedChange={setLocalContextSelected}
        pilotSelected={pilotLocalContextId === mentalCount.indicator_id}
        onPilotSelect={setPilotLocalContext}
        onPilotClear={clearPilotLocalContext}
      />
      <IndicatorDisclosure record={mentalCount} />
      <SelectableIndicatorRow
        record={mentalScore}
        selected={selectedLocalContextIds.includes(mentalScore.indicator_id)}
        onSelectedChange={setLocalContextSelected}
        pilotSelected={pilotLocalContextId === mentalScore.indicator_id}
        onPilotSelect={setPilotLocalContext}
        onPilotClear={clearPilotLocalContext}
        displayLabel="Maximum source-published HPSA score among included designations"
      />
      <p className="limitations">The maximum score is a maximum across included individual designations; it is not a statewide shortage severity score.</p>
      <IndicatorDisclosure record={mentalScore} />
      <details>
        <summary>Designation-type and rural-status breakdowns</summary>
        <HpsaRuralComposition records={mentalBreakdowns} serviceLabel="Mental Health" />
        <BreakdownList
          records={mentalBreakdowns}
          selectedIds={selectedLocalContextIds}
          onSelectedChange={setLocalContextSelected}
          pilotContextId={pilotLocalContextId}
          onPilotSelect={setPilotLocalContext}
          onPilotClear={clearPilotLocalContext}
        />
      </details>
    </article>

    <article className="card ledger-panel ledger-source-group" id="local-acs">
      <h2>C. American Community Survey (ACS) implementation/access context</h2>
      <p className="subtle">U.S. Census Bureau · 2020–2024 ACS 5-year estimates / 2024 release. Native 90% margins of error are preserved.</p>
      {acsRecords.map(record => <div className="ledger-record-group" key={record.indicator_id}>
        <SelectableIndicatorRow
          record={record}
          selected={selectedLocalContextIds.includes(record.indicator_id)}
          onSelectedChange={setLocalContextSelected}
          pilotSelected={pilotLocalContextId === record.indicator_id}
          onPilotSelect={setPilotLocalContext}
          onPilotClear={clearPilotLocalContext}
        />
        <p className="subtle">{record.source_agency} · {record.source_release_vintage} · {record.confidence_level === null ? "Confidence level not published" : `${(record.confidence_level * 100).toFixed(0)}% confidence level`}</p>
        <IndicatorDisclosure record={record} />
      </div>)}
    </article>
      </div>
    </div>
  </section>;
}
