import { NavLink } from "react-router-dom";

const items = [
  {
    to: "/driver/jobs",
    label: "Jobs",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect x="3.5" y="7" width="17" height="13" rx="2.5" stroke="currentColor" strokeWidth="1.7" />
        <path d="M8.5 7V5.5A1.5 1.5 0 0 1 10 4h4a1.5 1.5 0 0 1 1.5 1.5V7" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        <path d="M8 12h8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    to: "/driver/active",
    label: "Active",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="8.2" stroke="currentColor" strokeWidth="1.7" />
        <path d="M12 7.5V12l3 2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    to: "/driver/you",
    label: "You",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="8" r="3.2" stroke="currentColor" strokeWidth="1.7" />
        <path d="M5.5 19a6.5 6.5 0 0 1 13 0" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      </svg>
    ),
  },
];

export function DriverBottomNav() {
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
            <span className="hub-driver__nav-icon">{item.icon}</span>
            <span className="hub-driver__nav-label">{item.label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
