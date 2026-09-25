import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { JourneySteps } from "../components/JourneySteps";
import { MapView } from "../legacy/components/MapView";
import { RideChat } from "../legacy/components/RideChat";
import {
  startRideLocationWatch,
  subscribeToRideLocation,
} from "../legacy/lib/rideLocation";
import { subscribeToRideCancellations } from "../legacy/lib/rideCancellations";
import {
  cancelRide,
  createRide,
  dispatchRide,
  fetchDriverProfile,
  fetchRideById,
  friendlyRideError,
  hasRatedRide,
  submitRideRating,
  subscribeToRideStatus,
  type DriverProfile,
  type Ride,
  type RideStatus,
  type VehicleType,
} from "../lib/rides";
import {
  DEFAULT_FARE_LEVEL,
  computeFare,
  formatCentavos,
  type PassengerType,
} from "../lib/fare";
import {
  getCustomerAuthId,
  isSupabaseConfigured,
  requireSupabase,
} from "../lib/supabase";

const HUB_RIDE_KEY = "bislig-hub-last-ride-id";
const HUB_SHARE_KEY = "bislig-hub-share-";
const POLL_MS = 5000;
const REDISPATCH_MS = 20000;
const REDISPATCH_MAX = 10;

const ACTIVE_TRACK_STATUSES: RideStatus[] = [
  "accepted",
  "arrived",
  "in_progress",
];

type CancelNotice = {
  cancelled_by_role: string;
  reason: string;
};

type Phase =
  | "form"
  | "submitting"
  | "searching"
  | "no_driver"
  | "accepted"
  | "arrived"
  | "in_progress"
  | "completed"
  | "cancelled";

const CANCELLABLE: RideStatus[] = [
  "requested",
  "accepted",
  "arrived",
  "in_progress",
];

// Restorable on reload: still actionable. Completed/cancelled are terminal —
// the stored key is cleared when they are observed so old journeys never
// reappear as active.
const RESTORABLE: RideStatus[] = [
  "requested",
  "accepted",
  "arrived",
  "in_progress",
  "no_driver",
];

function statusToPhase(status: RideStatus): Phase {
  switch (status) {
    case "requested":
      return "searching";
    case "no_driver":
      return "no_driver";
    case "accepted":
      return "accepted";
    case "arrived":
      return "arrived";
    case "in_progress":
      return "in_progress";
    case "completed":
      return "completed";
    case "cancelled":
      return "cancelled";
  }
}

const PHASE_COPY: Record<
  Exclude<Phase, "form" | "submitting">,
  { title: string; next: string; stage: string }
> = {
  searching: {
    title: "Finding a nearby driver",
    next: "We're asking nearby drivers. This usually takes a few seconds — stay on this screen.",
    stage: "Finding a driver",
  },
  no_driver: {
    title: "No driver is available right now",
    next: "Your request is saved. Nobody is available at the moment — try again shortly, or close and book later.",
    stage: "Paused",
  },
  accepted: {
    title: "Driver accepted your ride",
    next: "Your driver is on the way. Please head to your pickup point and keep your phone nearby.",
    stage: "Driver on the way",
  },
  arrived: {
    title: "Your driver has arrived",
    next: "Meet your driver at the pickup point. Check the vehicle details below before getting in.",
    stage: "Arrived",
  },
  in_progress: {
    title: "Ride in progress",
    next: "You're on your way. Your driver is taking you to your destination.",
    stage: "On trip",
  },
  completed: {
    title: "Ride completed",
    next: "Thanks for riding with Bislig Hub. Book again anytime.",
    stage: "Done",
  },
  cancelled: {
    title: "Ride cancelled",
    next: "This ride was cancelled. You can book a new ride anytime.",
    stage: "Closed",
  },
};

const RIDE_JOURNEY = [
  { label: "Finding driver" },
  { label: "Driver on way" },
  { label: "Arrived" },
  { label: "On trip" },
  { label: "Done" },
];

function journeyIndex(phase: Phase): number {
  switch (phase) {
    case "searching":
    case "no_driver":
      return 0;
    case "accepted":
      return 1;
    case "arrived":
      return 2;
    case "in_progress":
      return 3;
    case "completed":
      return 4;
    default:
      return 0;
  }
}

function activityState(
  phase: Phase
): { label: string; tone: "active" | "paused" | "closed" } {
  if (phase === "no_driver") return { label: "Paused", tone: "paused" };
  if (phase === "completed" || phase === "cancelled")
    return { label: "Closed", tone: "closed" };
  return { label: "Request active", tone: "active" };
}

const CANCEL_REASONS = [
  "Changed my plans",
  "Waited too long",
  "Wrong pickup or destination",
  "Booked by mistake",
] as const;

function readStoredRideId(): string | null {
  try {
    return window.localStorage.getItem(HUB_RIDE_KEY);
  } catch {
    return null;
  }
}

function writeStoredRideId(id: string | null) {
  try {
    if (id) window.localStorage.setItem(HUB_RIDE_KEY, id);
    else window.localStorage.removeItem(HUB_RIDE_KEY);
  } catch {
    // Private browsing — tracking lasts for this session only.
  }
}

export function RideNow() {
  const [phase, setPhase] = useState<Phase>("form");
  const [ride, setRide] = useState<Ride | null>(null);
  const [driver, setDriver] = useState<DriverProfile | null>(null);

  const [pickup, setPickup] = useState("");
  const [destination, setDestination] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [passengerCount, setPassengerCount] = useState(1);
  const [passengerType, setPassengerType] = useState<PassengerType>("Regular");
  const [vehicleType, setVehicleType] =
    useState<VehicleType>("tricycle");
  const [pickupCoords, setPickupCoords] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState("");

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState("");
  const [retrying, setRetrying] = useState(false);
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [cancelReason, setCancelReason] = useState<string>(CANCEL_REASONS[0]);
  const [cancelling, setCancelling] = useState(false);
  const [restoring, setRestoring] = useState(true);
  const [restored, setRestored] = useState(false);
  const [formStep, setFormStep] = useState(1);
  const [stars, setStars] = useState(0);
  const [ratingComment, setRatingComment] = useState("");
  const [ratingState, setRatingState] = useState<
    "idle" | "checking" | "ready" | "sending" | "sent" | "already"
  >("idle");
  const [ratingError, setRatingError] = useState("");
  const [customerAuthId, setCustomerAuthId] = useState<string | null>(null);
  const [showChat, setShowChat] = useState(false);
  const [chatUnread, setChatUnread] = useState(0);
  const [driverLocation, setDriverLocation] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [sharingLocation, setSharingLocation] = useState(false);
  const [livePassengerLoc, setLivePassengerLoc] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [shareError, setShareError] = useState("");
  const [cancelNotice, setCancelNotice] = useState<CancelNotice | null>(null);
  const pollRef = useRef<number | null>(null);
  const redispatchRef = useRef<number | null>(null);
  const redispatchAttemptsRef = useRef(0);
  const redispatchBusyRef = useRef(false);
  const handledChatIdsRef = useRef<Set<string>>(new Set());

  const fareQuote = useMemo(() => {
    if (!destination.trim()) return null;
    return computeFare({
      destination: destination.trim(),
      destinationMode: "same",
      passengerType,
      fuelLevel: DEFAULT_FARE_LEVEL,
      distanceKm: null,
    });
  }, [destination, passengerType]);

  const stopPolling = useCallback(() => {
    if (pollRef.current !== null) {
      window.clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const stopRedispatch = useCallback(() => {
    if (redispatchRef.current !== null) {
      window.clearInterval(redispatchRef.current);
      redispatchRef.current = null;
    }
    redispatchBusyRef.current = false;
  }, []);

  const clearLocalRide = useCallback(() => {
    stopPolling();
    stopRedispatch();
    writeStoredRideId(null);
    setRide(null);
    setDriver(null);
    setPhase("form");
    setFormStep(1);
    setRestored(false);
    setStars(0);
    setRatingComment("");
    setRatingState("idle");
    setRatingError("");
    setSubmitError("");
    setConfirmingCancel(false);
    setShowChat(false);
    setChatUnread(0);
    setDriverLocation(null);
    setSharingLocation(false);
    setLivePassengerLoc(null);
    setShareError("");
    setCancelNotice(null);
    handledChatIdsRef.current = new Set();
    redispatchAttemptsRef.current = 0;
  }, [stopPolling, stopRedispatch]);

  const syncRide = useCallback(
    async (rideId: string) => {
      try {
        const latest = await fetchRideById(rideId);
        if (!latest) {
          clearLocalRide();
          return;
        }
        setRide(latest);
        setPhase(statusToPhase(latest.status));
        if (latest.status === "cancelled" || latest.status === "completed") {
          // Terminal: keep the in-session view, but stop resurrecting it.
          writeStoredRideId(null);
          stopPolling();
        }
      } catch (err) {
        if (import.meta.env.DEV) console.error("[bislig-hub] ride sync", err);
      }
    },
    [clearLocalRide, stopPolling]
  );

  // Restore an in-progress Hub ride on mount.
  useEffect(() => {
    const stored = readStoredRideId();
    if (!stored || !isSupabaseConfigured) {
      setRestoring(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const latest = await fetchRideById(stored);
        if (cancelled) return;
        if (!latest || !RESTORABLE.includes(latest.status)) {
          // Terminal or missing: never resurrect as an active journey.
          writeStoredRideId(null);
        } else {
          setRide(latest);
          setPhase(statusToPhase(latest.status));
          // Resumed from this device: orient the customer explicitly.
          setRestored(true);
          try {
            setCustomerAuthId(await getCustomerAuthId());
            if (
              window.localStorage.getItem(`${HUB_SHARE_KEY}${latest.id}`) ===
              "1"
            ) {
              setSharingLocation(true);
            }
          } catch {
            // Session/share restore is best-effort only.
          }
        }
      } catch {
        // Offline or expired session — stay on the form.
      } finally {
        if (!cancelled) setRestoring(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Realtime + polling while tracking an active ride.
  useEffect(() => {
    if (!ride || phase === "form" || phase === "submitting") return;
    if (ride.status === "completed" || ride.status === "cancelled") return;

    const unsubscribe = subscribeToRideStatus(ride.id, () =>
      void syncRide(ride.id)
    );
    stopPolling();
    pollRef.current = window.setInterval(() => void syncRide(ride.id), POLL_MS);
    return () => {
      unsubscribe();
      stopPolling();
    };
  }, [ride?.id, phase, syncRide, stopPolling]);

  // Load assigned driver profile.
  useEffect(() => {
    if (!ride?.driver_id) {
      setDriver(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const profile = await fetchDriverProfile(ride.driver_id as string);
        if (!cancelled) setDriver(profile);
      } catch {
        if (!cancelled) setDriver(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ride?.driver_id]);

  // Live driver GPS while the trip is active (broadcast channel).
  useEffect(() => {
    if (
      !ride?.id ||
      !ride.driver_id ||
      !customerAuthId ||
      !ACTIVE_TRACK_STATUSES.includes(ride.status)
    ) {
      setDriverLocation(null);
      return;
    }
    return subscribeToRideLocation(ride.id, (message) => {
      if (message.user === customerAuthId) return;
      setDriverLocation({
        lat: message.latitude,
        lng: message.longitude,
      });
    });
  }, [ride?.id, ride?.driver_id, ride?.status, customerAuthId]);

  // Passenger live-location broadcast (opt-in per ride, persisted).
  useEffect(() => {
    if (
      !ride?.id ||
      !customerAuthId ||
      !sharingLocation ||
      !ACTIVE_TRACK_STATUSES.includes(ride.status)
    ) {
      return;
    }
    return startRideLocationWatch(ride.id, {
      user: customerAuthId,
      onLocation: (latitude, longitude) => {
        setLivePassengerLoc({ lat: latitude, lng: longitude });
        setShareError("");
      },
      onError: () => {
        setShareError("Live location is off. Your driver sees only your pickup point.");
      },
    });
  }, [ride?.id, ride?.status, customerAuthId, sharingLocation]);

  // Chat unread badge (driver messages only, deduped).
  useEffect(() => {
    if (!ride?.id || !ride.driver_id || !ACTIVE_TRACK_STATUSES.includes(ride.status)) {
      return;
    }
    const client = requireSupabase();
    const channel = client
      .channel(`hub-ride-chat-${ride.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "ride_messages",
          filter: `ride_id=eq.${ride.id}`,
        },
        (payload: { new: { id?: string; sender_role?: string } }) => {
          const incoming = payload.new;
          if (
            !incoming?.id ||
            incoming.sender_role !== "driver" ||
            handledChatIdsRef.current.has(incoming.id)
          ) {
            return;
          }
          handledChatIdsRef.current.add(incoming.id);
          if (!showChat) setChatUnread((current) => current + 1);
        }
      )
      .subscribe();
    return () => {
      void client.removeChannel(channel);
    };
  }, [ride?.id, ride?.driver_id, ride?.status, showChat]);

  // Counterparty cancellation notice (reason + realtime, beyond polling).
  useEffect(() => {
    if (
      !ride?.id ||
      !["requested", "accepted", "arrived", "in_progress"].includes(ride.status)
    ) {
      return;
    }
    return subscribeToRideCancellations(ride.id, (incoming) => {
      if (incoming.cancelled_by === customerAuthId) return;
      setCancelNotice({
        cancelled_by_role: incoming.cancelled_by_role,
        reason: incoming.reason,
      });
      void syncRide(ride.id);
    });
  }, [ride?.id, ride?.status, customerAuthId, syncRide]);

  // Keep searching: bounded auto-redispatch while requested (mirrors the
  // proven dispatch-keepalive; manual Try Again remains available).
  useEffect(() => {
    if (phase !== "searching" || !ride || ride.status !== "requested") {
      stopRedispatch();
      return;
    }
    redispatchAttemptsRef.current = 0;
    stopRedispatch();
    redispatchRef.current = window.setInterval(() => {
      if (
        redispatchBusyRef.current ||
        redispatchAttemptsRef.current >= REDISPATCH_MAX
      ) {
        if (redispatchAttemptsRef.current >= REDISPATCH_MAX) stopRedispatch();
        return;
      }
      redispatchBusyRef.current = true;
      redispatchAttemptsRef.current += 1;
      dispatchRide(ride.id)
        .then((result) => {
          if (result.ride_status === "no_driver") {
            setPhase("no_driver");
            stopRedispatch();
          } else {
            void syncRide(ride.id);
          }
        })
        .catch(() => {
          // Silent: polling + manual retry still cover the journey.
        })
        .finally(() => {
          redispatchBusyRef.current = false;
        });
    }, REDISPATCH_MS);
    return stopRedispatch;
  }, [phase, ride?.id, ride?.status, syncRide, stopRedispatch]);

  // Determine rating prompt state once a ride completes.
  useEffect(() => {
    if (!ride || ride.status !== "completed" || !ride.driver_id) return;
    if (
      typeof ride.rating === "number" &&
      ride.rating >= 1 &&
      ride.rating <= 5
    ) {
      setRatingState("already");
      return;
    }
    let cancelled = false;
    setRatingState("checking");
    (async () => {
      try {
        const authId = await getCustomerAuthId();
        if (cancelled) return;
        setRatingState(
          (await hasRatedRide(ride.id, authId)) ? "already" : "ready"
        );
      } catch {
        // Rating is optional: a failed check must never block the screen.
        if (!cancelled) setRatingState("ready");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ride?.id, ride?.status]);

  const useMyLocation = () => {
    if (!("geolocation" in navigator)) {
      setLocationError("Location is not supported on this device.");
      return;
    }
    setLocating(true);
    setLocationError("");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        if (pos.coords.accuracy > 300) {
          setLocationError(
            `Location is too imprecise (±${Math.round(pos.coords.accuracy)}m). Please type your pickup.`
          );
          return;
        }
        setPickupCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setPickup((current) =>
          current.trim() ? current : "My current location"
        );
      },
      (err) => {
        setLocating(false);
        setLocationError(
          err.code === err.PERMISSION_DENIED
            ? "Location permission denied. Please type your pickup."
            : "Could not get your location. Please type your pickup."
        );
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 }
    );
  };

  const validateRoute = (): boolean => {
    const errors: Record<string, string> = {};
    if (!pickup.trim()) errors.pickup = "Pickup is required.";
    if (!destination.trim()) errors.destination = "Destination is required.";
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const validateDetails = (): boolean => {
    const errors: Record<string, string> = {};
    if (!name.trim()) errors.name = "Your name is required.";
    if (vehicleType === "motorcycle" && passengerCount > 1) {
      errors.passengerCount = "Motorcycles take 1 passenger only.";
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSupabaseConfigured) {
      setSubmitError("Transport is unavailable right now. Please try again later.");
      return;
    }
    if (formStep === 1) {
      if (validateRoute()) setFormStep(2);
      return;
    }
    if (!validateRoute() || !validateDetails()) {
      if (!pickup.trim() || !destination.trim()) setFormStep(1);
      return;
    }
    setSubmitError("");
    setPhase("submitting");

    try {
      setCustomerAuthId(await getCustomerAuthId());
      const created = await createRide({
        customer_name: name.trim(),
        customer_phone: phone.trim(),
        pickup_address: pickup.trim(),
        pickup_lat: pickupCoords?.lat ?? null,
        pickup_lng: pickupCoords?.lng ?? null,
        destination_address: destination.trim(),
        passenger_count: passengerCount,
        passenger_type: passengerType,
        vehicle_type: vehicleType,
        fare_cents: fareQuote?.fareCents ?? null,
        fare_source: fareQuote?.source ?? null,
      });
      setRide(created);
      writeStoredRideId(created.id);
      setPhase("searching");

      try {
        const result = await dispatchRide(created.id);
        if (result.ride_status === "no_driver") {
          setPhase("no_driver");
        } else {
          await syncRide(created.id);
        }
      } catch (dispatchErr) {
        // Ride exists; keep searching state and surface a soft warning.
        setSubmitError(
          friendlyRideError(dispatchErr, "Ride created — still finding a driver.")
        );
      }
    } catch (err) {
      setPhase("form");
      setSubmitError(
        friendlyRideError(err, "Could not request your ride. Please try again.")
      );
    }
  };

  const handleShareLocation = () => {
    if (!ride?.id) return;
    if (sharingLocation) {
      setSharingLocation(false);
      setLivePassengerLoc(null);
      try {
        window.localStorage.removeItem(`${HUB_SHARE_KEY}${ride.id}`);
      } catch {
        // ignore
      }
      return;
    }
    setShareError("");
    setSharingLocation(true);
    try {
      window.localStorage.setItem(`${HUB_SHARE_KEY}${ride.id}`, "1");
    } catch {
      // Private browsing — sharing lasts for this session only.
    }
  };

  const handleOpenChat = () => {
    setChatUnread(0);
    setShowChat(true);
  };

  const handleRetry = async () => {
    if (!ride || retrying) return;
    setRetrying(true);
    setSubmitError("");
    try {
      const result = await dispatchRide(ride.id);
      if (result.ride_status === "no_driver") {
        setPhase("no_driver");
      } else {
        await syncRide(ride.id);
      }
    } catch (err) {
      setSubmitError(
        friendlyRideError(err, "Still no driver found. Please try again.")
      );
    } finally {
      setRetrying(false);
    }
  };

  const handleSubmitRating = async () => {
    if (!ride || ratingState !== "ready" || stars < 1 || stars > 5) return;
    setRatingState("sending");
    setRatingError("");
    try {
      const updated = await submitRideRating(
        ride.id,
        stars,
        ratingComment.trim() || undefined
      );
      setRide(updated);
      setRatingState("sent");
    } catch (err) {
      setRatingState("ready");
      setRatingError(
        friendlyRideError(
          err,
          "Your rating couldn't be submitted. Please try again."
        )
      );
    }
  };

  const handleCancel = async () => {
    if (!ride || cancelling) return;
    // cancel_ride rejects no_driver — Close is the only path there.
    if (!CANCELLABLE.includes(ride.status)) return;
    setCancelling(true);
    try {
      const authId = await getCustomerAuthId();
      const updated = await cancelRide(ride.id, authId, cancelReason);
      setRide(updated);
      setPhase("cancelled");
      stopPolling();
    } catch (err) {
      setSubmitError(
        friendlyRideError(err, "Could not cancel this ride. Please try again.")
      );
    } finally {
      setCancelling(false);
      setConfirmingCancel(false);
    }
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
          <p>Checking your ride…</p>
        </div>
      </div>
    );
  }

  if (phase !== "form" && phase !== "submitting" && ride) {
    const copy = PHASE_COPY[phase];
    const cancellable = CANCELLABLE.includes(ride.status);
    const activity = activityState(phase);
    const tripActive = ACTIVE_TRACK_STATUSES.includes(ride.status);
    const chatAvailable = Boolean(tripActive && ride.driver_id);
    const showJourney =
      phase === "searching" ||
      phase === "accepted" ||
      phase === "arrived" ||
      phase === "in_progress" ||
      phase === "completed";
    return (
      <div className="container">
        {restored && (
          <div className="restore-banner" role="status">
            <strong>Your ride is still active</strong>
            <span>Picking up right where you left off.</span>
          </div>
        )}
        <section className="status-card" aria-live="polite">
          <p className="status-card__kicker">Ride Now · {copy.stage}</p>
          <div>
            <span className={`activity-pill activity-pill--${activity.tone}`}>
              {activity.label}
            </span>
          </div>
          <h1 className="status-card__title">{copy.title}</h1>
          <p className="status-card__text">{copy.next}</p>

          {showJourney && (
            <JourneySteps
              stages={RIDE_JOURNEY}
              currentIndex={journeyIndex(phase)}
              ariaLabel="Ride progress"
            />
          )}

          <dl className="status-card__route">
            <div>
              <dt>Pickup</dt>
              <dd>{ride.pickup_address}</dd>
            </div>
            <div>
              <dt>Destination</dt>
              <dd>{ride.destination_address}</dd>
            </div>
            <div>
              <dt>Fare</dt>
              <dd>
                {typeof ride.fare_cents === "number"
                  ? `₱${formatCentavos(ride.fare_cents)}`
                  : "Fare confirmed by driver"}
              </dd>
            </div>
          </dl>

          {driver && (
            <div className="driver-card">
              <div className="driver-card__avatar" aria-hidden="true">
                {driver.full_name.charAt(0).toUpperCase()}
              </div>
              <div className="driver-card__body">
                <p className="driver-card__name">{driver.full_name}</p>
                <p className="driver-card__meta">
                  {[driver.vehicle_type, driver.vehicle_model, driver.vehicle_color]
                    .filter(Boolean)
                    .join(" · ")}
                  {driver.plate_number ? ` · ${driver.plate_number}` : ""}
                </p>
              </div>
            </div>
          )}

          {cancelNotice && (
            <p className="form-error-message" role="alert">
              {cancelNotice.cancelled_by_role === "driver"
                ? "Your driver cancelled this ride."
                : "This ride was cancelled."}{" "}
              {cancelNotice.reason ? `Reason: ${cancelNotice.reason}` : ""}
            </p>
          )}

          {tripActive && (
            <div className="trip-live">
              <MapView
                className="trip-map"
                height={220}
                driverLatitude={driverLocation?.lat ?? null}
                driverLongitude={driverLocation?.lng ?? null}
                pickupLatitude={livePassengerLoc?.lat ?? ride.pickup_lat}
                pickupLongitude={livePassengerLoc?.lng ?? ride.pickup_lng}
              />
              {shareError ? (
                <p className="field-note field-note--error">{shareError}</p>
              ) : sharingLocation ? (
                <p className="field-note">Sharing your live location with your driver.</p>
              ) : (
                <button
                  type="button"
                  className="link-button"
                  onClick={handleShareLocation}
                >
                  Share my live location with the driver
                </button>
              )}
              {sharingLocation && !shareError && (
                <button
                  type="button"
                  className="link-button"
                  onClick={handleShareLocation}
                >
                  Stop sharing
                </button>
              )}
            </div>
          )}

          {chatAvailable && !showChat && (
            <button
              type="button"
              className="btn btn--ghost btn--block"
              onClick={handleOpenChat}
            >
              Chat with driver
              {chatUnread > 0 ? ` (${chatUnread} new)` : ""}
            </button>
          )}

          {chatAvailable && showChat && (
            <div className="hub-legacy">
              <RideChat
                rideId={ride.id}
                otherPartyName={driver?.full_name ?? "Driver"}
                currentRole="Rider"
                onClose={() => setShowChat(false)}
              />
            </div>
          )}

          {phase === "completed" && ride.driver_id && (
            <div className="rating-card" aria-live="polite">
              {ratingState === "sent" && (
                <p className="rating-card__thanks">
                  Thanks for rating — ride safe!
                </p>
              )}
              {ratingState === "already" && (
                <p className="rating-card__thanks">
                  You already rated this ride. Thanks!
                </p>
              )}
              {(ratingState === "ready" || ratingState === "sending") && (
                <>
                  <p className="rating-card__title">How was your ride?</p>
                  <div
                    className="star-row"
                    role="group"
                    aria-label="Rate from 1 to 5 stars"
                  >
                    {[1, 2, 3, 4, 5].map((value) => (
                      <button
                        key={value}
                        type="button"
                        className={`star${value <= stars ? " is-on" : ""}`}
                        aria-label={`${value} star${value === 1 ? "" : "s"}`}
                        aria-pressed={value === stars}
                        onClick={() => setStars(value)}
                        disabled={ratingState === "sending"}
                      >
                        ★
                      </button>
                    ))}
                  </div>
                  <label className="field-block">
                    <span className="field-label">
                      Comment{" "}
                      <span className="optional-tag">(optional)</span>
                    </span>
                    <input
                      className="input-field"
                      type="text"
                      placeholder="Anything to add?"
                      value={ratingComment}
                      onChange={(e) => setRatingComment(e.target.value)}
                      maxLength={200}
                      disabled={ratingState === "sending"}
                    />
                  </label>
                  {ratingError && (
                    <p className="form-error-message" role="alert">
                      {ratingError}
                    </p>
                  )}
                  <button
                    type="button"
                    className="btn btn--primary btn--block"
                    onClick={() => void handleSubmitRating()}
                    disabled={
                      ratingState === "sending" || stars < 1 || stars > 5
                    }
                  >
                    {ratingState === "sending"
                      ? "Sending…"
                      : "Submit rating"}
                  </button>
                </>
              )}
            </div>
          )}

          {phase === "no_driver" && (
            <div className="status-card__actions">
              <button
                type="button"
                className="btn btn--primary"
                onClick={() => void handleRetry()}
                disabled={retrying}
              >
                {retrying ? "Trying again…" : "Try Again"}
              </button>
              <button
                type="button"
                className="btn btn--ghost"
                onClick={clearLocalRide}
              >
                Close
              </button>
            </div>
          )}

          {(phase === "completed" || phase === "cancelled") && (
            <div className="status-card__actions">
              <button
                type="button"
                className="btn btn--primary"
                onClick={clearLocalRide}
              >
                Book another ride
              </button>
              <Link to="/" className="btn btn--ghost">
                Home
              </Link>
            </div>
          )}

          {cancellable && !confirmingCancel && (
            <div className="status-card__actions">
              <button
                type="button"
                className="btn btn--ghost btn--danger"
                onClick={() => setConfirmingCancel(true)}
              >
                Cancel ride
              </button>
            </div>
          )}

          {cancellable && confirmingCancel && (
            <div className="cancel-confirm" role="dialog" aria-label="Confirm cancellation">
              <p className="cancel-confirm__title">Cancel this ride?</p>
              <label className="field-block">
                <span className="field-label">Reason</span>
                <select
                  className="input-field"
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                >
                  {CANCEL_REASONS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </label>
              <div className="status-card__actions">
                <button
                  type="button"
                  className="btn btn--danger-solid"
                  onClick={() => void handleCancel()}
                  disabled={cancelling}
                >
                  {cancelling ? "Cancelling…" : "Yes, cancel"}
                </button>
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={() => setConfirmingCancel(false)}
                  disabled={cancelling}
                >
                  Keep ride
                </button>
              </div>
            </div>
          )}

          {submitError && (
            <p className="form-error-message" role="alert">
              {submitError}
            </p>
          )}
        </section>
      </div>
    );
  }

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
        <p className="form-header__kicker">Transport · Ride Now</p>
        <h1 className="form-header__title">Where to?</h1>
        <p className="form-header__subtitle">
          {formStep === 1
            ? "First, tell us your route around Bislig."
            : "Now your details — then review the fare and request."}
        </p>
      </header>

      <div className="wizard-progress" aria-label={`Step ${formStep} of 2`}>
        <div className="flow-progress" role="presentation">
          {[1, 2].map((n) => (
            <span
              key={n}
              className={`flow-progress-step${formStep === n ? " is-current" : ""}${formStep > n ? " is-done" : ""}`}
            >
              {formStep > n ? "✓" : `0${n}`}
            </span>
          ))}
        </div>
        <span className="wizard-step-label">
          {formStep === 1 ? "Step 1 — Route" : "Step 2 — Details & fare"}
        </span>
      </div>

      <form className="booking-form" onSubmit={(e) => void handleSubmit(e)} noValidate>
        {formStep === 1 && (
          <>
            <label className="field-block">
              <span className="field-label">Pickup</span>
              <input
                className={`input-field${fieldErrors.pickup ? " has-error" : ""}`}
                type="text"
                placeholder="e.g. Mangagoy Public Market"
                value={pickup}
                onChange={(e) => {
                  setPickup(e.target.value);
                  setFieldErrors((c) => ({ ...c, pickup: "" }));
                }}
                autoComplete="off"
              />
              {fieldErrors.pickup && (
                <span className="field-error">{fieldErrors.pickup}</span>
              )}
            </label>

            <button
              type="button"
              className="link-button"
              onClick={useMyLocation}
              disabled={locating}
            >
              {locating
                ? "Getting your location…"
                : pickupCoords
                  ? "✓ Using your current location"
                  : "Use my current location"}
            </button>
            {locationError && (
              <p className="field-note field-note--error">{locationError}</p>
            )}

            <label className="field-block">
              <span className="field-label">Destination</span>
              <input
                className={`input-field${fieldErrors.destination ? " has-error" : ""}`}
                type="text"
                placeholder="e.g. Tinuy-an Falls"
                value={destination}
                onChange={(e) => {
                  setDestination(e.target.value);
                  setFieldErrors((c) => ({ ...c, destination: "" }));
                }}
                autoComplete="off"
              />
              {fieldErrors.destination && (
                <span className="field-error">{fieldErrors.destination}</span>
              )}
            </label>
          </>
        )}

        {formStep === 2 && (
          <>
            <div className="fare-box" aria-live="polite">
              <span className="field-label">Estimated fare</span>
              {fareQuote ? (
                <>
                  <strong>₱{formatCentavos(fareQuote.fareCents)}</strong>
                  <small>
                    {fareQuote.discountApplied ? "Discounted · " : ""}
                    {fareQuote.matchedDestination ?? "Standard rate"}
                  </small>
                </>
              ) : (
                <>
                  <strong>Fare confirmed by driver</strong>
                  <small>Shown before pickup once a driver accepts</small>
                </>
              )}
            </div>

            <div className="form-row">
              <label className="field-block">
                <span className="field-label">Vehicle</span>
                <select
                  className="input-field"
                  value={vehicleType}
                  onChange={(e) => {
                    const v = e.target.value as VehicleType;
                    setVehicleType(v);
                    if (v === "motorcycle") setPassengerCount(1);
                  }}
                >
                  <option value="tricycle">Tricycle</option>
                  <option value="umbak">Umbak</option>
                  <option value="motorcycle">Motorcycle</option>
                </select>
              </label>

              <div className="field-block">
                <span className="field-label" id="pax-label">
                  Passengers
                </span>
                <div
                  className="stepper"
                  role="group"
                  aria-labelledby="pax-label"
                >
                  <button
                    type="button"
                    aria-label="Fewer passengers"
                    onClick={() => setPassengerCount((c) => Math.max(1, c - 1))}
                  >
                    −
                  </button>
                  <output aria-live="polite">{passengerCount}</output>
                  <button
                    type="button"
                    aria-label="More passengers"
                    onClick={() => setPassengerCount((c) => Math.min(7, c + 1))}
                  >
                    +
                  </button>
                </div>
                {fieldErrors.passengerCount && (
                  <span className="field-error">{fieldErrors.passengerCount}</span>
                )}
              </div>
            </div>

            <label className="field-block">
              <span className="field-label">Passenger type</span>
              <select
                className="input-field"
                value={passengerType}
                onChange={(e) => setPassengerType(e.target.value as PassengerType)}
              >
                <option value="Regular">Regular</option>
                <option value="Student">Student</option>
                <option value="Senior Citizen">Senior Citizen</option>
                <option value="PWD">PWD</option>
              </select>
            </label>

            <label className="field-block">
              <span className="field-label">Your name</span>
              <input
                className={`input-field${fieldErrors.name ? " has-error" : ""}`}
                type="text"
                placeholder="Full name"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setFieldErrors((c) => ({ ...c, name: "" }));
                }}
                autoComplete="name"
              />
              {fieldErrors.name && (
                <span className="field-error">{fieldErrors.name}</span>
              )}
            </label>

            <label className="field-block">
              <span className="field-label">
                Phone number <span className="optional-tag">(optional)</span>
              </span>
              <input
                className="input-field"
                type="tel"
                placeholder="09xx xxx xxxx"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                autoComplete="tel"
              />
            </label>

            <p className="field-note">
              {pickup.trim() || "Pickup"} → {destination.trim() || "Destination"}
            </p>
          </>
        )}

        {submitError && (
          <p className="form-error-message" role="alert">
            {submitError}
          </p>
        )}

        <div className="form-actions">
          {formStep === 1 ? (
            <button type="submit" className="btn btn--primary btn--block">
              Continue →
            </button>
          ) : (
            <button
              type="submit"
              className="btn btn--primary btn--block"
              disabled={phase === "submitting"}
            >
              {phase === "submitting" ? "Requesting ride…" : "Request ride"}
            </button>
          )}
          {formStep === 2 && (
            <button
              type="button"
              className="link-button"
              onClick={() => setFormStep(1)}
            >
              ← Back to route
            </button>
          )}
        </div>
        <p className="form-footnote">
          No account needed. Rides are fulfilled by local Bislig drivers.
        </p>
      </form>
    </div>
  );
}
