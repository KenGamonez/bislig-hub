import { NavLink, useNavigate } from "react-router-dom";
import { useAppInstall } from "../legacy/lib/appInstall";
import { useLanguage } from "../legacy/lib/i18n";

type NavItem = {
  label: string;
  to: string;
  icon: React.ReactNode;
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

function AddHomeScreenIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 3.5 4.5 10v9a1 1 0 0 0 1 1H10v-5h4v5h4.5a1 1 0 0 0 1-1v-9L12 3.5Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M12 12v4M10.2 14.2 12 16l1.8-1.8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function DriverIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="8" r="3.2" stroke="currentColor" strokeWidth="1.6" />
      <path d="M5.5 19a6.5 6.5 0 0 1 13 0" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function BottomNav() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { canInstall, promptInstall } = useAppInstall();
  const items: NavItem[] = [
    { label: t("nav.home"), to: "/", icon: <HomeIcon /> },
    { label: t("hub.rides"), to: "/ride", icon: <RidesIcon /> },
    { label: t("hub.driver"), to: "/driver", icon: <DriverIcon /> },
  ];

  const handleAddHomeScreen = async () => {
    // Same install flow as the Home InstallAction: native prompt when the
    // browser exposes it, otherwise fall back to the Home guidance panel.
    if (canInstall) {
      await promptInstall();
      return;
    }
    navigate("/#install-help");
  };

  return (
    <nav className="bottom-nav" aria-label="Primary">
      <div className="bottom-nav__inner">
        {items.map((item) => (
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
                  {item.to === "/" ? <HomeIcon active={isActive} /> : item.icon}
                </span>
                <span className="bottom-nav__label">{item.label}</span>
              </>
            )}
          </NavLink>
        ))}
        <button
          type="button"
          className="bottom-nav__item"
          onClick={() => void handleAddHomeScreen()}
          aria-label={t("hub.addHomeScreen")}
        >
          <span className="bottom-nav__icon">
            <AddHomeScreenIcon />
          </span>
          <span className="bottom-nav__label">{t("hub.addHomeScreen")}</span>
        </button>
      </div>
    </nav>
  );
}
