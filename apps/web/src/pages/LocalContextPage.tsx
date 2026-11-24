import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type { LocalContextRecord } from "@diagnostic-odyssey/contracts";
import { HpsaRuralComposition } from "../components/HpsaRuralComposition";
import { COVERAGE_CATALOG } from "../data/coverageCatalog";
import { useArtifact } from "../data/ArtifactContext";
import { formatLocalContextValue } from "../data/formatLocalContextValue";
import { isSelectableLocalContextRecord } from "../data/localContextSelection";
import {
  formatLocalContextUncertaintyType,
  formatPublishedLocalContextUncertainty,
  getLocalContextSelectionAccessibility
} from "../data/localContextPresentation";
import { formatDataStateLabel, formatReleaseStatusLabel } from "../data/presentationLabels";
import "./LocalContextPage.css";

type TerrainCategory = "all" | "primary-care" | "mental-health" | "acs";

function categoryForRecord(record: LocalContextRecord): Exclude<TerrainCategory, "all"> {
  if (record.source_ref === "hrsa-hpsa-primary-care-current") return "primary-care";
  if (record.source_ref === "hrsa-hpsa-mental-health-current") return "mental-health";
  return "acs";
}

function ConstraintBar({
  record,
  maxForUnit
}: {
  record: LocalContextRecord;
  maxForUnit: number;
}) {
  if (typeof record.value !== "number") return null;
  const pct = Math.max(0, Math.min(100, (record.value / Math.max(maxForUnit, 1)) * 100));
  const w = (pct / 100) * 180;
  const moe =
    record.margin_of_error !== null && record.unit === "percent"
      ? (record.margin_of_error / 100) * 180
      : 0;

  return (
    <svg className="constraint-bar-svg" viewBox="0 0 180 12" aria-hidden="true">
      <line className="cb-track" x1="0" y1="6" x2="180" y2="6" strokeWidth="2" />
      <rect className="cb-fill" x="0" y="3" width={Math.max(2, w)} height="6" rx="3" />
      {moe > 0 && (
        <line
          className="cb-moe"
          x1={Math.max(0, w - moe)}
          y1="6"
          x2={Math.min(180, w + moe)}
          y2="6"
          strokeWidth="2"
        />
      )}
    </svg>
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

  const [category, setCategory] = useState<TerrainCategory>("all");
  const [inspectedId, setInspectedId] = useState<string>(
    "wv.hrsa.primary-care.designated-distinct-count"
  );

  const indicators = localContext?.indicators ?? [];
  const filtered = useMemo(() => {
    if (category === "all") return indicators;
    return indicators.filter(record => categoryForRecord(record) === category);
  }, [indicators, category]);

  if (!bundle) return null;

  if (localContextStatus === "loading") {
    return (
      <section className="page page-stack">
        <header className="page-heading">
          <p className="eyebrow">02 · IMPLEMENTATION TERRAIN</p>
          <h1>West Virginia access constraints</h1>
          <p>Loading reviewed statewide records.</p>
        </header>
        <div className="state-card" role="status">
          <strong>Loading reviewed local context…</strong>
          <p>National MEPS burden remains unchanged.</p>
        </div>
      </section>
    );
  }

  if (localContextStatus === "error" || !localContext) {
    return (
      <section className="page page-stack">
        <header className="page-heading">
          <p className="eyebrow">02 · IMPLEMENTATION TERRAIN</p>
          <h1>West Virginia access constraints</h1>
          <p>Statewide HRSA and ACS terrain remains separate from national burden.</p>
        </header>
        <div className="empty-state" role="alert">
          <strong>Reviewed local implementation context is unavailable.</strong>
          <p>{localContextError ?? "The reviewed local-context artifact could not be loaded."}</p>
        </div>
        <div className="guardrail">
          <strong>Missing does not mean zero.</strong>
          <p>Missing designation or survey data never implies zero constraint.</p>
        </div>
      </section>
    );
  }

  const eligibleCount = indicators.filter(isSelectableLocalContextRecord).length;
  const selectedCount = selectedLocalContextIds.length;
  const inspected =
    filtered.find(record => record.indicator_id === inspectedId) ??
    filtered[0] ??
    indicators[0];

  const primaryBreakdowns = indicators.filter(
    record => record.source_ref === "hrsa-hpsa-primary-care-current"
  );
  const mentalBreakdowns = indicators.filter(
    record => record.source_ref === "hrsa-hpsa-mental-health-current"
  );
  const comingSoonGeo = COVERAGE_CATALOG.find(item => item.id === "additional-geographies");

  const unitMax = (record: LocalContextRecord) => {
    if (record.unit === "percent") return 100;
    if (record.unit === "HPSA score points") return 26;
    return 140;
  };

  return (
    <section className="page page-stack terrain-command-page">
      <header className="section-header-bar">
        <div className="page-heading">
          <p className="eyebrow">02 · IMPLEMENTATION TERRAIN</p>
          <h1>West Virginia access constraints</h1>
          <p>{indicators.length} HRSA and ACS indicators. Never local prevalence.</p>
          <p className="micro-caption">State context · Not prevalence</p>
        </div>
        <div className="section-header-actions">
          <Link className="button secondary" to="/brief">
            Brief ({selectedCount})
          </Link>
          <Link className="button" to="/pilot">
            03 Simulate →
          </Link>
        </div>
      </header>

      <div className="terrain-toolbar">
        <div className="filter-tabs" role="tablist" aria-label="Filter local terrain category">
          <button
            type="button"
            role="tab"
            aria-selected={category === "all"}
            className={`filter-tab${category === "all" ? " is-active" : ""}`}
            onClick={() => setCategory("all")}
          >
            All ({indicators.length})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={category === "primary-care"}
            className={`filter-tab${category === "primary-care" ? " is-active" : ""}`}
            onClick={() => setCategory("primary-care")}
          >
            Primary Care HPSA
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={category === "mental-health"}
            className={`filter-tab${category === "mental-health" ? " is-active" : ""}`}
            onClick={() => setCategory("mental-health")}
          >
            Mental Health HPSA
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={category === "acs"}
            className={`filter-tab${category === "acs" ? " is-active" : ""}`}
            onClick={() => setCategory("acs")}
          >
            ACS Access
          </button>
        </div>

        <div className="terrain-selection-controls">
          <span className="mono-value">{selectedCount}/{eligibleCount} in Brief</span>
          <button
            type="button"
            className="text-button"
            onClick={selectAllLocalContext}
            disabled={selectedCount === eligibleCount}
          >
            Select all
          </button>
          <button
            type="button"
            className="text-button"
            onClick={clearSelectedLocalContext}
            disabled={selectedCount === 0}
          >
            Select none
          </button>
        </div>
      </div>

      <p className="sr-only" role="status" aria-live="polite">
        {selectedCount} {selectedCount === 1 ? "record" : "records"} selected for Planning Brief.
      </p>

      <div className="command-split">
        <div className="terrain-matrix-column">
          <div className="constraint-matrix" role="list" aria-label="West Virginia constraint matrix">
            {filtered.map(record => {
              const selectable = isSelectableLocalContextRecord(record);
              const inBrief = selectedLocalContextIds.includes(record.indicator_id);
              const pinned = pilotLocalContextId === record.indicator_id;
              const isInspected = inspected?.indicator_id === record.indicator_id;
              const accessibility = getLocalContextSelectionAccessibility(record);

              return (
                <div
                  key={record.indicator_id}
                  role="listitem"
                  className={`constraint-row${isInspected ? " is-inspected" : ""}${pinned ? " is-pinned" : ""}`}
                >
                  <button
                    type="button"
                    className="constraint-row-main"
                    aria-pressed={isInspected}
                    onClick={() => setInspectedId(record.indicator_id)}
                  >
                    <div className="constraint-row-title">
                      <strong id={accessibility.titleId}>{accessibility.displayTitle}</strong>
                      <span>{record.universe}</span>
                    </div>
                    <div className="constraint-row-meter">
                      <ConstraintBar record={record} maxForUnit={unitMax(record)} />
                      <strong className="mono-value">{formatLocalContextValue(record)}</strong>
                    </div>
                  </button>

                  <div className="constraint-row-pills">
                    <label className={`pill-toggle${inBrief ? " is-active" : ""}`} htmlFor={accessibility.controlId}>
                      <input
                        id={accessibility.controlId}
                        type="checkbox"
                        aria-labelledby={accessibility.labelledBy}
                        checked={inBrief}
                        disabled={!selectable}
                        onChange={event => setLocalContextSelected(record.indicator_id, event.target.checked)}
                      />
                      <span id={accessibility.actionLabelId} className="sr-only">
                        Include in Planning Brief
                      </span>
                      <span aria-hidden="true">Brief</span>
                    </label>

                    <button
                      type="button"
                      className={`pill-btn${pinned ? " is-pinned" : ""}`}
                      disabled={!selectable}
                      aria-label={
                        pinned
                          ? `Remove ${record.label} from Pilot planning`
                          : `Use ${record.label} in Pilot planning`
                      }
                      onClick={() =>
                        pinned ? clearPilotLocalContext() : setPilotLocalContext(record.indicator_id)
                      }
                    >
                      {pinned ? "Pinned" : "Pin"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {comingSoonGeo && (
            <section className="coming-soon-terrain" aria-label="Planned geographies">
              <div className="coming-soon-head">
                <span className="status status-neutral">{comingSoonGeo.badgeLabel}</span>
                <strong>{comingSoonGeo.title}</strong>
              </div>
              <p className="subtle">{comingSoonGeo.summary}</p>
            </section>
          )}
        </div>

        {inspected && (
          <aside className="inspector-panel" aria-label="Selected indicator provenance inspector">
            <div className="inspector-head">
              <span className="eyebrow">RIGHT INSPECTOR · {inspected.source_agency}</span>
              <h2>{inspected.label}</h2>
              <span className="status status-reviewed">
                {formatReleaseStatusLabel(inspected.release_status)} ·{" "}
                {formatDataStateLabel(inspected.state)}
              </span>
            </div>

            <div className="inspector-metric">
              <strong>{formatLocalContextValue(inspected)}</strong>
              <span>{inspected.geography_name} ({inspected.geography_type})</span>
            </div>

            {categoryForRecord(inspected) === "primary-care" && (
              <HpsaRuralComposition records={primaryBreakdowns} serviceLabel="Primary Care" />
            )}
            {categoryForRecord(inspected) === "mental-health" && (
              <HpsaRuralComposition records={mentalBreakdowns} serviceLabel="Mental Health" />
            )}

            <dl className="inspector-dl">
              <div>
                <dt>Allowed interpretation</dt>
                <dd>{inspected.allowed_interpretation}</dd>
              </div>
              <div>
                <dt>Not supported</dt>
                <dd>{inspected.prohibited_interpretation.join("; ")}</dd>
              </div>
              <div>
                <dt>Source &amp; locator</dt>
                <dd>{inspected.source_ref} · {inspected.source_locator}</dd>
              </div>
              <div>
                <dt>Vintage &amp; observation</dt>
                <dd>
                  {inspected.source_release_vintage} ·{" "}
                  {inspected.observation_as_of_date ?? "Not specified"}
                </dd>
              </div>
              <div>
                <dt>Uncertainty ({formatLocalContextUncertaintyType(inspected.uncertainty_type)})</dt>
                <dd>
                  {inspected.margin_of_error === null
                    ? "Not applicable / not published"
                    : formatPublishedLocalContextUncertainty(inspected)}
                </dd>
              </div>
              <div>
                <dt>Limitations</dt>
                <dd>{inspected.limitations.join(" ")}</dd>
              </div>
            </dl>
          </aside>
        )}
      </div>
    </section>
  );
}
