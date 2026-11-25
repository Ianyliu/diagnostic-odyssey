import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { COVERAGE_CATALOG, type CoverageCatalogEntry } from "../data/coverageCatalog";
import { DetailDrawer } from "./DetailDrawer";

interface EditionDrawerProps {
  open: boolean;
  initialEditionId?: string | null;
  onClose: () => void;
}

export function EditionDrawer({ open, initialEditionId = null, onClose }: EditionDrawerProps) {
  const [selectedId, setSelectedId] = useState<string>(COVERAGE_CATALOG[0]!.id);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    if (open && initialEditionId && COVERAGE_CATALOG.some(entry => entry.id === initialEditionId)) {
      setSelectedId(initialEditionId);
    }
  }, [open, initialEditionId]);

  const active: CoverageCatalogEntry =
    COVERAGE_CATALOG.find(entry => entry.id === selectedId) ?? COVERAGE_CATALOG[0]!;

  const onTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let nextIndex = index;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      nextIndex = (index + 1) % COVERAGE_CATALOG.length;
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      nextIndex = (index + COVERAGE_CATALOG.length - 1) % COVERAGE_CATALOG.length;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = COVERAGE_CATALOG.length - 1;
    } else {
      return;
    }
    event.preventDefault();
    const nextEntry = COVERAGE_CATALOG[nextIndex]!;
    setSelectedId(nextEntry.id);
    tabRefs.current[nextIndex]?.focus();
  };

  return (
    <DetailDrawer
      open={open}
      eyebrow="PLATFORM EDITIONS"
      title="Coverage & Roadmap"
      onClose={onClose}
    >
      <div className="edition-switcher-list" role="tablist" aria-label="Platform editions">
        {COVERAGE_CATALOG.map((entry, index) => {
          const isSelected = entry.id === active.id;
          return (
            <button
              key={entry.id}
              ref={el => { tabRefs.current[index] = el; }}
              id={`edition-tab-${entry.id}`}
              type="button"
              role="tab"
              aria-selected={isSelected}
              aria-controls="edition-detail-panel"
              tabIndex={isSelected ? 0 : -1}
              className={`edition-option${isSelected ? " is-active" : ""}`}
              onClick={() => setSelectedId(entry.id)}
              onKeyDown={event => onTabKeyDown(event, index)}
            >
              <div>
                <span className="edition-ordinal" aria-hidden="true">
                  {String(index + 1).padStart(2, "0")}
                </span>
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

      <article
        id="edition-detail-panel"
        className={`edition-detail-card ${active.status === "live" ? "is-live" : "is-soon"}`}
        role="tabpanel"
        tabIndex={0}
        aria-labelledby={`edition-tab-${active.id}`}
      >
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
