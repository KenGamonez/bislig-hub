import { Link } from "react-router-dom";
import { DriverPage } from "../components/DriverPage";
import { EmptyState } from "../components/EmptyState";
import { LoadingState } from "../components/LoadingState";
import { useDriverSession } from "../hooks/useDriverSession";
import { useDriverHistory } from "../hooks/useDriverHistory";
import { DriverHistoryCard } from "../components/DriverHistoryCard";

export function DriverHistoryPage() {
  const session = useDriverSession();
  const driverId = session.status === "active" ? session.driver.id : null;
  const { rides, deliveries, loading } = useDriverHistory(driverId);

  const allHistory = [
    ...rides,
    ...deliveries,
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  if (session.status === "loading" || loading) {
    return (
      <DriverPage title="History" kicker="Trip History">
        <LoadingState label="Loading your history…" />
      </DriverPage>
    );
  }

  if (session.status !== "active") {
    return (
      <DriverPage title="History" kicker="Trip History">
        <EmptyState
          title="Sign in to drive"
          body="Your trip history will appear here once you're signed in."
          action={
            <Link to="/driver" className="btn btn--primary btn--block">
              Go to driver sign in
            </Link>
          }
        />
      </DriverPage>
    );
  }

  if (allHistory.length === 0) {
    return (
      <DriverPage title="History" kicker="Trip History">
        <EmptyState
          title="No trips yet"
          body="Completed and cancelled trips will appear here."
          action={
            <Link to="/driver/jobs" className="btn btn--primary btn--block">
              Find work
            </Link>
          }
        />
      </DriverPage>
    );
  }

  return (
    <DriverPage title="History" kicker="Trip History">
      <div className="hub-driver__history-list" role="list" aria-label="Trip history">
        {allHistory.map((item) => (
          <DriverHistoryCard key={item.id} item={item} />
        ))}
      </div>
    </DriverPage>
  );
}