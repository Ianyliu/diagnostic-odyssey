import { useId, type ReactNode } from "react";

export function LedgerGroup({
  id,
  title,
  summary,
  open,
  onToggle,
  children
}: {
  id?: string;
  title: string;
  summary: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  const contentId = useId();
  return (
    <section className="ledger-group" id={id}>
      <h2 className="ledger-group-title">
        <button type="button" aria-expanded={open} aria-controls={contentId} onClick={onToggle}>
          <span>{title}</span>
          <span className="ledger-group-count">{summary}</span>
          <span className="ledger-disclosure-mark" aria-hidden="true">{open ? "−" : "+"}</span>
        </button>
      </h2>
      <div id={contentId} className="ledger-group-content" hidden={!open}>{children}</div>
    </section>
  );
}
