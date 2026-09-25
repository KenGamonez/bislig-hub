import type { ReactNode } from "react";
import { DriverHeader } from "./components/DriverHeader";
import { DriverBottomNav } from "./components/DriverBottomNav";
import { useDriverSession } from "./hooks/useDriverSession";
import "./driver.css";

/**
 * New Hub-native driver shell (Phase 6D-1 foundation).
 * Own chrome (DriverHeader + DriverBottomNav), own canvas — the legacy
 * driver workspace at /driver stays untouched until later phases.
 */
export function DriverShell({ children }: { children: ReactNode }) {
  const session = useDriverSession();
  const name =
    session.status === "active" ? session.driver.full_name : null;

  return (
    <div className="hub-driver">
      <DriverHeader name={name} online={false} />
      <main className="hub-driver__main" id="driver-main">
        {children}
      </main>
      <DriverBottomNav />
    </div>
  );
}
