import { Link } from "react-router-dom";
import { DriverPage } from "../components/DriverPage";
import { EmptyState } from "../components/EmptyState";
import { LoadingState } from "../components/LoadingState";
import { useDriverSession } from "../hooks/useDriverSession";
import { useDriverReputation } from "../hooks/useDriverReputation";
import { DriverIdentityCard } from "../components/DriverIdentityCard";
import { DriverStats } from "../components/DriverStats";
import { DriverVehicleCard } from "../components/DriverVehicleCard";
import { DriverAccountActions } from "../components/DriverAccountActions";

export function YouPage() {
  const session = useDriverSession();
  const driverId = session.status === "active" ? session.driver.id : null;
  const { reputation, loading: reputationLoading } = useDriverReputation(driverId);

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
      <DriverIdentityCard
        name={driver.full_name}
        vehicle={vehicle || "Driver"}
        plateNumber={driver.plate_number}
        capacity={driver.vehicle_capacity}
        rating={driver.rating_average}
        status={driver.status}
        username={driver.username}
        email={driver.email}
        canAcceptPakyawan={driver.can_accept_pakyawan}
        canAcceptDeliveries={driver.can_accept_deliveries}
        online={false}
      />

      {reputation ? (
        <DriverStats
          completedRides={reputation.completedRides}
          averageStars={reputation.averageStars}
          totalRatings={reputation.totalRatings}
          cancelledRides={reputation.cancelledRides}
          cancellationRate={reputation.cancellationRate}
        />
      ) : reputationLoading ? (
        <div className="hub-driver__card hub-driver__stats hub-driver__stats--loading">
          <div className="hub-driver__stat-tile">
            <span className="hub-driver__stat-label">Completed rides</span>
            <strong className="hub-driver__stat-value">—</strong>
          </div>
          <div className="hub-driver__stat-tile">
            <span className="hub-driver__stat-label">Rating</span>
            <strong className="hub-driver__stat-value">—</strong>
          </div>
          <div className="hub-driver__stat-tile">
            <span className="hub-driver__stat-label">Cancellations</span>
            <strong className="hub-driver__stat-value">—</strong>
          </div>
        </div>
      ) : null}

      <DriverVehicleCard
        vehicleType={driver.vehicle_type}
        vehicleModel={driver.vehicle_model}
        plateNumber={driver.plate_number}
        capacity={driver.vehicle_capacity}
        canAcceptPakyawan={driver.can_accept_pakyawan}
        canAcceptDeliveries={driver.can_accept_deliveries}
      />

      <DriverAccountActions onCloseChangePassword={() => {}} />

      <Link to="/driver/history" className="btn btn--primary btn--block hub-driver__history-link">
        View Trip History
      </Link>
    </DriverPage>
  );
}