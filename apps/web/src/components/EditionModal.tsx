import { useLayoutEffect, useRef, useState } from "react";
import { COVERAGE_CATALOG } from "../data/coverageCatalog";
import "./EditionModal.css";

export function EditionModal({
  open,
  onClose
}: {
  open: boolean;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const [selectedId, setSelectedId] = useState<string>(COVERAGE_CATALOG[0]!.id);
  const selected = COVERAGE_CATALOG.find(item => item.id === selectedId) ?? COVERAGE_CATALOG[0]!;

  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      closeRef.current?.focus();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  if (!open) return null;

  return (
    <dialog
      ref={dialogRef}
      className="edition-modal"
      aria-labelledby="edition-modal-title"
      onCancel={event => {
        event.preventDefault();
        onClose();
      }}
      onClick={event => {
        if (event.target === dialogRef.current) onClose();
      }}
    >
      <div className="edition-modal-frame">
        <header className="edition-modal-head">
          <div>
            <p className="eyebrow">PLATFORM COVERAGE CATALOG</p>
            <h2 id="edition-modal-title">Edition 01 &amp; Expansion Roadmap</h2>
          </div>
          <button
            ref={closeRef}
            type="button"
            className="button secondary"
            onClick={onClose}
            aria-label="Close Edition catalog"
          >
            Close
          </button>
        </header>

        <div className="edition-modal-grid">
          <div className="edition-list" role="tablist" aria-label="Coverage packs">
            {COVERAGE_CATALOG.map(entry => {
              const active = entry.id === selected.id;
              return (
                <button
                  key={entry.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  className={`edition-item${active ? " is-selected" : ""}${entry.status === "coming_soon" ? " is-planned" : ""}`}
                  onClick={() => setSelectedId(entry.id)}
                >
                  <span className="edition-item-top">
                    <span className={`status ${entry.status === "live" ? "status-reviewed" : "status-neutral"}`}>
                      {entry.badgeLabel}
                    </span>
                    <span className="edition-item-kicker">{entry.editionLabel}</span>
                  </span>
                  <strong>{entry.title}</strong>
                  <small>{entry.summary}</small>
                </button>
              );
            })}
          </div>

          <section className="edition-detail" role="tabpanel" aria-label={selected.title}>
            <div className="edition-detail-head">
              <span className={`status ${selected.status === "live" ? "status-reviewed" : "status-neutral"}`}>
                {selected.badgeLabel}
              </span>
              <h3>{selected.title}</h3>
            </div>
            <dl className="edition-detail-meta">
              <div>
                <dt>Condition</dt>
                <dd>{selected.conditionLabel}</dd>
              </div>
              <div>
                <dt>Geography</dt>
                <dd>{selected.geographyLabel}</dd>
              </div>
              <div>
                <dt>Scope</dt>
                <dd>{selected.plannedScope}</dd>
              </div>
              <div>
                <dt>Boundary rule</dt>
                <dd>{selected.whyNotBorrowed}</dd>
              </div>
            </dl>
            {selected.sourceHighlights.length > 0 && (
              <div className="edition-sources">
                <p className="eyebrow">ACTIVE SOURCES</p>
                <ul>
                  {selected.sourceHighlights.map(line => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </div>
            )}
            <div className="edition-limits">
              <p className="eyebrow">LIMITATIONS</p>
              <ul>
                {selected.limitations.map(limit => (
                  <li key={limit}>{limit}</li>
                ))}
              </ul>
            </div>
          </section>
        </div>
      </div>
    </dialog>
  );
}
