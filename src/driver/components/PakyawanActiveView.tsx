import { useState } from "react";
import { Link } from "react-router-dom";
import {
  advancePakyawanStatus,
  setPakyawanDriverPrice,
  type PakyawanTripLifecycleStatus,
} from "../../legacy/lib/scheduledBookings";
import { formatPakyawanTiming } from "../../legacy/lib/scheduledBookings";
import { formatCentavos } from "../../legacy/lib/fare";
import type { PakyawanBooking } from "../../legacy/types/scheduledBooking";
import { PakyawanChat } from "../../legacy/components/PakyawanChat";
import { ActiveJobActions } from "./ActiveJobActions";
import { ActiveJobCustomer } from "./ActiveJobCustomer";
import { ActiveJobHeader } from "./ActiveJobHeader";
import { ActiveJobRoute } from "./ActiveJobRoute";
import { JourneySteps } from "./JourneySteps";
import { PriceProposalCard } from "./PriceProposalCard";

const TRIP_STEPS = ["Scheduled", "On way", "Arrived", "Trip", "Done"];

const TRIP_INDEX: Record<string, number> = {
  scheduled: 0,
  confirmed: 0,
  driver_on_way: 1,
  driver_arrived: 2,
  in_progress: 3,
  completed: 4,
};

const NEXT_ACTION: Record<
  string,
  { label: string; next: PakyawanTripLifecycleStatus }
> = {
  scheduled: { label: "On my way", next: "driver_on_way" },
  driver_on_way: { label: "Arrived", next: "driver_arrived" },
  driver_arrived: { label: "Start trip", next: "in_progress" },
  in_progress: { label: "Complete trip", next: "completed" },
};

const STAGE_LABEL: Record<string, string> = {
  assigned: "Price needed",
  quoted: "Quote sent",
  confirmed: "Confirmed",
  scheduled: "Scheduled",
  driver_on_way: "On the way",
  driver_arrived: "Arrived",
  in_progress: "On trip",
  completed: "Completed",
  cancelled: "Cancelled",
};

function friendlyError(error: unknown): string {
  if (import.meta.env.DEV) console.error("[pakyawan-active]", error);
  return "Couldn't update this trip. Check your connection and try again.";
}

/**
 * Hub-native Pakyawan active view. Mirrors the legacy state machine
 * exactly (assigned → quoted → scheduled → trip chain → completed);
 * every mutation delegates to existing engine helpers.
 */
export function PakyawanActiveView({
  booking,
  onChanged,
}: {
  booking: PakyawanBooking;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [showChat, setShowChat] = useState(false);

  const advance = async (next: PakyawanTripLifecycleStatus) => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await advancePakyawanStatus(booking.id, next);
      await onChanged();
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  };

  const sendPrice = async (priceCents: number) => {
    await setPakyawanDriverPrice(booking.id, priceCents);
    await onChanged();
  };

  const action =
    booking.status === "confirmed"
      ? { label: "On my way", next: "driver_on_way" as const }
      : (NEXT_ACTION[booking.status] ?? null);

  return (
    <div className="hub-driver__card">
      <ActiveJobHeader status={booking.status} service="Pakyawan" />
      <p className="hub-driver__card-sub">
        {STAGE_LABEL[booking.status] ?? booking.status}
      </p>

      {TRIP_INDEX[booking.status] !== undefined ? (
        <JourneySteps
          status={booking.status}
          steps={TRIP_STEPS}
          currentIndex={TRIP_INDEX[booking.status]}
        />
      ) : null}

      <ActiveJobRoute
        pickup={booking.pickup_location}
        destination={booking.destination}
      />

      <dl className="hub-driver__facts">
        <div>
          <dt>Schedule</dt>
          <dd>{formatPakyawanTiming(booking.booking_date, booking.pickup_time)}</dd>
        </div>
        <div>
          <dt>Trip</dt>
          <dd>
            {booking.passengers} passenger{booking.passengers === 1 ? "" : "s"} ·{" "}
            {booking.trip_type}
          </dd>
        </div>
        <div>
          <dt>Price</dt>
          <dd>
            {typeof booking.price_cents === "number"
              ? `₱${formatCentavos(booking.price_cents)}`
              : "Not set"}
          </dd>
        </div>
      </dl>

      <ActiveJobCustomer
        name={booking.customer_name}
        phone={booking.customer_phone}
      />

      {booking.status === "assigned" ? (
        <PriceProposalCard
          label="Your price"
          onSubmit={(cents) => sendPrice(cents)}
        />
      ) : null}

      {booking.status === "quoted" ? (
        <p className="hub-driver__thanks" role="status">
          Price sent — waiting for passenger confirmation.
        </p>
      ) : null}

      {action && booking.status !== "completed" ? (
        <ActiveJobActions
          primaryLabel={action.label}
          onPrimary={() => void advance(action.next)}
          busy={busy}
        >
          <button
            type="button"
            className="hub-driver__linkbtn"
            onClick={() => setShowChat((open) => !open)}
          >
            {showChat ? "Hide chat" : "Chat"}
          </button>
        </ActiveJobActions>
      ) : (
        <button
          type="button"
          className="hub-driver__linkbtn"
          onClick={() => setShowChat((open) => !open)}
        >
          {showChat ? "Hide chat" : "Chat"}
        </button>
      )}

      {error ? (
        <p className="form-error-message" role="alert">
          {error}
        </p>
      ) : null}

      {booking.status === "completed" ? (
        <Link to="/driver/jobs" className="btn btn--primary btn--block">
          Back to jobs
        </Link>
      ) : null}

      {showChat ? (
        <div className="hub-legacy">
          <PakyawanChat
            bookingId={booking.id}
            senderRole="driver"
            otherPartyName={booking.customer_name}
            enableRealtime
            onClose={() => setShowChat(false)}
          />
        </div>
      ) : null}
    </div>
  );
}
