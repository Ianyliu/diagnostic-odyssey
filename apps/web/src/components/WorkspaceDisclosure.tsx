import { createContext, useContext, useLayoutEffect, useRef, type ReactNode } from "react";
import "./WorkspaceDisclosure.css";

const DisclosureMemory = createContext<Map<string, boolean> | null>(null);

/** Presentation-only memory survives route changes, never enters a scientific payload. */
export function DisclosureProvider({children}: {children: ReactNode}) {
  const memory = useRef(new Map<string, boolean>());
  return <DisclosureMemory.Provider value={memory.current}>{children}</DisclosureMemory.Provider>;
}

export function WorkspaceDisclosure({id, title, summary, children, defaultOpen = false, forceOpen = false, className = ""}: {
  id: string; title: ReactNode; summary?: ReactNode; children: ReactNode;
  defaultOpen?: boolean; forceOpen?: boolean; className?: string;
}) {
  const memory = useContext(DisclosureMemory);
  const ref = useRef<HTMLDetailsElement>(null);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    element.open = memory?.get(id) ?? defaultOpen;
    return () => { memory?.set(id, element.open); };
  }, [id, memory, defaultOpen]);
  useLayoutEffect(() => {
    if (forceOpen && ref.current) ref.current.open = true;
  }, [forceOpen]);
  return <details ref={ref} id={id} className={`workspace-disclosure ${className}`}
    onToggle={event => {
      // An invalid input group cannot conceal its errors while correction is required.
      if (forceOpen) event.currentTarget.open = true;
      memory?.set(id, event.currentTarget.open);
    }}>
    <summary onClick={event => { if (forceOpen && ref.current?.open) event.preventDefault(); }}><span className="disclosure-title">{title}</span>{summary && <span className="disclosure-summary">{summary}</span>}</summary>
    <div className="disclosure-content">{children}</div>
  </details>;
}
