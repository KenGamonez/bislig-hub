import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { DriverPage } from "../components/DriverPage";
import { EmptyState } from "../components/EmptyState";
import { LoadingState } from "../components/LoadingState";
import { StatusPill } from "../components/StatusPill";
import { useDriverSession } from "../hooks/useDriverSession";
import { fetchAssignedRidesForDriver } from "../../legacy/lib/rides";
import type { Ride } from "../../legacy/types/ride";
import { formatCentavos } from "../../legacy/lib/fare";

const STATUS_LABEL: Record<string, string> = {
  accepted: "Accepted",
  arrived: "Arrived",
  in_progress: "On trip",
};

/**
 * Active-job shell (foundation). Read-only detection of the driver's
 * current assigned ride via the existing engine query — no lifecycle
 * buttons yet (6D-3). Actions stay in the classic view for now.
 */
export function ActiveJobPage() {
  const session = useDriverSession();
  const [ride, setRide] = useState<Ride | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (session.status !== "active") {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetchAssignedRidesForDriver(session.driver.id)
      .then((items) => {
        if (!cancelled) setRide(items[0] ?? null);
      })
      .catch(() => {
        if (!cancelled) setRide(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [session]);

  if (session.status === "loading" || loading) {
    return (
      <DriverPage title="Active" kicker="Current job">
        <LoadingState label="Checking for an active job…" />
      </DriverPage>
    );
  }

  if (session.status !== "active") {
    return (
      <DriverPage title="Active" kicker="Current job">
        <EmptyState
          title="Nothing active"
          body="New bookings will appear here when you accept a job."
          action={
            <Link to="/driver" className="btn btn--primary btn--block">
              Go to driver sign in
            </Link>
          }
        />
      </DriverPage>
    );
  }

  if (!ride) {
    return (
      <DriverPage title="Active" kicker="Current job">
        <EmptyState
          title="Nothing active"
          body="New bookings will appear here when you accept a job."
        />
      </DriverPage>
    );
  }

  return (
    <DriverPage title="Active" kicker="Current job">
      <div className="hub-driver__card">
        <div className="hub-driver__presence-row">
          <p className="hub-driver__card-title">
            {ride.pickup_address} → {ride.destination_address}
          </p>
          <StatusPill tone="active">
            {STATUS_LABEL[ride.status] ?? ride.status}
          </StatusPill>
        </div>
        <p className="hub-driver__card-sub">
          {ride.customer_name}
          {typeof ride.fare_cents === "number"
            ? ` · ₱${formatCentavos(ride.fare_cents)}`
            : ""}
        </p>
        <Link to="/driver" className="btn btn--primary btn--block">
          Open job actions
        </Link>
      </div>
    </DriverPage>
  );
}
