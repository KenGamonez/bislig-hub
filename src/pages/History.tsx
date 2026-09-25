import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  fetchCustomerRideHistory,
  friendlyRideError,
  type Ride,
  type RideStatus,
} from "../lib/rides";
import { formatCentavos } from "../lib/fare";
import { isSupabaseConfigured } from "../lib/supabase";

const STATUS_LABEL: Record<RideStatus, string> = {
  requested: "Finding driver",
  accepted: "Accepted",
  arrived: "Arrived",
  in_progress: "On trip",
  completed: "Completed",
  cancelled: "Cancelled",
  no_driver: "No driver found",
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function vehicleLabel(ride: Ride): string | null {
  if (!ride.vehicle_type) return null;
  return (
    ride.vehicle_type.charAt(0).toUpperCase() + ride.vehicle_type.slice(1)
  );
}

export function History() {
  const [rides, setRides] = useState<Ride[] | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      setRides(await fetchCustomerRideHistory());
    } catch (err) {
      setError(
        friendlyRideError(
          err,
          "Your ride history couldn't be loaded right now."
        )
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (!isSupabaseConfigured) {
    return (
      <div className="container">
        <div className="notice-card" role="alert">
          <h1 className="notice-card__title">Transport is unavailable</h1>
          <p className="notice-card__text">
            The connection to the booking service is missing. Please try again
            later.
          </p>
          <Link to="/" className="btn btn--primary">
            Back to Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <header className="form-header">
        <p className="form-header__kicker">Activity</p>
        <h1 className="form-header__title">Your rides</h1>
        <p className="form-header__subtitle">
          Recent Ride Now trips from this device.
        </p>
      </header>

      {loading && (
        <div className="loading-block" aria-live="polite">
          <span className="spinner" aria-hidden="true" />
          <p>Loading your rides…</p>
        </div>
      )}

      {!loading && error && (
        <div className="notice-card" role="alert">
          <p className="notice-card__text">{error}</p>
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => void load()}
          >
            Retry
          </button>
        </div>
      )}

      {!loading && !error && rides && rides.length === 0 && (
        <div className="notice-card">
          <h2 className="notice-card__title">No rides yet</h2>
          <p className="notice-card__text">
            Your completed rides will appear here.
          </p>
          <Link to="/ride" className="btn btn--primary">
            Book a ride
          </Link>
        </div>
      )}

      {!loading && !error && rides && rides.length > 0 && (
        <ul className="history-list">
          {rides.map((ride) => {
            const vehicle = vehicleLabel(ride);
            return (
              <li key={ride.id} className="history-card">
                <div className="history-card__top">
                  <span className="history-card__date">
                    {formatDate(ride.created_at)}
                  </span>
                  <span
                    className={`activity-pill ${
                      ride.status === "completed"
                        ? "activity-pill--closed"
                        : ride.status === "cancelled" ||
                            ride.status === "no_driver"
                          ? "activity-pill--paused"
                          : "activity-pill--active"
                    }`}
                  >
                    {STATUS_LABEL[ride.status]}
                  </span>
                </div>
                <p className="history-card__route">
                  {ride.pickup_address} → {ride.destination_address}
                </p>
                <p className="history-card__meta">
                  {typeof ride.fare_cents === "number"
                    ? `₱${formatCentavos(ride.fare_cents)}`
                    : "Fare confirmed by driver"}
                  {vehicle ? ` · ${vehicle}` : ""}
                  {typeof ride.rating === "number" && ride.rating >= 1
                    ? ` · ★ ${ride.rating}/5`
                    : ""}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
