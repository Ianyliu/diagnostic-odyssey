import { useId, useLayoutEffect, useRef, type ReactNode } from "react";
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
  const pressedOutsideRef = useRef(false);
  const titleId = useId();

  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const previousFocus = document.activeElement;
    if (!dialog.open) dialog.showModal();
    closeRef.current?.focus();
    return () => {
      if (dialog.open) dialog.close();
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) {
        previousFocus.focus();
      }
    };
  }, []);

  const isOutsideDialog = (clientX: number, clientY: number) => {
    const dialog = dialogRef.current;
    if (!dialog) return false;
    const rect = dialog.getBoundingClientRect();
    return (
      clientX < rect.left ||
      clientX > rect.right ||
      clientY < rect.top ||
      clientY > rect.bottom
    );
  };

  return (
    <dialog
      ref={dialogRef}
      className="atlas-drawer"
      aria-labelledby={titleId}
      {...({ closedby: "any" } as Record<string, unknown>)}
      onCancel={event => {
        event.preventDefault();
        onClose();
      }}
      onPointerDown={event => {
        pressedOutsideRef.current = isOutsideDialog(event.clientX, event.clientY);
      }}
      onPointerUp={event => {
        if (pressedOutsideRef.current && isOutsideDialog(event.clientX, event.clientY)) {
          onClose();
        }
        pressedOutsideRef.current = false;
      }}
    >
      <header className="atlas-drawer-head">
        <div>
          <p className="atlas-drawer-eyebrow">{eyebrow}</p>
          <h2 id={titleId}>{title}</h2>
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
