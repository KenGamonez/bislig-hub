import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/ride-legacy.css";
import "../styles/driver-hub.css";

/** Legacy view names (mirrors the removed legacy AppHeader contract). */
export type AppViewMode = "Rider" | "driver" | "admin";

/**
 * Shell for ported Bislig Ride screens.
 * - Scopes the ported Ride stylesheet (.hub-legacy) so it never leaks
 *   into the Hub shell.
 * - tone="driver" additionally scopes the Hub driver skin
 *   (.driver-hub), which re-themes brand accents to Hub orange/slate
 *   while preserving all operational behavior. Used ONLY on
 *   driver-facing routes (/driver, /driver/reset-password,
 *   /become-a-driver).
 * - Maps legacy view-switch callbacks onto Hub routes. The legacy screens
 *   keep their own (Hub-branded) header; the Hub header/bottom-nav are
 *   hidden on these routes by App.tsx.
 */
export function LegacyShell({
  children,
  tone,
}: {
  children: ReactNode;
  tone?: "driver";
}) {
  return (
    <div className={tone === "driver" ? "hub-legacy driver-hub" : "hub-legacy"}>
      {children}
    </div>
  );
}

export function useLegacyViewChange() {
  const navigate = useNavigate();
  return (view: AppViewMode) => {
    if (view === "driver") navigate("/driver");
    else if (view === "admin") navigate("/admin");
    else navigate("/");
  };
}
