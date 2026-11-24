import { useState } from "react";
import { Link } from "react-router-dom";
import type { LocalContextRecord } from "@diagnostic-odyssey/contracts";
import { DetailDrawer } from "../components/DetailDrawer";
import { HpsaRuralComposition } from "../components/HpsaRuralComposition";
import { MetricVisual } from "../components/MetricVisual";
import { useArtifact } from "../data/ArtifactContext";
import { formatLocalContextValue } from "../data/formatLocalContextValue";
import { isSelectableLocalContextRecord } from "../data/localContextSelection";
import {
  formatLocalContextUncertaintyType,
  formatPublishedLocalContextUncertainty,
  getLocalContextSelectionAccessibility
} from "../data/localContextPresentation";
import { formatDataStateLabel, formatReleaseStatusLabel } from "../data/presentationLabels";
import "./Ledger.css";

interface TerrainTileProps {
  kicker: string;
  record: LocalContextRecord;
  selected: boolean;
  pilotSelected: boolean;
  onSelectedChange: (indicatorId: string, selected: boolean) => void;
  onPilotSelect: (indicatorId: string) => void;
  onPilotClear: () => void;
  onInspect: (record: LocalContextRecord) => void;
  displayLabel?: string | undefined;
}

function TerrainTile({
  kicker,
  record,
  selected,
  pilotSelected,
  onSelectedChange,
  onPilotSelect,
  onPilotClear,
  onInspect,
  displayLabel
}: TerrainTileProps) {
  const selectable = isSelectableLocalContextRecord(record);
  const accessibility = getLocalContextSelectionAccessibility(record, displayLabel);

  return (
    <article className={`atlas-terrain-tile${selected ? " is-selected" : ""}${pilotSelected ? " is-pilot" : ""}`}>
      <div className="atlas-terrain-tile-top">
        <span className="visual-kicker">{kicker}</span>
        <button
          type="button"
          className="atlas-detail-trigger"
          onClick={() => onInspect(record)}
        >
          Provenance ↗
        </button>
      </div>

      <h3 id={accessibility.titleId}>{accessibility.displayTitle}</h3>
      {accessibility.disambiguatorId && (
        <span id={accessibility.disambiguatorId} className="sr-only">{record.label}</span>
      )}

      <div className="atlas-terrain-figure">
        <strong>{formatLocalContextValue(record)}</strong>
        <span>{record.source_agency}</span>
      </div>

      {selectable && typeof record.value === "number" && (
        <MetricVisual
          label={accessibility.displayTitle}
          value={record.value}
          unit={record.unit}
          low={record.margin_of_error === null ? null : record.value - record.margin_of_error}
          high={record.margin_of_error === null ? null : record.value + record.margin_of_error}
          intervalLabel={
            record.margin_of_error === null
              ? null
              : `${record.confidence_level === null ? "" : `${(record.confidence_level * 100).toFixed(0)}% `}margin`
          }
          compact
        />
      )}

      <div className="atlas-terrain-controls">
        <label className="atlas-toggle-pill" htmlFor={accessibility.controlId}>
          <input
            id={accessibility.controlId}
            type="checkbox"
            aria-labelledby={accessibility.labelledBy}
            checked={selected}
            disabled={!selectable}
            onChange={event => onSelectedChange(record.indicator_id, event.target.checked)}
          />
          <span id={accessibility.actionLabelId}>Include in Brief</span>
        </label>

        {pilotSelected ? (
          <button
            type="button"
            className="atlas-pilot-pill is-active"
            aria-label={`Remove ${record.label} from Simulate`}
            onClick={onPilotClear}
          >
            Active in Simulate ×
          </button>
        ) : (
          <button
            type="button"
            className="atlas-pilot-pill"
            disabled={!selectable}
            aria-label={`Use ${record.label} in Simulate`}
            onClick={() => onPilotSelect(record.indicator_id)}
          >
            Use in Simulate
          </button>
        )}
      </div>
    </article>
  );
}

export function LocalContextPage() {
  const {
    bundle,
    localContext,
    localContextStatus,
    localContextError,
    selectedLocalContextIds,
    setLocalContextSelected,
    selectAllLocalContext,
    clearSelectedLocalContext,
    pilotLocalContextId,
    setPilotLocalContext,
    clearPilotLocalContext
  } = useArtifact();
  const [inspectRecord, setInspectRecord] = useState<LocalContextRecord | null>(null);
  const [showBreakdowns, setShowBreakdowns] = useState(false);

  if (!bundle) return null;

  if (localContextStatus === "loading") {
    return (
      <section className="page page-stack">
        <header className="page-heading">
          <p className="eyebrow">02 · LOCAL TERRAIN</p>
          <h1>West Virginia access terrain</h1>
          <p>Loading reviewed state indicators…</p>
        </header>
      </section>
    );
  }

  if (localContextStatus === "error" || !localContext) {
    return (
      <section className="page page-stack">
        <header className="page-heading">
          <p className="eyebrow">02 · LOCAL TERRAIN</p>
          <h1>West Virginia access terrain</h1>
          <p>Local context unavailable; missing does not mean zero constraint.</p>
        </header>
        <div className="empty-state" role="alert">
          <strong>Local indicators unavailable.</strong>
          <p>{localContextError ?? "Reviewed local context could not be loaded."}</p>
        </div>
      </section>
    );
  }

  const indicators = localContext.indicators;
  const byId = new Map(indicators.map(record => [record.indicator_id, record]));

  const primaryCount = byId.get("wv.hrsa.primary-care.designated-distinct-count")!;
  const mentalCount = byId.get("wv.hrsa.mental-health.designated-distinct-count")!;
  const uninsured = byId.get("wv.acs.uninsured_pct")!;
  const broadband = byId.get("wv.acs.broadband_pct")!;
  const transit = byId.get("wv.acs.no_vehicle_pct")!;
  const poverty = byId.get("wv.acs.poverty_pct")!;

  const primaryBreakdowns = indicators.filter(
    record => record.source_ref === "hrsa-hpsa-primary-care-current" && record.indicator_id !== primaryCount.indicator_id
  );
  const mentalBreakdowns = indicators.filter(
    record => record.source_ref === "hrsa-hpsa-mental-health-current" && record.indicator_id !== mentalCount.indicator_id
  );

  const featuredTiles: Array<{ kicker: string; record: LocalContextRecord }> = [
    { kicker: "PRIMARY CARE", record: primaryCount },
    { kicker: "MENTAL HEALTH", record: mentalCount },
    { kicker: "UNINSURED", record: uninsured },
    { kicker: "BROADBAND", record: broadband },
    { kicker: "TRANSIT", record: transit },
    { kicker: "POVERTY", record: poverty }
  ];

  const eligibleCount = indicators.filter(isSelectableLocalContextRecord).length;
  const selectedCount = selectedLocalContextIds.length;

  return (
    <section className="page page-stack local-ledger-page">
      <div className="atlas-page-top">
        <header className="page-heading">
          <p className="eyebrow">02 · LOCAL TERRAIN · EDITION 01</p>
          <h1>West Virginia access terrain</h1>
          <p>HRSA shortages &amp; 2024 Census ACS · Access conditions, not prevalence.</p>
        </header>

        <div className="atlas-selection-bar" id="local-selection-summary">
          <span className="status status-selection">{selectedCount} in Brief</span>
          <button
            type="button"
            className="button secondary"
            onClick={selectAllLocalContext}
            disabled={selectedCount === eligibleCount}
          >
            Select all
          </button>
          <button
            type="button"
            className="button secondary"
            onClick={clearSelectedLocalContext}
            disabled={selectedCount === 0}
          >
            Clear
          </button>
        </div>
      </div>

      <div className="atlas-terrain-grid">
        {featuredTiles.map(({ kicker, record }) => (
          <TerrainTile
            key={record.indicator_id}
            kicker={kicker}
            record={record}
            selected={selectedLocalContextIds.includes(record.indicator_id)}
            pilotSelected={pilotLocalContextId === record.indicator_id}
            onSelectedChange={setLocalContextSelected}
            onPilotSelect={setPilotLocalContext}
            onPilotClear={clearPilotLocalContext}
            onInspect={setInspectRecord}
          />
        ))}
      </div>

      <div className="atlas-composition-grid">
        <div className="card">
          <HpsaRuralComposition records={primaryBreakdowns} serviceLabel="Primary Care" />
        </div>
        <div className="card">
          <HpsaRuralComposition records={mentalBreakdowns} serviceLabel="Mental Health" />
        </div>
      </div>

      <div className="card atlas-breakdowns-card">
        <div className="card-title-row">
          <div>
            <h2>All {indicators.length} state indicators</h2>
            <p className="micro-caption">Designations and Census rates · never rescaled to prevalence.</p>
          </div>
          <button
            type="button"
            className="button secondary"
            onClick={() => setShowBreakdowns(open => !open)}
            aria-expanded={showBreakdowns}
          >
            {showBreakdowns ? "Hide full list" : "Browse all indicators"}
          </button>
        </div>

        {showBreakdowns && (
          <div className="atlas-terrain-grid atlas-terrain-subgrid">
            {[...primaryBreakdowns, ...mentalBreakdowns].map(record => (
              <TerrainTile
                key={record.indicator_id}
                kicker={record.source_ref.includes("mental") ? "MENTAL HEALTH" : "PRIMARY CARE"}
                record={record}
                displayLabel={record.indicator_id.endsWith(".max-score") ? "Maximum source-published HPSA score" : undefined}
                selected={selectedLocalContextIds.includes(record.indicator_id)}
                pilotSelected={pilotLocalContextId === record.indicator_id}
                onSelectedChange={setLocalContextSelected}
                onPilotSelect={setPilotLocalContext}
                onPilotClear={clearPilotLocalContext}
                onInspect={setInspectRecord}
              />
            ))}
          </div>
        )}
      </div>

      <div className="atlas-soon-strip" aria-label="Upcoming geographic editions">
        <span className="edition-pill is-soon">Coming soon</span>
        <strong>Additional States &amp; Counties</strong>
        <span>West Virginia figures are never borrowed or rescaled across states.</span>
      </div>

      <div className="atlas-page-footer-bar">
        <Link className="text-button" to="/brief">
          View selected terrain in Brief →
        </Link>
        <Link className="button" to="/pilot">
          Continue to Simulate →
        </Link>
      </div>

      <DetailDrawer
        open={inspectRecord !== null}
        eyebrow="LOCAL TERRAIN · PROVENANCE"
        title={inspectRecord?.label ?? ""}
        onClose={() => setInspectRecord(null)}
      >
        {inspectRecord && (
          <>
            <div className="atlas-drawer-stat">
              <strong>{formatLocalContextValue(inspectRecord)}</strong>
              <span>{inspectRecord.source_agency} · {inspectRecord.source_release_vintage}</span>
            </div>
            <dl className="atlas-drawer-list">
              <div>
                <dt>Geography &amp; universe</dt>
                <dd>{inspectRecord.geography_name} ({inspectRecord.geography_type}) · {inspectRecord.universe}</dd>
              </div>
              <div>
                <dt>Source locator</dt>
                <dd>{inspectRecord.source_locator}</dd>
              </div>
              <div>
                <dt>Published uncertainty</dt>
                <dd>
                  {formatLocalContextUncertaintyType(inspectRecord.uncertainty_type)} ·{" "}
                  {inspectRecord.margin_of_error === null
                    ? "Not published"
                    : formatPublishedLocalContextUncertainty(inspectRecord)}
                </dd>
              </div>
              <div>
                <dt>Allowed use</dt>
                <dd>{inspectRecord.allowed_interpretation}</dd>
              </div>
              <div>
                <dt>Not supported</dt>
                <dd>{inspectRecord.prohibited_interpretation.join("; ")}</dd>
              </div>
              <div>
                <dt>Limitations</dt>
                <dd>{inspectRecord.limitations.join(" ")}</dd>
              </div>
              <div>
                <dt>Release / state</dt>
                <dd>{formatReleaseStatusLabel(inspectRecord.release_status)} · {formatDataStateLabel(inspectRecord.state)}</dd>
              </div>
            </dl>
          </>
        )}
      </DetailDrawer>
    </section>
  );
}
