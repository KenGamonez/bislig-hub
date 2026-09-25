import { Link } from "react-router-dom";
import { DriverPage } from "../components/DriverPage";
import { EmptyState } from "../components/EmptyState";
import { LoadingState } from "../components/LoadingState";
import { useDriverSession } from "../hooks/useDriverSession";

/**
 * You shell (foundation). Real identity/vehicle rows from the existing
 * driver record; account actions stay minimal — password/history live in
 * the classic view until later phases.
 */
export function YouPage() {
  const session = useDriverSession();

  if (session.status === "loading") {
    return (
      <DriverPage title="You" kicker="Driver">
        <LoadingState label="Loading your profile…" />
      </DriverPage>
    );
  }

  if (session.status !== "active") {
    return (
      <DriverPage title="You" kicker="Driver">
        <EmptyState
          title={
            session.status === "blocked"
              ? "Account inactive"
              : "Sign in to drive"
          }
          body="Your profile, vehicle and account live here once you're signed in."
          action={
            <Link to="/driver" className="btn btn--primary btn--block">
              Go to driver sign in
            </Link>
          }
        />
      </DriverPage>
    );
  }

  const driver = session.driver;
  const vehicle = [driver.vehicle_type, driver.vehicle_model]
    .filter(Boolean)
    .join(" · ");

  return (
    <DriverPage title="You" kicker="Driver">
      <div className="hub-driver__card">
        <p className="hub-driver__card-title">{driver.full_name}</p>
        <p className="hub-driver__card-sub">
          {[vehicle || null, driver.plate_number]
            .filter(Boolean)
            .join(" · ") || "Driver"}
        </p>
        <dl className="hub-driver__facts">
          <div>
            <dt>Capacity</dt>
            <dd>
              {driver.vehicle_capacity != null
                ? `${driver.vehicle_capacity}`
                : "—"}
            </dd>
          </div>
          <div>
            <dt>Rating</dt>
            <dd>
              {driver.rating_average != null
                ? Number(driver.rating_average).toFixed(1)
                : "New"}
            </dd>
          </div>
        </dl>
        <Link to="/driver" className="btn btn--ghost btn--block">
          History, password & more
        </Link>
        <button
          type="button"
          className="btn btn--ghost btn--block"
          onClick={() => void session.signOut()}
        >
          Log out
        </button>
      </div>
    </DriverPage>
  );
}
