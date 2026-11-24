import { useState } from "react";
import { Link } from "react-router-dom";
import type { LocalContextRecord } from "@diagnostic-odyssey/contracts";
import { AppleDetailModal } from "../components/AppleDetailModal";
import { HpsaRuralComposition } from "../components/HpsaRuralComposition";
import { MetricVisual } from "../components/MetricVisual";
import { useArtifact } from "../data/ArtifactContext";
import { COVERAGE_CATALOG, type CoverageCatalogEntry } from "../data/coverageCatalog";
import { formatLocalContextValue } from "../data/formatLocalContextValue";
import { isSelectableLocalContextRecord } from "../data/localContextSelection";
import {
  formatLocalContextUncertaintyType,
  formatPublishedLocalContextUncertainty,
  getLocalContextSelectionAccessibility
} from "../data/localContextPresentation";
import { formatDataStateLabel, formatReleaseStatusLabel } from "../data/presentationLabels";
import "./Ledger.css";

type TerrainFilter = "all" | "primary-care" | "mental-health" | "acs";

function AccessScorecard({
  record,
  selected,
  onSelectedChange,
  pilotSelected,
  onPilotSelect,
  onPilotClear,
  onInspect,
  displayLabel
}: {
  record: LocalContextRecord;
  selected: boolean;
  onSelectedChange: (indicatorId: string, selected: boolean) => void;
  pilotSelected: boolean;
  onPilotSelect: (indicatorId: string) => void;
  onPilotClear: () => void;
  onInspect: (record: LocalContextRecord) => void;
  displayLabel?: string | undefined;
}) {
  const selectable = isSelectableLocalContextRecord(record);
  const accessibility = getLocalContextSelectionAccessibility(record, displayLabel);

  return (
    <article
      className={`apple-card terrain-scorecard${selected ? " is-selected" : ""}${pilotSelected ? " is-pilot" : ""}`}
    >
      <div className="burden-card-top">
        <div className="burden-card-title-group">
          <strong id={accessibility.titleId}>{accessibility.displayTitle}</strong>
          {accessibility.disambiguatorId && (
            <span id={accessibility.disambiguatorId} className="sr-only">{record.label}</span>
          )}
          <span className="subtle">{record.universe}</span>
        </div>
        <button
          type="button"
          className="apple-info-btn"
          aria-label={`Details for ${accessibility.displayTitle}`}
          onClick={() => onInspect(record)}
        >
          i
        </button>
      </div>

      <div className="terrain-score-value mono-figure">
        {formatLocalContextValue(record)}
      </div>

      {selectable && typeof record.value === "number" && (
        <MetricVisual
          label={accessibility.displayTitle}
          value={record.value}
          unit={record.unit}
          low={record.margin_of_error === null ? null : record.value - record.margin_of_error}
          high={record.margin_of_error === null ? null : record.value + record.margin_of_error}
          intervalLabel={record.margin_of_error === null
            ? null
            : `${record.confidence_level === null ? "" : `${(record.confidence_level * 100).toFixed(0)}% `}margin`}
          source={record.source_agency}
        />
      )}

      <div className="terrain-card-controls">
        <label className="ios-switch" htmlFor={accessibility.controlId}>
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

        {pilotSelected ? (
          <div className="terrain-pilot-actions">
            <span className="status status-selection">Active in Pilot</span>
            <button
              className="text-button"
              type="button"
              aria-label={`Remove ${record.label} from Pilot planning`}
              onClick={onPilotClear}
            >
              Remove
            </button>
          </div>
        ) : (
          <button
            className="text-button"
            type="button"
            disabled={!selectable}
            aria-label={`Use ${record.label} in Pilot planning`}
            onClick={() => onPilotSelect(record.indicator_id)}
          >
            Use in Pilot planning
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
    setLocalContextGroupSelected,
    selectAllLocalContext,
    clearSelectedLocalContext,
    pilotLocalContextId,
    setPilotLocalContext,
    clearPilotLocalContext
  } = useArtifact();

  const [filter, setFilter] = useState<TerrainFilter>("all");
  const [inspectingRecord, setInspectingRecord] = useState<LocalContextRecord | null>(null);
  const [inspectingEdition, setInspectingEdition] = useState<CoverageCatalogEntry | null>(null);

  if (!bundle) return null;

  if (localContextStatus === "loading") {
    return (
      <section className="page page-stack">
        <header className="apple-page-header">
          <p className="apple-kicker">Edition 01 · Local Terrain</p>
          <h1>West Virginia access terrain.</h1>
          <p className="apple-subtitle">Loading reviewed state indicators.</p>
        </header>
        <div className="state-card" role="status">
          <strong>Loading local context…</strong>
          <span>National MEPS burden remains unchanged.</span>
        </div>
      </section>
    );
  }

  if (localContextStatus === "error" || !localContext) {
    return (
      <section className="page page-stack">
        <header className="apple-page-header">
          <p className="apple-kicker">Edition 01 · Local Terrain</p>
          <h1>West Virginia access terrain.</h1>
          <p className="apple-subtitle">Separate runtime layer from national burden.</p>
        </header>
        <div className="empty-state" role="alert">
          <strong>Local implementation context is unavailable.</strong>
          <p>{localContextError ?? "The reviewed artifact could not be loaded."}</p>
          <p>National MEPS burden, Simulator, and Brief remain usable. Missing data does not mean zero constraint.</p>
        </div>
      </section>
    );
  }

  const indicators = localContext.indicators;
  const primaryCount = indicators.find(r => r.indicator_id === "wv.hrsa.primary-care.designated-distinct-count")!;
  const primaryScore = indicators.find(r => r.indicator_id === "wv.hrsa.primary-care.max-score")!;
  const mentalCount = indicators.find(r => r.indicator_id === "wv.hrsa.mental-health.designated-distinct-count")!;
  const mentalScore = indicators.find(r => r.indicator_id === "wv.hrsa.mental-health.max-score")!;

  const primaryBreakdowns = indicators.filter(
    r => r.source_ref === "hrsa-hpsa-primary-care-current" && r.indicator_id !== primaryCount.indicator_id && r.indicator_id !== primaryScore.indicator_id
  );
  const mentalBreakdowns = indicators.filter(
    r => r.source_ref === "hrsa-hpsa-mental-health-current" && r.indicator_id !== mentalCount.indicator_id && r.indicator_id !== mentalScore.indicator_id
  );
  const acsRecords = [
    "wv.acs.uninsured_pct",
    "wv.acs.no_vehicle_pct",
    "wv.acs.broadband_pct",
    "wv.acs.poverty_pct"
  ].map(id => indicators.find(r => r.indicator_id === id)!);

  const primaryAll = [primaryCount, primaryScore, ...primaryBreakdowns];
  const mentalAll = [mentalCount, mentalScore, ...mentalBreakdowns];
  const selectableTotal = indicators.filter(isSelectableLocalContextRecord).length;
  const selectedCount = selectedLocalContextIds.length;
  const activePilotRecord = indicators.find(r => r.indicator_id === pilotLocalContextId);
  const moreStatesEntry = COVERAGE_CATALOG.find(entry => entry.id === "additional-geographies") ?? null;

  const primarySource = localContext.sources.find(s => s.source_ref === "hrsa-hpsa-primary-care-current");
  const acsSource = localContext.sources.find(s => s.source_ref === "acs-2024-5year-profile");

  const scoreTitle = (record: LocalContextRecord) =>
    record.indicator_id === primaryScore.indicator_id || record.indicator_id === mentalScore.indicator_id
      ? "Maximum source-published HPSA score among included designations"
      : undefined;

  return (
    <section className="page page-stack local-ledger-page">
      <header className="apple-page-header">
        <p className="apple-kicker">Edition 01 · Local Terrain</p>
        <h1>West Virginia access terrain.</h1>
        <p className="apple-subtitle">
          34 reviewed HRSA and Census ACS implementation indicators.
        </p>
        <p className="micro-caption">Local terrain · Not prevalence</p>
      </header>

      <div className="ledger-toolbar">
        <div className="apple-segmented" role="group" aria-label="Filter local terrain sections">
          {([
            ["all", "All (34)"],
            ["primary-care", "Primary Care"],
            ["mental-health", "Mental Health"],
            ["acs", "Access & Transit"]
          ] as const).map(([id, label]) => (
            <button key={id} type="button" aria-pressed={filter === id} onClick={() => setFilter(id)}>
              {label}
            </button>
          ))}
        </div>

        <div className="terrain-pill-actions">
          {moreStatesEntry && (
            <button
              type="button"
              className="edition-pill"
              onClick={() => setInspectingEdition(moreStatesEntry)}
            >
              <span>More States</span>
              <span className="edition-pill-badge">Soon</span>
            </button>
          )}
        </div>
      </div>

      <div className="apple-card terrain-selection-bar" id="local-selection-summary">
        <div>
          <strong>
            <span className="mono-figure">{selectedCount}</span> {selectedCount === 1 ? "indicator" : "indicators"} included in Brief
          </strong>
          <p className="micro-caption">
            {activePilotRecord ? `Pilot context: ${activePilotRecord.label}` : "Selections never alter national burden or simulator math."}
          </p>
        </div>
        <div className="selection-actions">
          <button
            className="button secondary"
            type="button"
            onClick={selectAllLocalContext}
            disabled={selectedCount === selectableTotal}
          >
            Select all
          </button>
          <button
            className="button secondary"
            type="button"
            onClick={clearSelectedLocalContext}
            disabled={selectedCount === 0}
          >
            Select none
          </button>
          {(selectedCount > 0 || pilotLocalContextId) && (
            <Link className="button" to="/brief">Review in Brief</Link>
          )}
        </div>
      </div>

      <p className="sr-only" role="status" aria-live="polite">
        {selectedCount} {selectedCount === 1 ? "record" : "records"} selected for Planning Brief.{" "}
        {activePilotRecord ? `Pilot context: ${activePilotRecord.label}.` : "No Pilot context selected."}
      </p>

      {(filter === "all" || filter === "primary-care") && (
        <section className="burden-domain-section" id="local-primary-care">
          <div className="burden-section-head">
            <div>
              <h2>Primary care HPSA</h2>
              <p className="subtle">{primaryCount.source_agency} · {primaryCount.source_release_vintage}</p>
            </div>
            <div className="selection-actions">
              <button
                className="text-button"
                type="button"
                onClick={() => setLocalContextGroupSelected(primaryAll.map(r => r.indicator_id), true)}
              >
                Select group
              </button>
              <button
                className="text-button"
                type="button"
                onClick={() => setLocalContextGroupSelected(primaryAll.map(r => r.indicator_id), false)}
              >
                Clear group
              </button>
            </div>
          </div>

          <div className="terrain-score-grid">
            <AccessScorecard
              record={primaryCount}
              selected={selectedLocalContextIds.includes(primaryCount.indicator_id)}
              onSelectedChange={setLocalContextSelected}
              pilotSelected={pilotLocalContextId === primaryCount.indicator_id}
              onPilotSelect={setPilotLocalContext}
              onPilotClear={clearPilotLocalContext}
              onInspect={setInspectingRecord}
            />
            <AccessScorecard
              record={primaryScore}
              selected={selectedLocalContextIds.includes(primaryScore.indicator_id)}
              onSelectedChange={setLocalContextSelected}
              pilotSelected={pilotLocalContextId === primaryScore.indicator_id}
              onPilotSelect={setPilotLocalContext}
              onPilotClear={clearPilotLocalContext}
              onInspect={setInspectingRecord}
              displayLabel={scoreTitle(primaryScore)}
            />
          </div>

          <HpsaRuralComposition records={primaryBreakdowns} serviceLabel="Primary Care" />

          <details className="apple-accordion">
            <summary>All {primaryBreakdowns.length} designation &amp; rural breakdowns</summary>
            <div className="terrain-score-grid terrain-breakdown-grid">
              {primaryBreakdowns.map(record => (
                <AccessScorecard
                  key={record.indicator_id}
                  record={record}
                  selected={selectedLocalContextIds.includes(record.indicator_id)}
                  onSelectedChange={setLocalContextSelected}
                  pilotSelected={pilotLocalContextId === record.indicator_id}
                  onPilotSelect={setPilotLocalContext}
                  onPilotClear={clearPilotLocalContext}
                  onInspect={setInspectingRecord}
                />
              ))}
            </div>
          </details>
        </section>
      )}

      {(filter === "all" || filter === "mental-health") && (
        <section className="burden-domain-section" id="local-mental-health">
          <div className="burden-section-head">
            <div>
              <h2>Mental health HPSA</h2>
              <p className="subtle">{mentalCount.source_agency} · {mentalCount.source_release_vintage}</p>
            </div>
            <div className="selection-actions">
              <button
                className="text-button"
                type="button"
                onClick={() => setLocalContextGroupSelected(mentalAll.map(r => r.indicator_id), true)}
              >
                Select group
              </button>
              <button
                className="text-button"
                type="button"
                onClick={() => setLocalContextGroupSelected(mentalAll.map(r => r.indicator_id), false)}
              >
                Clear group
              </button>
            </div>
          </div>

          <div className="terrain-score-grid">
            <AccessScorecard
              record={mentalCount}
              selected={selectedLocalContextIds.includes(mentalCount.indicator_id)}
              onSelectedChange={setLocalContextSelected}
              pilotSelected={pilotLocalContextId === mentalCount.indicator_id}
              onPilotSelect={setPilotLocalContext}
              onPilotClear={clearPilotLocalContext}
              onInspect={setInspectingRecord}
            />
            <AccessScorecard
              record={mentalScore}
              selected={selectedLocalContextIds.includes(mentalScore.indicator_id)}
              onSelectedChange={setLocalContextSelected}
              pilotSelected={pilotLocalContextId === mentalScore.indicator_id}
              onPilotSelect={setPilotLocalContext}
              onPilotClear={clearPilotLocalContext}
              onInspect={setInspectingRecord}
              displayLabel={scoreTitle(mentalScore)}
            />
          </div>

          <HpsaRuralComposition records={mentalBreakdowns} serviceLabel="Mental Health" />

          <details className="apple-accordion">
            <summary>All {mentalBreakdowns.length} designation &amp; rural breakdowns</summary>
            <div className="terrain-score-grid terrain-breakdown-grid">
              {mentalBreakdowns.map(record => (
                <AccessScorecard
                  key={record.indicator_id}
                  record={record}
                  selected={selectedLocalContextIds.includes(record.indicator_id)}
                  onSelectedChange={setLocalContextSelected}
                  pilotSelected={pilotLocalContextId === record.indicator_id}
                  onPilotSelect={setPilotLocalContext}
                  onPilotClear={clearPilotLocalContext}
                  onInspect={setInspectingRecord}
                />
              ))}
            </div>
          </details>
        </section>
      )}

      {(filter === "all" || filter === "acs") && (
        <section className="burden-domain-section" id="local-acs">
          <div className="burden-section-head">
            <div>
              <h2>Access &amp; transit (ACS)</h2>
              <p className="subtle">U.S. Census Bureau · 2020–2024 5-year estimates (90% MOE)</p>
            </div>
            <div className="selection-actions">
              <button
                className="text-button"
                type="button"
                onClick={() => setLocalContextGroupSelected(acsRecords.map(r => r.indicator_id), true)}
              >
                Select group
              </button>
              <button
                className="text-button"
                type="button"
                onClick={() => setLocalContextGroupSelected(acsRecords.map(r => r.indicator_id), false)}
              >
                Clear group
              </button>
            </div>
          </div>

          <div className="terrain-score-grid">
            {acsRecords.map(record => (
              <AccessScorecard
                key={record.indicator_id}
                record={record}
                selected={selectedLocalContextIds.includes(record.indicator_id)}
                onSelectedChange={setLocalContextSelected}
                pilotSelected={pilotLocalContextId === record.indicator_id}
                onPilotSelect={setPilotLocalContext}
                onPilotClear={clearPilotLocalContext}
                onInspect={setInspectingRecord}
              />
            ))}
          </div>
        </section>
      )}

      <details className="apple-accordion">
        <summary>Source timing &amp; scientific boundaries</summary>
        <p><strong>HRSA:</strong> {primarySource?.source_release_vintage ?? "Current HPSA snapshot retrieved 2026-09-24"}.</p>
        <p><strong>ACS:</strong> {acsSource?.source_release_vintage ?? "2020–2024 ACS 5-year estimates / 2024 release"}.</p>
        <p>
          HPSA counts describe designations, not patients or clinicians. ACS measures describe statewide residents, not Long COVID cases.
          Missing data does not mean zero constraint.
        </p>
      </details>

      <div className="workflow-next">
        <Link className="button" to="/pilot">Continue to Simulate</Link>
        <Link className="button secondary" to="/brief">Review in Brief</Link>
      </div>

      {/* Indicator Detail Modal */}
      <AppleDetailModal
        open={inspectingRecord !== null}
        kicker="West Virginia · Reviewed Local Indicator"
        title={inspectingRecord ? (scoreTitle(inspectingRecord) ?? inspectingRecord.label) : ""}
        onClose={() => setInspectingRecord(null)}
      >
        {inspectingRecord && (
          <dl className="apple-detail-list">
            <div>
              <dt>Source &amp; locator</dt>
              <dd>{inspectingRecord.source_agency} · {inspectingRecord.source_ref} · {inspectingRecord.source_locator}</dd>
            </div>
            <div>
              <dt>Vintage &amp; observation date</dt>
              <dd>{inspectingRecord.source_release_vintage} · {inspectingRecord.observation_as_of_date ?? "Not available"}</dd>
            </div>
            <div>
              <dt>Geography &amp; universe</dt>
              <dd>{inspectingRecord.geography_name} ({inspectingRecord.geography_type}) · {inspectingRecord.universe}</dd>
            </div>
            <div>
              <dt>Uncertainty ({formatLocalContextUncertaintyType(inspectingRecord.uncertainty_type)})</dt>
              <dd>{formatPublishedLocalContextUncertainty(inspectingRecord)}</dd>
            </div>
            <div>
              <dt>Allowed use</dt>
              <dd>{inspectingRecord.allowed_interpretation}</dd>
            </div>
            <div>
              <dt>Not supported</dt>
              <dd>{inspectingRecord.prohibited_interpretation.join("; ")}</dd>
            </div>
            <div>
              <dt>Limitations</dt>
              <dd>{inspectingRecord.limitations.join(" ")}</dd>
            </div>
            <div>
              <dt>Release / state</dt>
              <dd>{formatReleaseStatusLabel(inspectingRecord.release_status)} · {formatDataStateLabel(inspectingRecord.state)}</dd>
            </div>
          </dl>
        )}
      </AppleDetailModal>

      {/* Coming Soon States Modal */}
      <AppleDetailModal
        open={inspectingEdition !== null}
        kicker={inspectingEdition?.editionLabel}
        title={inspectingEdition?.title ?? ""}
        onClose={() => setInspectingEdition(null)}
      >
        {inspectingEdition && (
          <>
            <p>{inspectingEdition.plannedScope}</p>
            <dl className="apple-detail-list">
              <div><dt>Status</dt><dd>{inspectingEdition.badgeLabel}</dd></div>
              <div><dt>Boundary</dt><dd>{inspectingEdition.whyNotBorrowed}</dd></div>
              <div><dt>Limitations</dt><dd>{inspectingEdition.limitations.join(" ")}</dd></div>
            </dl>
          </>
        )}
      </AppleDetailModal>
    </section>
  );
}
