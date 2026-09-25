import { useState } from "react";
import { Link } from "react-router-dom";
import { DriverPage } from "../components/DriverPage";
import { EmptyState } from "../components/EmptyState";
import { LoadingState } from "../components/LoadingState";
import { ActiveJobActions } from "../components/ActiveJobActions";
import { ActiveJobCancel } from "../components/ActiveJobCancel";
import { ActiveJobCustomer } from "../components/ActiveJobCustomer";
import { ActiveJobHeader } from "../components/ActiveJobHeader";
import { ActiveJobRoute } from "../components/ActiveJobRoute";
import { JourneySteps } from "../components/JourneySteps";
import { RatingForm } from "../components/RatingForm";
import { RideChat } from "../../legacy/components/RideChat";
import { updateRideStatus } from "../../legacy/lib/rides";
import { formatCentavos } from "../../legacy/lib/fare";
import { useActiveJob } from "../hooks/useActiveJob";
import { useDriverGps } from "../hooks/useDriverGps";
import { useDriverSession } from "../hooks/useDriverSession";
import { useRideChatUnread } from "../hooks/useRideChatUnread";
import { DriverMap } from "../components/DriverMap";
import { GpsStatus } from "../components/GpsStatus";

const NEXT_ACTION: Record<string, { label: string; next: "arrived" | "in_progress" | "completed" }> = {
  accepted: { label: "Arrived", next: "arrived" },
  arrived: { label: "Start ride", next: "in_progress" },
  in_progress: { label: "Complete ride", next: "completed" },
};

function friendlyError(error: unknown): string {
  if (import.meta.env.DEV) console.error("[active-job]", error);
  const message = error instanceof Error ? error.message : "";
  if (/cancel/i.test(message) && /cannot/i.test(message)) {
    return "This ride can no longer change status.";
  }
  return "Couldn't update this job. Check your connection and try again.";
}

/**
 * Hub-native active-job workspace (Ride Now). Presentation only: every
 * mutation delegates to existing engine helpers; backend stays source
 * of truth via useActiveJob (realtime + polling + refresh recovery).
 */
export function ActiveJobPage() {
  const session = useDriverSession();
  const driverId = session.status === "active" ? session.driver.id : null;
  const job = useActiveJob(driverId);
  const [advancing, setAdvancing] = useState(false);
  const [advanceError, setAdvanceError] = useState("");
  const [showChat, setShowChat] = useState(false);
  const [rated, setRated] = useState(false);

  const activeRideId = job.status === "active" ? job.ride.id : null;
  const authUid = session.status === "active" ? session.authUserId : null;
  const trackable =
    job.status === "active" &&
    ["accepted", "arrived", "in_progress"].includes(job.ride.status);
  const gps = useDriverGps({
    rideId: activeRideId,
    authUserId: authUid,
    tracking: trackable,
  });
  const chatBadge = useRideChatUnread({
    rideId: activeRideId,
    chatOpen: showChat,
  });

  if (session.status === "loading" || job.status === "loading") {
    return (
      <DriverPage title="Active" kicker="Current job">
        <LoadingState label="Checking for an active job…" />
      </DriverPage>
    );
  }

  if (session.status !== "active" || !driverId) {
    return (
      <DriverPage title="Active" kicker="Current job">
        <EmptyState
          title="Nothing active"
          body="You'll see your current job here."
          action={
            <Link to="/driver/jobs" className="btn btn--primary btn--block">
              View jobs
            </Link>
          }
        />
      </DriverPage>
    );
  }

  if (job.status === "error") {
    return (
      <DriverPage title="Active" kicker="Current job">
        <div className="hub-driver__card" role="alert">
          <p className="hub-driver__card-title">Couldn't load this job</p>
          <p className="hub-driver__card-sub">{job.error}</p>
          <button
            type="button"
            className="btn btn--ghost btn--block"
            onClick={() => job.retry()}
          >
            Retry
          </button>
        </div>
      </DriverPage>
    );
  }

  if (job.status === "empty") {
    return (
      <DriverPage title="Active" kicker="Current job">
        <EmptyState
          title={job.cancelled ? "Ride cancelled" : "Nothing active"}
          body={
            job.cancelled
              ? "This ride was cancelled. Head back to Jobs for new work."
              : "You'll see your current job here."
          }
          action={
            <Link to="/driver/jobs" className="btn btn--primary btn--block">
              View jobs
            </Link>
          }
        />
      </DriverPage>
    );
  }

  const ride = job.ride;
  const action = NEXT_ACTION[ride.status];

  const advance = async () => {
    if (!action || advancing) return;
    setAdvancing(true);
    setAdvanceError("");
    try {
      await updateRideStatus(ride.id, action.next);
      await job.refresh();
    } catch (err) {
      setAdvanceError(friendlyError(err));
    } finally {
      setAdvancing(false);
    }
  };

  return (
    <DriverPage title="Active" kicker="Current job">
      {job.error ? (
        <p className="form-error-message" role="alert">
          {job.error}{" "}
          <button
            type="button"
            className="link-button"
            onClick={() => job.retry()}
          >
            Retry
          </button>
        </p>
      ) : null}

      <div className="hub-driver__card">
        <ActiveJobHeader status={ride.status} />
        <JourneySteps status={ride.status} />
        <ActiveJobRoute
          pickup={ride.pickup_address}
          destination={ride.destination_address}
        />
        <ActiveJobCustomer
          name={ride.customer_name}
          phone={ride.customer_phone}
        />
        <p className="hub-driver__fare">
          {typeof ride.fare_cents === "number"
            ? `₱${formatCentavos(ride.fare_cents)}`
            : "Fare settled with passenger"}
        </p>

        <DriverMap
          ownFix={gps.ownFix}
          passengerFix={gps.passengerFix}
          pickupLat={ride.pickup_lat}
          pickupLng={ride.pickup_lng}
        />
        <GpsStatus state={trackable ? gps.gpsState : "idle"} note={gps.gpsNote} />

        {action ? (
          <ActiveJobActions
            primaryLabel={action.label}
            onPrimary={() => void advance()}
            busy={advancing}
          >
            <button
              type="button"
              className="hub-driver__linkbtn"
              onClick={() => setShowChat((open) => !open)}
            >
              {showChat ? "Hide chat" : "Chat"}
              {!showChat && chatBadge.unread > 0
                ? ` (${chatBadge.unread} new)`
                : ""}
            </button>
            <ActiveJobCancel
              rideId={ride.id}
              driverId={driverId}
              onCancelled={() => void job.refresh()}
            />
          </ActiveJobActions>
        ) : null}

        {advanceError ? (
          <p className="form-error-message" role="alert">
            {advanceError}
          </p>
        ) : null}

        {ride.status === "completed" && !rated ? (
          <RatingForm
            rideId={ride.id}
            driverId={driverId}
            onDone={() => setRated(true)}
          />
        ) : null}

        {(ride.status === "completed" && rated) ||
        ride.status === "cancelled" ? (
          <Link to="/driver/jobs" className="btn btn--primary btn--block">
            Back to jobs
          </Link>
        ) : null}
      </div>

      {showChat && action ? (
        <div className="hub-legacy">
          <RideChat
            rideId={ride.id}
            otherPartyName={ride.customer_name}
            currentRole="driver"
            currentDriverId={driverId}
            driverAuthId={session.authUserId}
            onClose={() => setShowChat(false)}
          />
        </div>
      ) : null}
    </DriverPage>
  );
}
