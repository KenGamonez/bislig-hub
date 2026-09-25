import { useEffect, useState, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { DriverHeader } from "./components/DriverHeader";
import { DriverBottomNav } from "./components/DriverBottomNav";
import { useDriverSession } from "./hooks/useDriverSession";
import { fetchAssignedRidesForDriver } from "../legacy/lib/rides";
import { fetchDriverPakyawanBookings } from "../legacy/lib/scheduledBookings";
import { fetchDriverDeliveries } from "../legacy/lib/deliveries";
import "./driver.css";

/**
 * New Hub-native driver shell (Phase 6D-1 foundation).
 * Own chrome (DriverHeader + DriverBottomNav), own canvas — the legacy
 * driver workspace at /driver stays untouched until later phases.
 * Carries a lightweight active-job flag for the nav indicator (single
 * read per navigation; the Active page owns realtime + polling).
 */
export function DriverShell({ children }: { children: ReactNode }) {
  const session = useDriverSession();
  const location = useLocation();
  const [hasActiveJob, setHasActiveJob] = useState(false);

  const name =
    session.status === "active" ? session.driver.full_name : null;

  useEffect(() => {
    if (session.status !== "active") {
      setHasActiveJob(false);
      return;
    }
    let cancelled = false;
    Promise.all([
      fetchAssignedRidesForDriver(session.driver.id).catch(() => []),
      fetchDriverPakyawanBookings(session.driver.id).catch(() => []),
      fetchDriverDeliveries(session.driver.id).catch(() => []),
    ])
      .then(([rides, pakyawan, deliveries]) => {
        if (!cancelled) {
          setHasActiveJob(
            rides.length > 0 || pakyawan.length > 0 || deliveries.length > 0
          );
        }
      })
      .catch(() => {
        if (!cancelled) setHasActiveJob(false);
      });
    return () => {
      cancelled = true;
    };
  }, [session, location.pathname]);

  return (
    <div className="hub-driver">
      <DriverHeader name={name} online={false} />
      <main className="hub-driver__main" id="driver-main">
        {children}
      </main>
      <DriverBottomNav hasActiveJob={hasActiveJob} />
    </div>
  );
}
