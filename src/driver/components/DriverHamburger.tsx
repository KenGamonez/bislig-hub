import { useEffect, useRef, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useDriverSession } from "../hooks/useDriverSession";

const MENU_ITEMS = [
  { to: "/driver/home", label: "Home" },
  { to: "/driver/jobs", label: "Work" },
  { to: "/driver/chat", label: "TODA Chat" },
  { to: "/driver/news", label: "News" },
  { to: "/driver/you", label: "Profile" },
  { to: "/driver/history", label: "Trip history" },
];

/**
 * Driver hamburger navigation: one-handed access to every driver
 * destination plus logout. Complements (never replaces) the bottom nav.
 * Same accessible drawer contract as the org console menu.
 */
export function DriverHamburger() {
  const session = useDriverSession();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const openButtonRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  const close = () => setOpen(false);

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!open) return;
    closeButtonRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      openButtonRef.current?.focus?.();
    };
  }, [open ]);

  const handleLogout = async () => {
    await session.signOut();
    setOpen(false);
    navigate("/driver/login", { replace: true });
  };

  const firstName =
    session.status === "active"
      ? session.driver.full_name.split(" ")[0]
      : null;

  return (
    <>
      <button
        ref={openButtonRef}
        type="button"
        className="hub-driver__menu-btn"
        aria-label="Open driver menu"
        aria-expanded={open}
        aria-controls="hub-driver-menu"
        onClick={() => setOpen(true)}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <path d="M4 7h16M4 12h16M4 17h16" />
        </svg>
      </button>

      {open ? (
        <div className="hub-driver__drawer" id="hub-driver-menu">
          <div
            className="hub-driver__drawer-backdrop"
            role="presentation"
            onClick={close}
          />
          <div
            className="hub-driver__drawer-panel"
            role="dialog"
            aria-modal="true"
            aria-label="Driver menu"
          >
            <div className="hub-driver__drawer-head">
              <div className="hub-driver__drawer-identity">
                <p className="hub-driver__drawer-eyebrow">Bislig Hub · Driver</p>
                <p className="hub-driver__drawer-name">
                  {firstName ?? "Driver"}
                </p>
              </div>
              <button
                ref={closeButtonRef}
                type="button"
                className="hub-driver__drawer-close"
                aria-label="Close driver menu"
                onClick={close}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                  <path d="M6 6l12 12M18 6 6 18" />
                </svg>
              </button>
            </div>
            <nav
              className="hub-driver__drawer-nav"
              aria-label="Driver destinations"
            >
              <ul>
                {MENU_ITEMS.map((item) => (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      className={({ isActive }) =>
                        `hub-driver__drawer-item${
                          isActive ? " is-active" : ""
                        }`
                      }
                      onClick={close}
                    >
                      {item.label}
                      <span aria-hidden="true">›</span>
                    </NavLink>
                  </li>
                ))}
              </ul>
            </nav>
            <div className="hub-driver__drawer-foot">
              <button
                type="button"
                className="hub-driver__drawer-logout"
                onClick={() => void handleLogout()}
              >
                Log out
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
