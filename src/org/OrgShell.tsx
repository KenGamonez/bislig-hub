import { NavLink, useNavigate } from "react-router-dom";
import type { ReactNode } from "react";
import { useOrgAdmin } from "./useOrgAdmin";
import "../styles/ride-legacy.css";
import "./org-premium.css";

/**
 * Organization admin shell: deep-slate sidebar + topbar on desktop,
 * compact topbar + section tabs on mobile. Guards nothing itself —
 * OrgGuard on each page remains the authorization boundary.
 */

function IconOverview() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1.5" />
    </svg>
  );
}

function IconActivity() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 12h4l2.5-6 4 12 2.5-6H21" />
    </svg>
  );
}

function IconDrivers() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true">
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3.5 19a5.5 5.5 0 0 1 11 0" />
      <circle cx="16.5" cy="9" r="2.4" />
      <path d="M15.5 13.6a4.4 4.4 0 0 1 5 4.4" />
    </svg>
  );
}

function IconAnnouncements() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 10v4l3 .5V9.5L4 10Z" />
      <path d="M7 9.5 18 5v13l-11-4.5" />
      <path d="M9.5 14.5 10 19a1.5 1.5 0 0 0 3 0l-.5-4" />
    </svg>
  );
}

function IconForum() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v7a2.5 2.5 0 0 1-2.5 2.5H9l-5 4v-13.5Z" />
    </svg>
  );
}

function IconSettings() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path d="M19 12a7 7 0 0 0-.14-1.4l2-1.55-2-3.46-2.36.95a7 7 0 0 0-2.42-1.4L13.7 2.6h-3.4l-.38 2.54a7 7 0 0 0-2.42 1.4l-2.36-.95-2 3.46 2 1.55a7 7 0 0 0 0 2.8l-2 1.55 2 3.46 2.36-.95a7 7 0 0 0 2.42 1.4l.38 2.54h3.4l.38-2.54a7 7 0 0 0 2.42-1.4l2.36.95 2-3.46-2-1.55c.1-.46.14-.93.14-1.4Z" />
    </svg>
  );
}

type NavItem = { to: (slug: string) => string; label: string; icon: ReactNode };
type NavGroup = { label: string; items: NavItem[] };

const NAV_GROUPS: NavGroup[] = [
  {
    label: "Overview",
    items: [{ to: (slug) => `/org/${slug}/dashboard`, label: "Overview", icon: <IconOverview /> }],
  },
  {
    label: "Operations",
    items: [{ to: (slug) => `/org/${slug}/activity`, label: "Activity", icon: <IconActivity /> }],
  },
  {
    label: "People",
    items: [{ to: (slug) => `/org/${slug}/drivers`, label: "Drivers", icon: <IconDrivers /> }],
  },
  {
    label: "Engagement",
    items: [
      { to: (slug) => `/org/${slug}/announcements`, label: "Announcements", icon: <IconAnnouncements /> },
      { to: (slug) => `/org/${slug}/forum`, label: "Forum", icon: <IconForum /> },
    ],
  },
  {
    label: "Organization",
    items: [{ to: (slug) => `/org/${slug}/settings`, label: "Settings", icon: <IconSettings /> }],
  },
];

function orgInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "•";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

export function OrgShell({ children }: { children: ReactNode }) {
  const session = useOrgAdmin();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await session.signOut();
    navigate("/org/login", { replace: true });
  };

  const slug = session.status === "active" ? session.org.slug : "";
  const orgName = session.status === "active" ? session.org.name : "";

  return (
    <div className="orgx orgx-shell">
      <div className="orgx-body">
        {session.status === "active" ? (
          <aside className="orgx-side" aria-label="Organization navigation">
            <div className="orgx-brand">
              <img src="/assets/bislig-hub-logo.png" alt="Bislig Hub" decoding="async" />
              <div className="orgx-brand__meta">
                <span className="orgx-brand__name">Bislig Hub</span>
                <span className="orgx-brand__sub">Org Console</span>
              </div>
            </div>
            <nav className="orgx-nav" aria-label="Organization sections">
              {NAV_GROUPS.map((group) => (
                <div key={group.label}>
                  <p className="orgx-nav__group-label">{group.label}</p>
                  <ul className="orgx-nav__items">
                    {group.items.map((item) => (
                      <li key={item.label}>
                        <NavLink
                          to={item.to(slug)}
                          end={item.label === "Overview"}
                          className={({ isActive }) =>
                            `orgx-nav__item${isActive ? " is-active" : ""}`
                          }
                        >
                          <span className="orgx-nav__icon">{item.icon}</span>
                          {item.label}
                        </NavLink>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </nav>
            <div className="orgx-side__foot">
              <div className="orgx-orgcard">
                <span className="orgx-orgcard__mark" aria-hidden="true">
                  {orgInitials(orgName)}
                </span>
                <div className="orgx-orgcard__meta">
                  <span className="orgx-orgcard__name">{orgName}</span>
                  <span className="orgx-orgcard__role">Administrator</span>
                </div>
              </div>
              <button type="button" className="orgx-logout" onClick={() => void handleLogout()}>
                Log out
              </button>
            </div>
          </aside>
        ) : null}

        <div className="orgx-main">
          <header className="orgx-topbar" role="banner">
            <div className="orgx-topbar__inner">
              <span className="orgx-topbar__brand">
                <img src="/assets/bislig-hub-logo.png" alt="Bislig Hub" decoding="async" />
              </span>
              {session.status === "active" ? (
                <p className="orgx-topbar__crumb">
                  Organization admin · <strong>{orgName}</strong>
                </p>
              ) : null}
              {session.status === "active" ? (
                <button
                  type="button"
                  className="btn btn--ghost btn--compact orgx-topbar__logout"
                  onClick={() => void handleLogout()}
                >
                  Log out
                </button>
              ) : null}
            </div>
          </header>

          <div className="orgx-content">
            {session.status === "active" ? (
              <nav className="orgx-mobiletabs" aria-label="Organization sections">
                {NAV_GROUPS.flatMap((group) => group.items).map((item) => (
                  <NavLink
                    key={item.label}
                    to={item.to(slug)}
                    end={item.label === "Overview"}
                    className={({ isActive }) => (isActive ? "is-active" : "")}
                  >
                    {item.label}
                  </NavLink>
                ))}
              </nav>
            ) : null}
            <main id="main-content">{children}</main>
          </div>
        </div>
      </div>
    </div>
  );
}
