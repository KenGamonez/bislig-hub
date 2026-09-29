import { NavLink, useNavigate } from "react-router-dom";
import type { ReactNode } from "react";
import { useOrgAdmin } from "./useOrgAdmin";
import "../styles/ride-legacy.css";

/**
 * Organization admin shell: brand + org identity + section nav + logout.
 * Separate from the platform admin and driver shells; mobile-first.
 */
export function OrgShell({ children }: { children: ReactNode }) {
  const session = useOrgAdmin();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await session.signOut();
    navigate("/org/login", { replace: true });
  };

  return (
    <div className="app-shell">
      <div className="app-canvas">
        <header className="app-header" role="banner">
          <div className="app-header__inner">
            <span className="app-header__brand" aria-label="Bislig Hub organization admin">
              <img
                src="/assets/bislig-hub-logo.png"
                alt="Bislig Hub"
                className="app-header__logo"
                width={148}
                height={36}
                decoding="async"
              />
            </span>
            <div className="app-header__right">
              {session.status === "active" ? (
                <button
                  type="button"
                  className="btn btn--ghost btn--compact"
                  onClick={() => void handleLogout()}
                >
                  Log out
                </button>
              ) : null}
            </div>
          </div>
        </header>
        <main className="page" id="main-content">
          {session.status === "active" ? (
            <div className="container">
              <p className="eyebrow">Organization admin</p>
              <h1 style={{ fontSize: 20, fontWeight: 700 }}>
                {session.org.name}
              </h1>
              <nav
                aria-label="Organization sections"
                style={{ display: "flex", gap: 8, margin: "12px 0 16px", flexWrap: "wrap" }}
              >
                <NavLink
                  to={`/org/${session.org.slug}/dashboard`}
                  className={({ isActive }) =>
                    `btn btn--compact ${isActive ? "btn--primary" : "btn--ghost"}`
                  }
                >
                  Dashboard
                </NavLink>
                <NavLink
                  to={`/org/${session.org.slug}/drivers`}
                  className={({ isActive }) =>
                    `btn btn--compact ${isActive ? "btn--primary" : "btn--ghost"}`
                  }
                >
                  Drivers
                </NavLink>
                <NavLink
                  to={`/org/${session.org.slug}/activity`}
                  className={({ isActive }) =>
                    `btn btn--compact ${isActive ? "btn--primary" : "btn--ghost"}`
                  }
                >
                  Activity
                </NavLink>
              </nav>
            </div>
          ) : null}
          {children}
        </main>
      </div>
    </div>
  );
}
