import { useRef, useState, type KeyboardEvent } from "react";
import { Link } from "react-router-dom";
import { COVERAGE_CATALOG } from "../data/coverageCatalog";
import "./CoverageSwitcher.css";

function formatCompatibilityLabel(status: "reference_implementation" | "partial_compatibility" | "planned"): string {
  switch (status) {
    case "reference_implementation":
      return "Reference implementation (live)";
    case "partial_compatibility":
      return "Partial compatibility (adapter skeleton)";
    case "planned":
      return "Planned roadmap module";
  }
}

export function CoverageSwitcher() {
  const [activeId, setActiveId] = useState(COVERAGE_CATALOG[0]!.id);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const activeEntry = COVERAGE_CATALOG.find(entry => entry.id === activeId) ?? COVERAGE_CATALOG[0]!;

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
    setActiveId(nextEntry.id);
    tabRefs.current[nextIndex]?.focus();
  };

  return (
    <section className="coverage-switcher" aria-labelledby="coverage-switcher-title">
      <div className="coverage-switcher-header">
        <div>
          <p className="visual-kicker">EDITION INDEX · PLATFORM COVERAGE</p>
          <h2 id="coverage-switcher-title">What is live now — and what comes next</h2>
          <p className="subtle">
            Diagnostic Odyssey launches with Edition 01 (Long COVID · U.S. National &amp; West Virginia). Upcoming modules stay strictly unpopulated until independently reviewed.
          </p>
        </div>
      </div>

      <div className="coverage-tabs" role="tablist" aria-label="Platform coverage editions and planned modules">
        {COVERAGE_CATALOG.map((entry, index) => {
          const selected = entry.id === activeEntry.id;
          return (
            <button
              key={entry.id}
              ref={el => { tabRefs.current[index] = el; }}
              id={`coverage-tab-${entry.id}`}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls="coverage-panel"
              tabIndex={selected ? 0 : -1}
              className={`coverage-tab${entry.status === "live" ? " is-live" : " is-planned"}`}
              onClick={() => setActiveId(entry.id)}
              onKeyDown={event => onTabKeyDown(event, index)}
            >
              <span className="coverage-tab-meta">
                <span className="coverage-tab-numeral">{String(index + 1).padStart(2, "0")}</span>
                <span className="coverage-tab-kicker">{entry.editionLabel}</span>
              </span>
              <strong>{entry.title}</strong>
              <span className={`coverage-badge ${entry.status === "live" ? "badge-live" : "badge-planned"}`}>
                {entry.badgeLabel}
              </span>
            </button>
          );
        })}
      </div>

      <article
        id="coverage-panel"
        role="tabpanel"
        tabIndex={0}
        aria-labelledby={`coverage-tab-${activeEntry.id}`}
        className={`coverage-detail ${activeEntry.status === "live" ? "detail-live" : "detail-planned"}`}
      >
        <div className="coverage-detail-head">
          <div>
            <p className="visual-kicker">{activeEntry.editionLabel}</p>
            <h3>{activeEntry.title}</h3>
          </div>
          <span className={`status ${activeEntry.status === "live" ? "status-reviewed" : "status-neutral"}`}>
            {formatCompatibilityLabel(activeEntry.compatibilityStatus)}
          </span>
        </div>

        <p>{activeEntry.plannedScope}</p>

        {activeEntry.status === "live" ? (
          <>
            <ul className="coverage-highlights" aria-label="Reviewed Edition 01 datasets">
              {activeEntry.sourceHighlights.map(item => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <div className="coverage-actions">
              <Link className="button" to="/burden">Explore Cost &amp; Burden</Link>
              <Link className="button secondary" to="/local-context">Inspect Local Terrain</Link>
            </div>
          </>
        ) : (
          <div className="coverage-guardrail-box" role="note">
            <strong>Why no preview numbers are shown</strong>
            <p>{activeEntry.whyNotBorrowed}</p>
            <ul className="coverage-limitations">
              {activeEntry.limitations.map(item => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        )}
      </article>
    </section>
  );
}
