import { Link } from "react-router-dom";
import { DriverPage } from "../components/DriverPage";
import { EmptyState } from "../components/EmptyState";
import { JobCard } from "../components/JobCard";
import { LoadingState } from "../components/LoadingState";
import { useDriverJobs } from "../hooks/useDriverJobs";
import { useDriverPresenceContext } from "../hooks/useDriverPresenceContext";
import { useDriverSession } from "../hooks/useDriverSession";
import { DriverPushControl } from "../components/DriverPushControl";

/**
 * Unified incoming-job workspace. Premium presentation with clear
 * hierarchy: presence → active job → incoming offers → empty state.
 * Every read/mutation delegates to existing engine helpers.
 */
export function JobsPage() {
  const session = useDriverSession();
  const presence = useDriverPresenceContext();

  const driverId = session.status === "active" ? session.driver.id : null;
  const jobs = useDriverJobs({
    driverId,
    online: presence.online,
    canAcceptPakyawan:
      session.status === "active" && session.driver.can_accept_pakyawan,
    canAcceptDeliveries:
      session.status === "active" && session.driver.can_accept_deliveries,
  });

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
            <Link to="/driver/login" className="btn btn--primary btn--block">
              Go to driver sign in
            </Link>
          }
        />
      </DriverPage>
    );
  }

  return (
    <DriverPage title="Jobs" kicker="Work">
      {/* Presence panel */}
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
          <span
            className={`hub-driver__pill ${presence.online ? "is-on" : ""}`}
            aria-label={presence.online ? "Online" : "Offline"}
          >
            <span className="hub-driver__pill-dot" aria-hidden="true" />
            {presence.online ? "Online" : "Offline"}
          </span>
        </div>
        {presence.error ? (
          <p className="form-error-message" role="alert">
            {presence.error}
          </p>
        ) : null}
        <button
          type="button"
          className={`btn btn--block ${presence.online ? "btn--ghost" : "btn--primary"}`}
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

      {presence.online ? <DriverPushControl dismissKey="jobs" /> : null}

      {/* Active job quick link */}
      {jobs.assignedRide ? (
        <div className="hub-driver__card hub-driver__active-job-link">
          <div className="hub-driver__active-job-head">
            <div>
              <p className="hub-driver__card-title">Active job</p>
              <p className="hub-driver__card-sub">
                {jobs.assignedRide.pickup_address} →{" "}
                {jobs.assignedRide.destination_address}
              </p>
            </div>
            <span className="hub-driver__pill is-active">On job</span>
          </div>
          <Link to="/driver/active" className="btn btn--primary btn--block">
            View active job
          </Link>
        </div>
      ) : null}

      {/* Loading / Error / Empty states */}
      {jobs.loading ? (
        <LoadingState label="Checking for new jobs…" />
      ) : null}

      {!jobs.loading && jobs.error ? (
        <div className="hub-driver__card" role="alert">
          <p className="hub-driver__card-title">Couldn't load jobs</p>
          <p className="hub-driver__card-sub">{jobs.error}</p>
          <button
            type="button"
            className="btn btn--ghost btn--block"
            onClick={() => jobs.retry()}
          >
            Retry
          </button>
        </div>
      ) : null}

      {!jobs.loading && !jobs.error && jobs.jobs.length === 0 ? (
        <EmptyState
          title={presence.online ? "You're all caught up" : "You're offline"}
          body={
            presence.online
              ? "New jobs will appear here."
              : "Go online to receive jobs."
          }
        />
      ) : null}

      {jobs.actionError ? (
        <p className="form-error-message" role="alert">
          {jobs.actionError}
        </p>
      ) : null}

      {/* Incoming job cards */}
      {jobs.jobs.map((job) => {
        const declinable = job.offerId !== null && job.kind !== "delivery";
        const dismissable = !declinable;
        return (
          <JobCard
            key={job.key}
            job={job}
            busy={jobs.submittingKey === job.key}
            onAccept={() => void jobs.acceptJob(job)}
            onDecline={declinable ? () => void jobs.declineJob(job) : undefined}
            onDismiss={dismissable ? () => jobs.dismissJob(job) : undefined}
            onExpire={() => jobs.dismissJob(job)}
          />
        );
      })}
    </DriverPage>
  );
}