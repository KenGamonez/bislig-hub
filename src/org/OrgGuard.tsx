import { Link } from "react-router-dom";
import { useOrgAdmin, type OrgAdminState } from "./useOrgAdmin";
import type { OrgRecord } from "./orgData";
import type { ReactNode } from "react";

function LoadingBlock({ label }: { label: string }) {
  return (
    <div className="container">
      <div className="loading-block" aria-live="polite">
        <span className="spinner" aria-hidden="true" />
        <p>{label}</p>
      </div>
    </div>
  );
}

function Denied({ signedIn }: { signedIn: boolean }) {
  return (
    <div className="container">
      <div className="notice-card" role="alert">
        <h1 className="notice-card__title">No organization access</h1>
        <p className="notice-card__text">
          {signedIn
            ? "This account is not an administrator of this organization."
            : "Sign in with an organization administrator account to continue."}
        </p>
        <Link to="/org/login" className="btn btn--primary">
          Go to organization sign in
        </Link>
      </div>
    </div>
  );
}

/**
 * Gates an org page on a resolved active org-admin session AND a matching
 * :slug. URL tampering can never leak data: every data query below uses
 * the resolved org id (never the slug), and RLS enforces the boundary.
 */
export function OrgGuard({
  slug,
  children,
}: {
  slug: string | undefined;
  children: (org: OrgRecord, state: OrgAdminState) => ReactNode;
}) {
  const session = useOrgAdmin();

  if (session.status === "loading") {
    return <LoadingBlock label="Checking organization access…" />;
  }

  if (
    session.status !== "active" ||
    !slug ||
    session.org.slug !== slug
  ) {
    return <Denied signedIn={session.status !== "logged-out"} />;
  }

  return <>{children(session.org, session)}</>;
}
