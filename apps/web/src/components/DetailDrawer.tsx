import { useLayoutEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import "./DetailDrawer.css";

interface DetailDrawerProps {
  open: boolean;
  eyebrow: string;
  title: string;
  onClose: () => void;
  children: ReactNode;
}

export function DetailDrawer({ open, eyebrow, title, onClose, children }: DetailDrawerProps) {
  if (!open) return null;
  return createPortal(
    <DetailDrawerDialog eyebrow={eyebrow} title={title} onClose={onClose}>
      {children}
    </DetailDrawerDialog>,
    document.body
  );
}

function DetailDrawerDialog({ eyebrow, title, onClose, children }: Omit<DetailDrawerProps, "open">) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    if (!dialog.open) dialog.showModal();
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    return () => {
      if (dialog.open) dialog.close();
      document.body.style.overflow = previousOverflow;
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) {
        previousFocus.focus();
      }
    };
  }, []);

  return (
    <dialog
      ref={dialogRef}
      className="atlas-drawer"
      aria-labelledby="atlas-drawer-title"
      onCancel={event => {
        event.preventDefault();
        onClose();
      }}
      onClick={event => {
        if (event.target === dialogRef.current) onClose();
      }}
    >
      <header className="atlas-drawer-head">
        <div>
          <p className="atlas-drawer-eyebrow">{eyebrow}</p>
          <h2 id="atlas-drawer-title">{title}</h2>
        </div>
        <button
          ref={closeRef}
          type="button"
          className="atlas-drawer-close"
          onClick={onClose}
          aria-label={`Close ${title}`}
        >
          Close
        </button>
      </header>
      <div className="atlas-drawer-body">{children}</div>
    </dialog>
  );
}
