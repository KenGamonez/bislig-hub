import { NavLink } from "react-router-dom";

type NavItem = {
  label: string;
  to: string;
  icon: React.ReactNode;
  disabled?: boolean;
};

function HomeIcon({ active }: { active?: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 3.5L4.2 10.2a1 1 0 0 0-.2.9V19a1 1 0 0 0 1 1h5a1 1 0 0 0 1-1v-3.5a1.5 1.5 0 0 1 1.5-1.5h1a1.5 1.5 0 0 1 1.5 1.5V19a1 1 0 0 0 1 1h5a1 1 0 0 0 1-1v-7.9a1 1 0 0 0-.2-.9L12 3.5Z"
        stroke={active ? "currentColor" : "currentColor"}
        strokeWidth={active ? 1.9 : 1.6}
        strokeLinejoin="round"
      />
    </svg>
  );
}

function RidesIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M5 17a2 2 0 1 0 0.01 0A2 2 0 0 0 5 17ZM19 17a2 2 0 1 0 0.01 0A2 2 0 0 0 19 17Z" stroke="currentColor" strokeWidth="1.6" />
      <path d="M5 17H3.5a1 1 0 0 1-1-1v-4a2 2 0 0 1 2-2h9.5l2.5 3.5a1 1 0 0 1 .2.6V16a1 1 0 0 1-1 1H19" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M7 12V9a1 1 0 0 1 1-1h4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function ActivityIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M13 2L4 13h5l-1 9 9-13h-5l1-7Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

function AccountIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" stroke="currentColor" strokeWidth="1.6" />
      <path d="M5.5 19a6.5 6.5 0 0 1 13 0" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

const items: NavItem[] = [
  { label: "Home", to: "/", icon: <HomeIcon /> },
  { label: "Rides", to: "/ride", icon: <RidesIcon /> },
  { label: "Activity", to: "/history", icon: <ActivityIcon /> },
  { label: "Account", to: "/account", icon: <AccountIcon />, disabled: true },
];

export function BottomNav() {
  return (
    <nav className="bottom-nav" aria-label="Primary">
      <div className="bottom-nav__inner">
        {items.map((item) => {
          if (item.disabled) {
            return (
              <span
                key={item.label}
                className="bottom-nav__item bottom-nav__item--disabled"
                aria-disabled="true"
                role="link"
                tabIndex={0}
                title="Coming soon"
              >
                <span className="bottom-nav__icon">{item.icon}</span>
                <span className="bottom-nav__label">{item.label}</span>
              </span>
            );
          }

          return (
            <NavLink
              key={item.label}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) =>
                `bottom-nav__item ${isActive ? "bottom-nav__item--active" : ""}`
              }
            >
              {({ isActive }) => (
                <>
                  <span className="bottom-nav__icon">
                    {item.label === "Home" ? <HomeIcon active={isActive} /> : item.icon}
                  </span>
                  <span className="bottom-nav__label">{item.label}</span>
                </>
              )}
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
