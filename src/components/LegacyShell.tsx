import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/ride-legacy.css";
import type { AppViewMode } from "../legacy/components/AppHeader";

/**
 * Shell for ported Bislig Ride screens.
 * - Scopes the ported Ride stylesheet (.hub-legacy) so it never leaks
 *   into the Hub shell.
 * - Maps legacy view-switch callbacks onto Hub routes. The legacy screens
 *   keep their own (Hub-branded) header; the Hub header/bottom-nav are
 *   hidden on these routes by App.tsx.
 */
export function LegacyShell({ children }: { children: ReactNode }) {
  return <div className="hub-legacy">{children}</div>;
}

export function useLegacyViewChange() {
  const navigate = useNavigate();
  return (view: AppViewMode) => {
    if (view === "driver") navigate("/driver");
    else if (view === "admin") navigate("/admin");
    else navigate("/");
  };
}
