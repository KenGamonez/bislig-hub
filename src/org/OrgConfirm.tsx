import { useEffect, useRef } from "react";

/**
 * Reusable in-app confirm dialog for destructive organization actions.
 * Replaces native window.confirm() so confirmations match the Org Console
 * visual system. Render conditionally by the caller; unmount to close.
 *
 * Accessibility contract:
 * - role="dialog" + aria-modal + labelled title
 * - initial focus lands on the safe Cancel action
 * - Escape cancels
 * - focus returns to the triggering control on close
 * - backdrop blocks background interaction while open
 */
export function OrgConfirm({
  title,
  body,
  confirmLabel,
  busyLabel,
  busy,
  onConfirm,
  onCancel,
}: {
  title: string;
  body: string;
  confirmLabel: string;
  busyLabel: string;
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    returnFocusRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    cancelRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onCancel();
      }
    };
    document.addEventListener("keydown", onKeyDown);

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      returnFocusRef.current?.focus?.();
    };
  }, [onCancel]);

  return (
    <div
      className="orgx-modal"
      role="presentation"
      onClick={onCancel}
    >
      <div
        className="orgx-modal__card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="orgx-confirm-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="orgx-confirm-title" className="orgx-modal__title">
          {title}
        </h2>
        <p className="orgx-modal__body">{body}</p>
        <div className="orgx-modal__actions">
          <button
            ref={cancelRef}
            type="button"
            className="btn btn--ghost btn--compact"
            disabled={busy}
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn btn--primary btn--compact"
            disabled={busy}
            onClick={onConfirm}
          >
            {busy ? busyLabel : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
