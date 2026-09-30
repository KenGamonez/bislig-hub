import type { ReactNode } from "react";

/**
 * Shared organization page header: one eyebrow, one title, one optional
 * description, and an optional actions cluster (max two important
 * actions). Purely presentational — routing, data, and behavior stay in
 * the owning page.
 */
export function OrgPageHead({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow: ReactNode;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="orgx-pagehead">
      <div>
        <p className="orgx-eyebrow">{eyebrow}</p>
        <h1 className="orgx-title">{title}</h1>
        {description ? <p className="orgx-sub">{description}</p> : null}
      </div>
      {actions ? (
        <div className="orgx-pagehead__actions">{actions}</div>
      ) : null}
    </div>
  );
}
