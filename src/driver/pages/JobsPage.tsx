import { Link } from "react-router-dom";
import { DriverPage } from "../components/DriverPage";
import { EmptyState } from "../components/EmptyState";
import { LoadingState } from "../components/LoadingState";
import { StatusPill } from "../components/StatusPill";
import { useDriverPresence } from "../hooks/useDriverPresence";
import { useDriverSession } from "../hooks/useDriverSession";

/**
 * Unified Jobs shell (foundation). Presence control is live (existing
 * set_driver_presence RPC); the per-service offer lists land in 6D-3..6D-5.
 */
export function JobsPage() {
  const session = useDriverSession();
  const presence = useDriverPresence();

  if (session.status === "loading") {
    return (
      <DriverPage title="Jobs" kicker="Work">
        <LoadingState label="Checking your session…" />
      </DriverPage>
    );
  }

  if (session.status !== "active") {
    return (
      <DriverPage title="Jobs" kicker="Work">
        <EmptyState
          title={
            session.status === "blocked"
              ? "Account inactive"
              : "Sign in to drive"
          }
          body={
            session.status === "blocked"
              ? "Your driver account is inactive. Contact Bislig Hub to reactivate it."
              : "Use your driver account to receive job offers."
          }
          action={
            <Link to="/driver" className="btn btn--primary btn--block">
              Go to driver sign in
            </Link>
          }
        />
      </DriverPage>
    );
  }

  return (
    <DriverPage title="Jobs" kicker="Work">
      <div className="hub-driver__card hub-driver__presence">
        <div className="hub-driver__presence-row">
          <div>
            <p className="hub-driver__card-title">
              {presence.online ? "You're online" : "You're offline"}
            </p>
            <p className="hub-driver__card-sub">
              {presence.online
                ? "New job offers will appear here."
                : "Go online to start receiving jobs."}
            </p>
          </div>
          <StatusPill tone={presence.online ? "success" : "neutral"}>
            {presence.online ? "Online" : "Offline"}
          </StatusPill>
        </div>
        {presence.error ? (
          <p className="form-error-message" role="alert">
            {presence.error}
          </p>
        ) : null}
        <button
          type="button"
          className={`btn btn--block ${
            presence.online ? "btn--ghost" : "btn--primary"
          }`}
          disabled={presence.transitioning}
          onClick={() =>
            void (presence.online
              ? presence.setOffline()
              : presence.setOnline())
          }
        >
          {presence.transitioning
            ? "Updating…"
            : presence.online
              ? "Go offline"
              : "Go online"}
        </button>
      </div>

      <EmptyState
        title="You're all caught up"
        body="Ride, Pakyawan and delivery offers will show up here when they come in."
      />
    </DriverPage>
  );
}
