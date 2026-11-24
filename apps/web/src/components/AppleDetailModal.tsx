import { useLayoutEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import "./AppleDetailModal.css";

export function AppleDetailModal({
  open,
  title,
  kicker,
  onClose,
  children
}: {
  open: boolean;
  title: string;
  kicker?: string | undefined;
  onClose: () => void;
  children: ReactNode;
}) {
  if (!open) return null;
  return createPortal(
    <AppleModalContent title={title} kicker={kicker} onClose={onClose}>
      {children}
    </AppleModalContent>,
    document.body
  );
}

function AppleModalContent({
  title,
  kicker,
  onClose,
  children
}: {
  title: string;
  kicker?: string | undefined;
  onClose: () => void;
  children: ReactNode;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const previousFocus = document.activeElement;
    if (!dialog.open) dialog.showModal();
    closeBtnRef.current?.focus();
    return () => {
      if (dialog.open) dialog.close();
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) {
        previousFocus.focus();
      }
    };
  }, []);

  return (
    <dialog
      ref={dialogRef}
      className="apple-detail-dialog"
      aria-labelledby="apple-modal-title"
      onCancel={event => {
        event.preventDefault();
        onClose();
      }}
      onClick={event => {
        if (event.target === dialogRef.current) onClose();
      }}
    >
      <div className="apple-detail-sheet">
        <header className="apple-detail-header">
          <div>
            {kicker && <p className="apple-detail-kicker">{kicker}</p>}
            <h2 id="apple-modal-title">{title}</h2>
          </div>
          <button
            ref={closeBtnRef}
            type="button"
            className="apple-detail-close"
            aria-label={`Close ${title}`}
            onClick={onClose}
          >
            <svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M5 5l10 10M15 5L5 15" />
            </svg>
          </button>
        </header>
        <div className="apple-detail-body">{children}</div>
      </div>
    </dialog>
  );
}
