import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { JourneySteps } from "../components/JourneySteps";
import {
  confirmPakyawanBooking,
  createPakyawanBooking,
  friendlyPakyawanError,
  getPakyawanBooking,
  PAKYAWAN_TRIP_TYPES,
  type PakyawanBooking,
  type PakyawanStatus,
  type PakyawanTripType,
} from "../lib/pakyawan";
import { formatCentavos } from "../lib/fare";
import { isSupabaseConfigured } from "../lib/supabase";

const HUB_PAKYAWAN_PREFIX = "bislig-hub-pakyawan-";
const POLL_MS = 10000;

const TRACK_COPY: Record<
  PakyawanStatus,
  { title: string; next: string; stage: string }
> = {
  pending: {
    title: "Finding a driver",
    next: "Your request is open. This page updates automatically when a driver accepts — no need to resubmit.",
    stage: "Finding a driver",
  },
  assigned: {
    title: "Driver found",
    next: "A driver accepted your trip and is preparing your price. The quote appears below.",
    stage: "Driver found",
  },
  quoted: {
    title: "Price quote ready",
    next: "Review the quote below. Confirm only if you agree — nothing is charged here.",
    stage: "Quote ready",
  },
  confirmed: {
    title: "Booking confirmed",
    next: "Your booking is confirmed and scheduled.",
    stage: "Confirmed",
  },
  scheduled: {
    title: "Booking confirmed — scheduled",
    next: "Your driver will head to your pickup at the scheduled time. Please be ready a few minutes early.",
    stage: "Scheduled",
  },
  driver_on_way: {
    title: "Driver is on the way",
    next: "Please be ready at your pickup location with your things.",
    stage: "Driver on the way",
  },
  driver_arrived: {
    title: "Driver has arrived",
    next: "Meet your driver at the pickup location.",
    stage: "Arrived",
  },
  in_progress: {
    title: "Trip in progress",
    next: "Enjoy your trip around Bislig.",
    stage: "On trip",
  },
  completed: {
    title: "Trip completed",
    next: "Thanks for booking with Bislig Hub.",
    stage: "Done",
  },
  cancelled: {
    title: "Booking cancelled",
    next: "This booking was cancelled. You can make a new request anytime.",
    stage: "Closed",
  },
};

const PAKYAWAN_JOURNEY = [
  { label: "Finding driver" },
  { label: "Quote" },
  { label: "Confirmed" },
  { label: "Trip day" },
  { label: "Done" },
];

function journeyIndex(status: PakyawanStatus): number {
  switch (status) {
    case "pending":
      return 0;
    case "assigned":
    case "quoted":
      return 1;
    case "confirmed":
    case "scheduled":
      return 2;
    case "driver_on_way":
    case "driver_arrived":
    case "in_progress":
      return 3;
    case "completed":
      return 4;
    default:
      return 0;
  }
}

function activityState(status: PakyawanStatus): {
  label: string;
  tone: "active" | "closed";
} {
  if (status === "completed" || status === "cancelled")
    return { label: "Closed", tone: "closed" };
  return { label: "Booking active", tone: "active" };
}

const ACTIVE_STATUSES: PakyawanStatus[] = [
  "pending",
  "assigned",
  "quoted",
  "confirmed",
  "scheduled",
  "driver_on_way",
  "driver_arrived",
  "in_progress",
];

function getToday(): string {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - offset).toISOString().split("T")[0];
}

function readStoredIdentities(): Array<{ id: string; token: string }> {
  const out: Array<{ id: string; token: string }> = [];
  try {
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i);
      if (!key?.startsWith(HUB_PAKYAWAN_PREFIX)) continue;
      const token = window.localStorage.getItem(key);
      if (token) out.push({ id: key.slice(HUB_PAKYAWAN_PREFIX.length), token });
    }
  } catch {
    // Private browsing — no restore.
  }
  return out;
}

export function Pakyawan() {
  const [step, setStep] = useState(1);
  const [timing, setTiming] = useState<"now" | "scheduled">("now");
  const [bookingDate, setBookingDate] = useState("");
  const [pickupTime, setPickupTime] = useState("");
  const [pickupLocation, setPickupLocation] = useState("");
  const [destination, setDestination] = useState("");
  const [passengers, setPassengers] = useState("1");
  const [tripType, setTripType] = useState<PakyawanTripType | "">("");
  const [estimatedHours, setEstimatedHours] = useState("");
  const [specialRequests, setSpecialRequests] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [identity, setIdentity] = useState<{
    id: string;
    token: string;
  } | null>(null);
  const [booking, setBooking] = useState<PakyawanBooking | null>(null);
  const [trackingError, setTrackingError] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState("");
  const [restoring, setRestoring] = useState(true);
  const [restored, setRestored] = useState(false);
  const pollRef = useRef<number | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current !== null) {
      window.clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const refresh = useCallback(
    async (id: string, token: string, quiet: boolean) => {
      try {
        const latest = await getPakyawanBooking(id, token);
        setBooking((current) => {
          if (
            current &&
            current.status === latest.status &&
            current.price_cents === latest.price_cents &&
            current.driver_id === latest.driver_id &&
            current.updated_at === latest.updated_at
          ) {
            return current;
          }
          return latest;
        });
        if (!quiet) setTrackingError("");
      } catch (err) {
        if (!quiet) {
          setTrackingError(
            friendlyPakyawanError(err, "Could not refresh this booking.")
          );
        }
      }
    },
    []
  );

  // Restore a Hub pakyawan booking on mount.
  useEffect(() => {
    if (!isSupabaseConfigured) {
      setRestoring(false);
      return;
    }
    let cancelled = false;
    (async () => {
      for (const candidate of readStoredIdentities()) {
        try {
          const found = await getPakyawanBooking(
            candidate.id,
            candidate.token
          );
          if (cancelled) return;
          if (ACTIVE_STATUSES.includes(found.status)) {
            setIdentity({ id: candidate.id, token: candidate.token });
            setBooking(found);
            setRestored(true);
            setRestoring(false);
            return;
          }
          try {
            window.localStorage.removeItem(
              `${HUB_PAKYAWAN_PREFIX}${candidate.id}`
            );
          } catch {
            // ignore
          }
        } catch {
          // Invalid token — drop it and try the next candidate.
          try {
            window.localStorage.removeItem(
              `${HUB_PAKYAWAN_PREFIX}${candidate.id}`
            );
          } catch {
            // ignore
          }
        }
      }
      if (!cancelled) setRestoring(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // 10-second polling while the booking is active (no realtime in Phase 4).
  useEffect(() => {
    if (!identity || !booking) return;
    if (!ACTIVE_STATUSES.includes(booking.status)) return;
    stopPolling();
    pollRef.current = window.setInterval(
      () => void refresh(identity.id, identity.token, true),
      POLL_MS
    );
    return stopPolling;
  }, [identity, booking?.status, refresh, stopPolling]);

  const validateStep = (target: number): boolean => {
    const next: Record<string, string> = {};
    if (target === 1 && timing === "scheduled") {
      if (!bookingDate) next.bookingDate = "Trip date is required.";
      else if (bookingDate < getToday())
        next.bookingDate = "Choose a future date.";
      if (!pickupTime) next.pickupTime = "Pickup time is required.";
      if (bookingDate && pickupTime) {
        const when = new Date(`${bookingDate}T${pickupTime}`);
        if (Number.isFinite(when.getTime()) && when <= new Date()) {
          next.pickupTime = "Choose a future time.";
        }
      }
    }
    if (target === 2) {
      if (!pickupLocation.trim()) next.pickupLocation = "Pickup is required.";
      if (!destination.trim()) next.destination = "Destination is required.";
      if (!tripType) next.tripType = "Trip type is required.";
      if (!passengers.trim()) next.passengers = "Passengers is required.";
      else if (!/^\d+$/.test(passengers.trim()) || Number(passengers) < 1) {
        next.passengers = "Enter at least 1 passenger.";
      }
    }
    if (target === 3) {
      if (
        estimatedHours &&
        (!/^\d+$/.test(estimatedHours) || Number(estimatedHours) < 1)
      ) {
        next.estimatedHours = "Enter valid hours.";
      }
      if (!customerName.trim()) next.customerName = "Your name is required.";
      if (!customerPhone.trim())
        next.customerPhone = "Phone number is required.";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (step < 3) {
      if (validateStep(step)) setStep(step + 1);
      return;
    }
    if (!validateStep(1) || !validateStep(2) || !validateStep(3)) return;
    if (submitting || !isSupabaseConfigured) return;
    setSubmitting(true);
    setSubmitError("");
    try {
      const created = await createPakyawanBooking({
        customer_name: customerName.trim(),
        customer_phone: customerPhone.trim(),
        booking_date: timing === "scheduled" ? bookingDate : null,
        pickup_time: timing === "scheduled" ? pickupTime : null,
        pickup_location: pickupLocation.trim(),
        destination: destination.trim(),
        passengers: Number(passengers),
        trip_type: tripType as PakyawanTripType,
        estimated_hours: estimatedHours ? Number(estimatedHours) : null,
        special_requests: specialRequests.trim() || null,
      });
      try {
        window.localStorage.setItem(
          `${HUB_PAKYAWAN_PREFIX}${created.id}`,
          created.accessToken
        );
      } catch {
        // Private browsing — tracking lasts for this session only.
      }
      setIdentity({ id: created.id, token: created.accessToken });
      // Optimistic shell until the first poll resolves the real row.
      setBooking({
        id: created.id,
        customer_id: null,
        customer_name: customerName.trim(),
        customer_phone: customerPhone.trim(),
        booking_date: timing === "scheduled" ? bookingDate : null,
        pickup_time: timing === "scheduled" ? pickupTime : null,
        pickup_location: pickupLocation.trim(),
        destination: destination.trim(),
        passengers: Number(passengers),
        trip_type: tripType as PakyawanTripType,
        estimated_hours: estimatedHours ? Number(estimatedHours) : null,
        special_requests: specialRequests.trim() || null,
        status: "pending",
        driver_id: null,
        price_cents: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      await refresh(created.id, created.accessToken, false);
    } catch (err) {
      setSubmitError(
        friendlyPakyawanError(err, "Could not submit your request.")
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirm = async () => {
    if (!identity || confirming) return;
    setConfirming(true);
    setConfirmError("");
    try {
      const confirmed = await confirmPakyawanBooking(
        identity.id,
        identity.token
      );
      setBooking(confirmed);
    } catch (err) {
      setConfirmError(
        friendlyPakyawanError(err, "Could not confirm this booking.")
      );
    } finally {
      setConfirming(false);
    }
  };

  const startOver = () => {
    stopPolling();
    setIdentity(null);
    setBooking(null);
    setStep(1);
    setRestored(false);
    setSubmitError("");
    setConfirmError("");
    setTrackingError("");
  };

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

  if (restoring) {
    return (
      <div className="container">
        <div className="loading-block" aria-live="polite">
          <span className="spinner" aria-hidden="true" />
          <p>Checking your booking…</p>
        </div>
      </div>
    );
  }

  // ---- Tracking view ----
  if (identity && booking) {
    const copy = TRACK_COPY[booking.status];
    const quoted =
      booking.status === "quoted" &&
      typeof booking.price_cents === "number";
    const activity = activityState(booking.status);
    const showJourney = booking.status !== "cancelled";
    return (
      <div className="container">
        {restored && (
          <div className="restore-banner" role="status">
            <strong>Your Pakyawan booking</strong>
            <span>Picking up right where you left off.</span>
          </div>
        )}
        <section className="status-card" aria-live="polite">
          <p className="status-card__kicker">Pakyawan · {copy.stage}</p>
          <div>
            <span className={`activity-pill activity-pill--${activity.tone}`}>
              {activity.label}
            </span>
          </div>
          <h1 className="status-card__title">{copy.title}</h1>
          <p className="status-card__text">{copy.next}</p>

          {showJourney && (
            <JourneySteps
              stages={PAKYAWAN_JOURNEY}
              currentIndex={journeyIndex(booking.status)}
              ariaLabel="Booking progress"
            />
          )}

          <dl className="status-card__route">
            <div>
              <dt>Pickup</dt>
              <dd>{booking.pickup_location}</dd>
            </div>
            <div>
              <dt>Destination</dt>
              <dd>{booking.destination}</dd>
            </div>
            <div>
              <dt>When</dt>
              <dd>
                {booking.booking_date
                  ? `${booking.booking_date}${booking.pickup_time ? ` · ${booking.pickup_time}` : ""}`
                  : "ASAP"}
              </dd>
            </div>
            <div>
              <dt>Trip</dt>
              <dd>
                {booking.trip_type} · {booking.passengers} passenger
                {booking.passengers === 1 ? "" : "s"}
              </dd>
            </div>
          </dl>

          <div className="fare-box" aria-live="polite">
            <span className="field-label">Price quote</span>
            {quoted ? (
              <>
                <strong>₱{formatCentavos(booking.price_cents as number)}</strong>
                <small>
                  Quoted for this trip · {booking.passengers} passenger
                  {booking.passengers === 1 ? "" : "s"} · {booking.trip_type}
                </small>
              </>
            ) : (
              <>
                <strong>Awaiting quote</strong>
                <small>
                  {booking.status === "pending" || booking.status === "assigned"
                    ? "No price yet — a driver sends it after accepting"
                    : "No price was set for this booking"}
                </small>
              </>
            )}
          </div>

          {booking.status === "quoted" && (
            <>
              {confirmError && (
                <p className="form-error-message" role="alert">
                  {confirmError}
                </p>
              )}
              <div className="status-card__actions">
                <button
                  type="button"
                  className="btn btn--primary btn--block"
                  onClick={() => void handleConfirm()}
                  disabled={confirming}
                >
                  {confirming ? "Confirming…" : "Confirm Booking"}
                </button>
              </div>
            </>
          )}

          {trackingError && (
            <p className="form-error-message" role="alert">
              {trackingError}{" "}
              <button
                type="button"
                className="link-button"
                onClick={() => void refresh(identity.id, identity.token, false)}
              >
                Retry
              </button>
            </p>
          )}

          <div className="status-card__actions">
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => void refresh(identity.id, identity.token, false)}
            >
              Refresh status
            </button>
            {!ACTIVE_STATUSES.includes(booking.status) && (
              <button
                type="button"
                className="btn btn--primary"
                onClick={startOver}
              >
                New request
              </button>
            )}
          </div>
          <p className="form-footnote">
            Updates automatically every few seconds. Keep this screen open —
            your booking is saved on this device.
          </p>
        </section>
      </div>
    );
  }

  // ---- Form view ----
  return (
    <div className="container">
      <nav aria-label="Back">
        <Link to="/" className="back-link">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Back to Home
        </Link>
      </nav>

      <header className="form-header">
        <p className="form-header__kicker">Transport · Pakyawan</p>
        <h1 className="form-header__title">Book a vehicle</h1>
        <p className="form-header__subtitle">
          For longer trips or private use.{" "}
          {step === 1
            ? "First, when do you need the vehicle?"
            : step === 2
              ? "Now the trip details."
              : "Lastly, how do we reach you?"}
        </p>
      </header>

      <div className="wizard-progress" aria-label={`Step ${step} of 3`}>
        <div className="flow-progress" role="presentation">
          {[1, 2, 3].map((n) => (
            <span
              key={n}
              className={`flow-progress-step${step === n ? " is-current" : ""}${step > n ? " is-done" : ""}`}
            >
              {step > n ? "✓" : `0${n}`}
            </span>
          ))}
        </div>
        <span className="wizard-step-label">
          {step === 1
            ? "Step 1 — Schedule"
            : step === 2
              ? "Step 2 — Trip details"
              : "Step 3 — Contact details"}
        </span>
      </div>

      <form className="booking-form" onSubmit={(e) => void handleSubmit(e)} noValidate>
        {step === 1 && (
          <>
            <div className="timing-row" role="group" aria-label="When do you need the vehicle?">
              <button
                type="button"
                className={`timing-choice${timing === "now" ? " is-active" : ""}`}
                onClick={() => setTiming("now")}
              >
                ASAP
              </button>
              <button
                type="button"
                className={`timing-choice${timing === "scheduled" ? " is-active" : ""}`}
                onClick={() => setTiming("scheduled")}
              >
                Scheduled
              </button>
            </div>
            {timing === "scheduled" && (
              <div className="form-row">
                <label className="field-block">
                  <span className="field-label">Trip date</span>
                  <input
                    className={`input-field${errors.bookingDate ? " has-error" : ""}`}
                    type="date"
                    value={bookingDate}
                    min={getToday()}
                    onChange={(e) => {
                      setBookingDate(e.target.value);
                      setErrors((c) => ({ ...c, bookingDate: "" }));
                    }}
                  />
                  {errors.bookingDate && (
                    <span className="field-error">{errors.bookingDate}</span>
                  )}
                </label>
                <label className="field-block">
                  <span className="field-label">Pickup time</span>
                  <input
                    className={`input-field${errors.pickupTime ? " has-error" : ""}`}
                    type="time"
                    value={pickupTime}
                    onChange={(e) => {
                      setPickupTime(e.target.value);
                      setErrors((c) => ({ ...c, pickupTime: "" }));
                    }}
                  />
                  {errors.pickupTime && (
                    <span className="field-error">{errors.pickupTime}</span>
                  )}
                </label>
              </div>
            )}
          </>
        )}

        {step === 2 && (
          <>
            <label className="field-block">
              <span className="field-label">Pickup location</span>
              <input
                className={`input-field${errors.pickupLocation ? " has-error" : ""}`}
                type="text"
                placeholder="e.g. Bislig City Hall"
                value={pickupLocation}
                onChange={(e) => {
                  setPickupLocation(e.target.value);
                  setErrors((c) => ({ ...c, pickupLocation: "" }));
                }}
                autoComplete="off"
              />
              {errors.pickupLocation && (
                <span className="field-error">{errors.pickupLocation}</span>
              )}
            </label>
            <label className="field-block">
              <span className="field-label">Destination</span>
              <input
                className={`input-field${errors.destination ? " has-error" : ""}`}
                type="text"
                placeholder="e.g. Hinatuan Enchanted River"
                value={destination}
                onChange={(e) => {
                  setDestination(e.target.value);
                  setErrors((c) => ({ ...c, destination: "" }));
                }}
                autoComplete="off"
              />
              {errors.destination && (
                <span className="field-error">{errors.destination}</span>
              )}
            </label>
            <div className="form-row">
              <label className="field-block">
                <span className="field-label">Passengers</span>
                <input
                  className={`input-field${errors.passengers ? " has-error" : ""}`}
                  type="text"
                  inputMode="numeric"
                  value={passengers}
                  onChange={(e) => {
                    setPassengers(e.target.value.replace(/[^0-9]/g, ""));
                    setErrors((c) => ({ ...c, passengers: "" }));
                  }}
                />
                {errors.passengers && (
                  <span className="field-error">{errors.passengers}</span>
                )}
              </label>
              <label className="field-block">
                <span className="field-label">Trip type</span>
                <select
                  className={`input-field${errors.tripType ? " has-error" : ""}`}
                  value={tripType}
                  onChange={(e) => {
                    setTripType(e.target.value as PakyawanTripType);
                    setErrors((c) => ({ ...c, tripType: "" }));
                  }}
                >
                  <option value="">Select…</option>
                  {PAKYAWAN_TRIP_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
                {errors.tripType && (
                  <span className="field-error">{errors.tripType}</span>
                )}
              </label>
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <label className="field-block">
              <span className="field-label">
                Estimated hours <span className="optional-tag">(optional)</span>
              </span>
              <input
                className={`input-field${errors.estimatedHours ? " has-error" : ""}`}
                type="text"
                inputMode="numeric"
                placeholder="e.g. 4"
                value={estimatedHours}
                onChange={(e) => {
                  setEstimatedHours(e.target.value.replace(/[^0-9]/g, ""));
                  setErrors((c) => ({ ...c, estimatedHours: "" }));
                }}
              />
              {errors.estimatedHours && (
                <span className="field-error">{errors.estimatedHours}</span>
              )}
            </label>
            <label className="field-block">
              <span className="field-label">
                Special requests <span className="optional-tag">(optional)</span>
              </span>
              <textarea
                className="input-field textarea-field"
                placeholder="Stops, luggage, anything the driver should know…"
                value={specialRequests}
                onChange={(e) => setSpecialRequests(e.target.value)}
              />
            </label>
            <label className="field-block">
              <span className="field-label">Your name</span>
              <input
                className={`input-field${errors.customerName ? " has-error" : ""}`}
                type="text"
                placeholder="Full name"
                value={customerName}
                onChange={(e) => {
                  setCustomerName(e.target.value);
                  setErrors((c) => ({ ...c, customerName: "" }));
                }}
                autoComplete="name"
              />
              {errors.customerName && (
                <span className="field-error">{errors.customerName}</span>
              )}
            </label>
            <label className="field-block">
              <span className="field-label">Phone number</span>
              <input
                className={`input-field${errors.customerPhone ? " has-error" : ""}`}
                type="tel"
                placeholder="09xx xxx xxxx"
                value={customerPhone}
                onChange={(e) => {
                  setCustomerPhone(e.target.value);
                  setErrors((c) => ({ ...c, customerPhone: "" }));
                }}
                autoComplete="tel"
              />
              {errors.customerPhone && (
                <span className="field-error">{errors.customerPhone}</span>
              )}
            </label>
          </>
        )}

        {submitError && (
          <p className="form-error-message" role="alert">
            {submitError}
          </p>
        )}

        <div className="form-actions">
          {step < 3 ? (
            <button type="submit" className="btn btn--primary btn--block">
              Continue →
            </button>
          ) : (
            <button
              type="submit"
              className="btn btn--primary btn--block"
              disabled={submitting}
            >
              {submitting ? "Submitting…" : "Submit request →"}
            </button>
          )}
          {step > 1 ? (
            <button
              type="button"
              className="link-button"
              onClick={() => setStep(step - 1)}
            >
              ← Back
            </button>
          ) : (
            <Link to="/" className="link-button">
              ← Back home
            </Link>
          )}
        </div>
        {step === 3 && (
          <p className="form-footnote">
            A driver will send a price quote. You confirm only if you agree —
            no payment here.
          </p>
        )}
      </form>
    </div>
  );
}
