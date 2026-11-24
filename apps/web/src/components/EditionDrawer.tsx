import { useState } from "react";
import { COVERAGE_CATALOG, type CoverageCatalogEntry } from "../data/coverageCatalog";
import { DetailDrawer } from "./DetailDrawer";

interface EditionDrawerProps {
  open: boolean;
  onClose: () => void;
}

export function EditionDrawer({ open, onClose }: EditionDrawerProps) {
  const [selectedId, setSelectedId] = useState<string>(COVERAGE_CATALOG[0]!.id);
  const active: CoverageCatalogEntry =
    COVERAGE_CATALOG.find(entry => entry.id === selectedId) ?? COVERAGE_CATALOG[0]!;

  return (
    <DetailDrawer
      open={open}
      eyebrow="PLATFORM EDITIONS"
      title="Coverage & Roadmap"
      onClose={onClose}
    >
      <div className="edition-switcher-list" role="tablist" aria-label="Platform editions">
        {COVERAGE_CATALOG.map(entry => {
          const isSelected = entry.id === active.id;
          return (
            <button
              key={entry.id}
              type="button"
              role="tab"
              aria-selected={isSelected}
              className={`edition-option${isSelected ? " is-active" : ""}`}
              onClick={() => setSelectedId(entry.id)}
            >
              <div>
                <span className={`edition-pill ${entry.status === "live" ? "is-live" : "is-soon"}`}>
                  {entry.badgeLabel}
                </span>
                <strong>{entry.title}</strong>
              </div>
              <small>{entry.geographyLabel}</small>
            </button>
          );
        })}
      </div>

      <article className="edition-detail-card" role="tabpanel" aria-label={active.title}>
        <div className="edition-detail-head">
          <span className={`edition-pill ${active.status === "live" ? "is-live" : "is-soon"}`}>
            {active.editionLabel}
          </span>
          <h3>{active.title}</h3>
          <p className="subtle">{active.summary}</p>
        </div>

        <dl className="atlas-drawer-list">
          <div>
            <dt>Condition</dt>
            <dd>{active.conditionLabel}</dd>
          </div>
          <div>
            <dt>Geography</dt>
            <dd>{active.geographyLabel}</dd>
          </div>
          {active.sourceHighlights.length > 0 && (
            <div>
              <dt>Active datasets</dt>
              <dd>
                <ul className="atlas-compact-list">
                  {active.sourceHighlights.map(item => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </dd>
            </div>
          )}
          <div>
            <dt>Scope</dt>
            <dd>{active.plannedScope}</dd>
          </div>
          <div>
            <dt>Scientific boundary</dt>
            <dd>{active.whyNotBorrowed}</dd>
          </div>
          {active.limitations.length > 0 && (
            <div>
              <dt>Limits</dt>
              <dd>
                <ul className="atlas-compact-list">
                  {active.limitations.map(item => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </dd>
            </div>
          )}
        </dl>
      </article>
    </DetailDrawer>
  );
}
