import type { ReactNode } from "react";

export function ActiveJobActions({
  primaryLabel,
  onPrimary,
  busy,
  children,
}: {
  primaryLabel: string;
  onPrimary: () => void;
  busy: boolean;
  children?: ReactNode;
}) {
  return (
    <div className="hub-driver__actions">
      <button
        type="button"
        className="btn btn--primary btn--block hub-driver__primary"
        disabled={busy}
        onClick={onPrimary}
      >
        {busy ? "Working…" : primaryLabel}
      </button>
      {children ? (
        <div className="hub-driver__secondary-row">{children}</div>
      ) : null}
    </div>
  );
}
