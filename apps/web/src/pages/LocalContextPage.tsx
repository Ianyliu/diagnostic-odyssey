import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type { LocalContextRecord } from "@diagnostic-odyssey/contracts";
import { DetailDrawer } from "../components/DetailDrawer";
import { useEditionDrawer } from "../components/EditionDrawerContext";
import { HpsaRuralComposition } from "../components/HpsaRuralComposition";
import { MetricVisual } from "../components/MetricVisual";
import { useArtifact } from "../data/ArtifactContext";
import { COVERAGE_CATALOG } from "../data/coverageCatalog";
import { formatLocalContextValue } from "../data/formatLocalContextValue";
import { isSelectableLocalContextRecord } from "../data/localContextSelection";
import {
  formatLocalContextUncertaintyType,
  formatPublishedLocalContextUncertainty,
  getLocalContextSelectionAccessibility
} from "../data/localContextPresentation";
import { formatDataStateLabel, formatReleaseStatusLabel } from "../data/presentationLabels";
import { getLocalContextScaleDomain } from "../data/metricGeometry";
import "./Ledger.css";

type TerrainCategory = "all" | "primary-care" | "mental-health" | "acs";

function categoryForRecord(record: LocalContextRecord): Exclude<TerrainCategory, "all"> {
  if (record.source_ref === "hrsa-hpsa-primary-care-current") return "primary-care";
  if (record.source_ref === "hrsa-hpsa-mental-health-current") return "mental-health";
  return "acs";
}

function categoryKicker(record: LocalContextRecord): string {
  const cat = categoryForRecord(record);
  if (cat === "primary-care") return "PRIMARY CARE HPSA";
  if (cat === "mental-health") return "MENTAL HEALTH HPSA";
  return "CENSUS ACS";
}

function LocalContextProvenanceDetails({ record: inspectRecord }: { record: LocalContextRecord }) {
  return (
    <>
      <div className="atlas-drawer-stat">
        <strong>{formatLocalContextValue(inspectRecord)}</strong>
        <span>{inspectRecord.source_agency} · {inspectRecord.source_release_vintage}</span>
      </div>
      <dl className="atlas-drawer-list">
        <div>
          <dt>Observation date</dt>
          <dd>{inspectRecord.observation_as_of_date ?? "Not specified"}</dd>
        </div>
        <div>
          <dt>Geography &amp; universe</dt>
          <dd>{inspectRecord.geography_name} ({inspectRecord.geography_type}) · {inspectRecord.universe}</dd>
        </div>
        <div>
          <dt>Source &amp; locator</dt>
          <dd>{inspectRecord.source_ref} · {inspectRecord.source_locator}</dd>
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
  const { openEdition } = useEditionDrawer();

  const [category, setCategory] = useState<TerrainCategory>("all");
  const [inspectedId, setInspectedId] = useState<string>(
    "wv.hrsa.primary-care.designated-distinct-count"
  );
  const [drawerOpen, setDrawerOpen] = useState(false);

  const indicators = localContext?.indicators ?? [];

  const counts = useMemo(() => {
    let primary = 0;
    let mental = 0;
    let acs = 0;
    for (const record of indicators) {
      const cat = categoryForRecord(record);
      if (cat === "primary-care") primary += 1;
      else if (cat === "mental-health") mental += 1;
      else acs += 1;
    }
    return { all: indicators.length, primary, mental, acs };
  }, [indicators]);

  const filtered = useMemo(() => {
    if (category === "all") return indicators;
    return indicators.filter(record => categoryForRecord(record) === category);
  }, [indicators, category]);

  if (!bundle) return null;

  if (localContextStatus === "loading") {
    return (
      <section className="page page-stack">
        <header className="page-heading">
          <p className="eyebrow">02 · LOCAL CONTEXT</p>
          <h1>West Virginia access conditions</h1>
          <p>Loading reviewed state indicators…</p>
        </header>
      </section>
    );
  }

  if (localContextStatus === "error" || !localContext) {
    return (
      <section className="page page-stack">
        <header className="page-heading">
          <p className="eyebrow">02 · LOCAL CONTEXT</p>
          <h1>West Virginia access conditions</h1>
          <p>Local context unavailable; missing does not mean zero constraint.</p>
        </header>
        <div className="empty-state" role="alert">
          <strong>Reviewed local implementation context is unavailable.</strong>
          <p>{localContextError ?? "Reviewed local context could not be loaded."}</p>
        </div>
      </section>
    );
  }

  const primaryTotal = indicators.find(
    record => record.indicator_id === "wv.hrsa.primary-care.designated-distinct-count"
  );
  const mentalTotal = indicators.find(
    record => record.indicator_id === "wv.hrsa.mental-health.designated-distinct-count"
  );
  const primaryBreakdowns = indicators.filter(
    record =>
      record.source_ref === "hrsa-hpsa-primary-care-current" &&
      record.indicator_id !== "wv.hrsa.primary-care.designated-distinct-count"
  );
  const mentalBreakdowns = indicators.filter(
    record =>
      record.source_ref === "hrsa-hpsa-mental-health-current" &&
      record.indicator_id !== "wv.hrsa.mental-health.designated-distinct-count"
  );

  const eligibleCount = indicators.filter(isSelectableLocalContextRecord).length;
  const selectedCount = selectedLocalContextIds.length;
  const selectableInView = filtered.filter(isSelectableLocalContextRecord).map(record => record.indicator_id);
  const allFilteredSelected =
    selectableInView.length > 0 &&
    selectableInView.every(id => selectedLocalContextIds.includes(id));

  const inspectRecord =
    filtered.find(record => record.indicator_id === inspectedId) ??
    indicators.find(record => record.indicator_id === inspectedId) ??
    filtered[0] ??
    indicators[0] ??
    null;

  const upcomingGeographies = COVERAGE_CATALOG.filter(entry => entry.status !== "live");

  const handleInspect = (record: LocalContextRecord) => {
    setInspectedId(record.indicator_id);
    const compactViewport =
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(max-width: 1099px)").matches;
    if (compactViewport) {
      setDrawerOpen(true);
    }
  };

  const renderIndicatorCard = (record: LocalContextRecord) => {
    const selectable = isSelectableLocalContextRecord(record);
    const selected = selectedLocalContextIds.includes(record.indicator_id);
    const pilotSelected = pilotLocalContextId === record.indicator_id;
    const isInspected = inspectRecord?.indicator_id === record.indicator_id;
    const displayLabel = record.indicator_id.endsWith(".max-score")
      ? "Maximum source-published HPSA score"
      : undefined;
    const accessibility = getLocalContextSelectionAccessibility(record, displayLabel);
    const isGoverningTotal =
      record.indicator_id === "wv.hrsa.primary-care.designated-distinct-count" ||
      record.indicator_id === "wv.hrsa.mental-health.designated-distinct-count";

    return (
      <article
        key={record.indicator_id}
        className={`ledger-indicator-row atlas-terrain-row${isGoverningTotal ? " is-governing-total" : ""}${selected ? " is-selected" : ""}${pilotSelected ? " is-pilot" : ""}${isInspected ? " is-inspected" : ""}`}
      >
        <div className="atlas-terrain-row-main">
          <div className="atlas-terrain-row-head">
            <span className="visual-kicker">
              {categoryKicker(record)}
              {isGoverningTotal ? " · GOVERNING TOTAL" : ""}
            </span>
            <button
              type="button"
              className="atlas-detail-trigger"
              aria-pressed={isInspected}
              onClick={() => handleInspect(record)}
            >
              Provenance ↗
            </button>
          </div>

          <h3 id={accessibility.titleId}>{accessibility.displayTitle}</h3>
          {accessibility.disambiguatorId && (
            <span id={accessibility.disambiguatorId} className="sr-only">{record.label}</span>
          )}

          <p className="micro-caption">
            {record.source_agency} · {record.observation_as_of_date ?? record.source_release_vintage}
            {record.margin_of_error !== null && ` · ${formatLocalContextUncertaintyType(record.uncertainty_type)}`}
          </p>
        </div>

        <div className="atlas-terrain-row-metrics">
          <div className="atlas-terrain-figure">
            <strong className="ledger-record-value">{formatLocalContextValue(record)}</strong>
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
              scaleDomain={getLocalContextScaleDomain(record, indicators)}
              standaloneNote="Standalone HRSA priority score · no cross-metric bar scale"
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
                onChange={event => setLocalContextSelected(record.indicator_id, event.target.checked)}
              />
              <span id={accessibility.actionLabelId}>Include in Brief</span>
            </label>

            {pilotSelected ? (
              <button
                type="button"
                className="atlas-pilot-pill is-active"
                aria-label={`Remove ${record.label} from Strategy Lab`}
                onClick={clearPilotLocalContext}
              >
                Active in Strategy Lab ×
              </button>
            ) : (
              <button
                type="button"
                className="atlas-pilot-pill"
                disabled={!selectable}
                aria-label={`Use ${record.label} in Strategy Lab`}
                onClick={() => setPilotLocalContext(record.indicator_id)}
              >
                Use in Strategy Lab
              </button>
            )}
          </div>
        </div>
      </article>
    );
  };

  const groupedSections: ReadonlyArray<{
    id: Exclude<TerrainCategory, "all">;
    title: string;
    subtitle: string;
    records: LocalContextRecord[];
  }> = [
    {
      id: "primary-care",
      title: "Primary Care HPSA (governing total & breakdowns)",
      subtitle: primaryTotal
        ? `Governing total: ${formatLocalContextValue(primaryTotal)}. Designation type, rural-status, and score breakdowns sit underneath—never add designations to people.`
        : "HRSA Primary Care HPSA statewide designations.",
      records: filtered.filter(record => categoryForRecord(record) === "primary-care")
    },
    {
      id: "mental-health",
      title: "Mental Health HPSA (governing total & breakdowns)",
      subtitle: mentalTotal
        ? `Governing total: ${formatLocalContextValue(mentalTotal)}. Shortage-area designations reflect facility/population-group boundaries, not patient headcounts.`
        : "HRSA Mental Health HPSA statewide designations.",
      records: filtered.filter(record => categoryForRecord(record) === "mental-health")
    },
    {
      id: "acs",
      title: "2024 Census ACS statewide access indicators",
      subtitle: "5-year statewide survey percentages with published 90% margins of error; no county-level data is available.",
      records: filtered.filter(record => categoryForRecord(record) === "acs")
    }
  ];

  return (
    <section className="page page-stack local-ledger-page">
      <div className="atlas-page-top">
        <header className="page-heading">
          <p className="eyebrow">02 · LOCAL CONTEXT · EDITION 01</p>
          <h1>West Virginia access conditions</h1>
          <p>HRSA shortage designations &amp; 2024 Census ACS · Access conditions, not prevalence (statewide only, no county data).</p>
        </header>

        <div className="atlas-selection-bar" id="local-selection-summary">
          <span className="status status-selection">{selectedCount} of {eligibleCount} in Brief</span>
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
            Select none
          </button>
          {category !== "all" && selectableInView.length > 0 && (
            <button
              type="button"
              className="button secondary"
              onClick={() => setLocalContextGroupSelected(selectableInView, !allFilteredSelected)}
            >
              {allFilteredSelected ? "Clear filtered group" : "Include filtered group"}
            </button>
          )}
        </div>
      </div>

      <p className="sr-only" role="status" aria-live="polite">
        {selectedCount} {selectedCount === 1 ? "record" : "records"} selected for Planning Brief.
      </p>

      <div className="atlas-local-summary-strip" aria-label="Reviewed West Virginia statewide summary">
        <article className="atlas-local-summary-tile">
          <span className="visual-kicker">Primary Care HPSA · HRSA</span>
          <strong>{primaryTotal ? formatLocalContextValue(primaryTotal) : "—"}</strong>
          <small>HRSA shortage-area designations (not people)</small>
        </article>
        <article className="atlas-local-summary-tile">
          <span className="visual-kicker">Mental Health HPSA · HRSA</span>
          <strong>{mentalTotal ? formatLocalContextValue(mentalTotal) : "—"}</strong>
          <small>Statewide West Virginia only · no county-level data</small>
        </article>
        <article className="atlas-local-summary-tile">
          <span className="visual-kicker">Census ACS Access · 2024 5-yr</span>
          <strong>{counts.acs} reviewed indicators</strong>
          <small>Published statewide % shares with 90% margins of error</small>
        </article>
      </div>

      <p className="atlas-guardrail-line is-local-context">
        <strong>No-rescaling guarantee:</strong> Attaching an indicator via <em>Use in Strategy Lab</em> adds implementation context only; it never rescales national MEPS burden estimates or enters scenario arithmetic. Checkbox selections include up to {eligibleCount} reviewed records in Brief exports.
      </p>

      {(primaryBreakdowns.length > 0 || mentalBreakdowns.length > 0) && (
        <div className="atlas-composition-grid">
          {primaryBreakdowns.length > 0 && (
            <div className="card">
              <HpsaRuralComposition records={primaryBreakdowns} serviceLabel="Primary Care" />
            </div>
          )}
          {mentalBreakdowns.length > 0 && (
            <div className="card">
              <HpsaRuralComposition records={mentalBreakdowns} serviceLabel="Mental Health" />
            </div>
          )}
        </div>
      )}

      <div className="atlas-toolbar-row">
        <div className="atlas-tab-bar" role="group" aria-label="Filter local context indicators">
          <button
            type="button"
            aria-pressed={category === "all"}
            className={`atlas-tab${category === "all" ? " is-active" : ""}`}
            onClick={() => setCategory("all")}
          >
            All ({counts.all})
          </button>
          <button
            type="button"
            aria-pressed={category === "primary-care"}
            className={`atlas-tab${category === "primary-care" ? " is-active" : ""}`}
            onClick={() => setCategory("primary-care")}
          >
            Primary Care HPSA ({counts.primary})
          </button>
          <button
            type="button"
            aria-pressed={category === "mental-health"}
            className={`atlas-tab${category === "mental-health" ? " is-active" : ""}`}
            onClick={() => setCategory("mental-health")}
          >
            Mental Health HPSA ({counts.mental})
          </button>
          <button
            type="button"
            aria-pressed={category === "acs"}
            className={`atlas-tab${category === "acs" ? " is-active" : ""}`}
            onClick={() => setCategory("acs")}
          >
            ACS Access ({counts.acs})
          </button>
        </div>

        <p className="micro-caption">
          Designation counts do not measure shortage severity or unmet care volume · Missing does not mean zero.
        </p>
      </div>

      <div className="atlas-split-workspace">
        <div className="atlas-constraint-matrix" aria-label={`All ${filtered.length} filtered state indicators`}>
          {category === "all"
            ? groupedSections.map(group =>
                group.records.length > 0 && (
                  <section className="atlas-local-group" key={group.id} aria-labelledby={`local-group-${group.id}`}>
                    <header className="atlas-local-group-head">
                      <h2 id={`local-group-${group.id}`}>{group.title}</h2>
                      <p className="subtle">{group.subtitle}</p>
                    </header>
                    <div className="atlas-local-group-list">
                      {group.records.map(renderIndicatorCard)}
                    </div>
                  </section>
                )
              )
            : filtered.map(renderIndicatorCard)}
        </div>

        {inspectRecord && (
          <aside className="atlas-split-inspector" aria-label="Selected local indicator provenance">
            <div className="atlas-inspector-header">
              <span className="eyebrow">PROVENANCE INSPECTOR · {inspectRecord.source_agency}</span>
              <h2>{inspectRecord.label}</h2>
            </div>
            <LocalContextProvenanceDetails record={inspectRecord} />
          </aside>
        )}
      </div>

      {upcomingGeographies.length > 0 && (
        <div className="atlas-soon-strip" aria-label="Upcoming geographic editions">
          <span className="edition-pill is-soon">More States · Soon</span>
          <strong>West Virginia figures are never borrowed or rescaled across states.</strong>
          <button
            type="button"
            className="text-button"
            onClick={() => openEdition(upcomingGeographies[0]?.id)}
          >
            Preview planned editions ({upcomingGeographies.length}) ↗
          </button>
        </div>
      )}

      <div className="atlas-page-footer-bar">
        <Link className="text-button" to="/brief">
          View selected terrain in Brief →
        </Link>
        <Link className="button" to="/pilot">
          Continue to 03 Strategy Lab →
        </Link>
      </div>

      <DetailDrawer
        open={drawerOpen && inspectRecord !== null}
        eyebrow="LOCAL CONTEXT · PROVENANCE"
        title={inspectRecord?.label ?? ""}
        onClose={() => setDrawerOpen(false)}
      >
        {inspectRecord && <LocalContextProvenanceDetails record={inspectRecord} />}
      </DetailDrawer>
    </section>
  );
}
