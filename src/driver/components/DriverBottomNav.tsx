import { NavLink } from "react-router-dom";

const items = [
  {
    to: "/driver/home",
    label: "Home",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M4 11.5 12 4l8 7.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M6.5 10.5V20h11v-9.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    to: "/driver/jobs",
    label: "Work",
    dotOnActiveJob: true,
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect x="3.5" y="7" width="17" height="13" rx="2.5" stroke="currentColor" strokeWidth="1.7" />
        <path d="M8.5 7V5.5A1.5 1.5 0 0 1 10 4h4a1.5 1.5 0 0 1 1.5 1.5V7" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        <path d="M8 12h8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    to: "/driver/news",
    label: "News",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M4.5 6.5A1.5 1.5 0 0 1 6 5h11a1.5 1.5 0 0 1 1.5 1.5V16H6A1.5 1.5 0 0 1 4.5 14.5v-8Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
        <path d="M18.5 16v2.5a1.5 1.5 0 0 1-1.5 1.5H7" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        <path d="M8 9h7M8 12h5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    to: "/driver/chat",
    label: "Chat",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v7a2.5 2.5 0 0 1-2.5 2.5H9l-5 4V6.5Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    to: "/driver/you",
    label: "Profile",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="8" r="3.2" stroke="currentColor" strokeWidth="1.7" />
        <path d="M5.5 19a6.5 6.5 0 0 1 13 0" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      </svg>
    ),
  },
];

export function DriverBottomNav({
  hasActiveJob = false,
}: {
  hasActiveJob?: boolean;
}) {
  return (
    <nav className="hub-driver__nav" aria-label="Driver">
      <div className="hub-driver__nav-inner">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `hub-driver__nav-item${isActive ? " is-active" : ""}`
            }
          >
            <span className="hub-driver__nav-icon">
              {item.icon}
              {"dotOnActiveJob" in item && item.dotOnActiveJob && hasActiveJob ? (
                <span
                  className="hub-driver__nav-dot"
                  aria-label="Active job"
                />
              ) : null}
            </span>
            <span className="hub-driver__nav-label">{item.label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
