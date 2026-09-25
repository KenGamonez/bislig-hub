import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../../legacy/lib/supabase";
import {
  acceptRideOffer,
  declineRideOffer,
  fetchPendingOffer,
  subscribeToAssignedRides,
} from "../../legacy/lib/dispatch";
import {
  acceptPakyawanBooking,
  acceptPakyawanOffer,
  declinePakyawanOffer,
  fetchAvailablePakyawanBookings,
  fetchDriverPakyawanOffers,
} from "../../legacy/lib/scheduledBookings";
import {
  acceptDeliveryBooking,
  acceptDeliveryOffer,
  fetchAvailableDeliveries,
  fetchDriverDeliveryOffers,
} from "../../legacy/lib/deliveries";
import { fetchAssignedRidesForDriver } from "../../legacy/lib/rides";
import {
  playRequestChime,
  showBrowserNotification,
} from "../../legacy/lib/notifications";
import type { Ride } from "../../legacy/types/ride";
import type { PakyawanBooking } from "../../legacy/types/scheduledBooking";
import type { DeliveryBooking } from "../../legacy/types/delivery";
import {
  deliveryOfferToJob,
  deliveryRequestToJob,
  isLiveOffer,
  pakyawanOfferToJob,
  pakyawanRequestToJob,
  rideToJob,
  type DriverJob,
} from "../jobs";

function friendlyError(error: unknown, fallback: string): string {
  if (import.meta.env.DEV) console.error("[driver-jobs]", fallback, error);
  const message = error instanceof Error ? error.message : "";
  if (/no longer available|taken by another/i.test(message)) {
    return "This request is no longer available. It may have been taken by another driver.";
  }
  if (/no longer eligible/i.test(message)) {
    return "You are no longer eligible for this request.";
  }
  if (/expired/i.test(message)) {
    return "This offer already expired.";
  }
  return fallback;
}

export type JobsState = {
  jobs: DriverJob[];
  assignedRide: Ride | null;
  loading: boolean;
  error: string;
  actionError: string;
  submittingKey: string | null;
  now: number;
  acceptJob: (job: DriverJob) => Promise<void>;
  declineJob: (job: DriverJob) => Promise<void>;
  dismissJob: (job: DriverJob) => void;
  retry: () => void;
};

/**
 * Unified incoming-work adapter. Calls existing engine fetchers/RPCs and
 * mirrors the proven refresh model: realtime invalidation + polling
 * fallback, expiry filtering, backend as source of truth. No business
 * rules live here — only orchestration of engine calls.
 */
export function useDriverJobs(args: {
  driverId: string | null;
  online: boolean;
  canAcceptPakyawan: boolean;
  canAcceptDeliveries: boolean;
}): JobsState {
  const { driverId, online, canAcceptPakyawan, canAcceptDeliveries } = args;

  const [rideOffer, setRideOffer] = useState<Awaited<
    ReturnType<typeof fetchPendingOffer>
  > | null>(null);
  const [pakyawanOffers, setPakyawanOffers] = useState<
    Awaited<ReturnType<typeof fetchDriverPakyawanOffers>>
  >([]);
  const [pakyawanRequests, setPakyawanRequests] = useState<PakyawanBooking[]>(
    []
  );
  const [deliveryOffers, setDeliveryOffers] = useState<
    Awaited<ReturnType<typeof fetchDriverDeliveryOffers>>
  >([]);
  const [deliveryRequests, setDeliveryRequests] = useState<DeliveryBooking[]>(
    []
  );
  const [assignedRide, setAssignedRide] = useState<Ride | null>(null);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [submittingKey, setSubmittingKey] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const loadAll = useCallback(async () => {
    if (!driverId || !online) return;
    try {
      const [assigned, pending, pakOffers, pakRequests, delOffers, delRequests] =
        await Promise.all([
          fetchAssignedRidesForDriver(driverId).catch(() => [] as Ride[]),
          fetchPendingOffer(driverId).catch(() => null),
          canAcceptPakyawan
            ? fetchDriverPakyawanOffers(driverId).catch(() => [])
            : Promise.resolve([]),
          canAcceptPakyawan
            ? fetchAvailablePakyawanBookings().catch(() => [])
            : Promise.resolve([]),
          canAcceptDeliveries
            ? fetchDriverDeliveryOffers(driverId).catch(() => [])
            : Promise.resolve([]),
          canAcceptDeliveries
            ? fetchAvailableDeliveries().catch(() => [])
            : Promise.resolve([]),
        ]);
      if (!mountedRef.current) return;
      setAssignedRide(assigned[0] ?? null);
      setRideOffer(pending);
      setPakyawanOffers(pakOffers);
      setPakyawanRequests(pakRequests);
      setDeliveryOffers(delOffers);
      setDeliveryRequests(delRequests);
      setError("");
    } catch (err) {
      if (!mountedRef.current) return;
      setError(
        friendlyError(err, "Unable to load incoming jobs right now.")
      );
    }
  }, [driverId, online, canAcceptPakyawan, canAcceptDeliveries]);

  // Initial + polling fallback (mirrors the engine's dual coverage).
  useEffect(() => {
    if (!driverId || !online) {
      setLoading(false);
      return;
    }
    setLoading(true);
    void loadAll().finally(() => {
      if (mountedRef.current) setLoading(false);
    });
    const timer = window.setInterval(() => {
      void loadAll();
    }, 10000);
    return () => window.clearInterval(timer);
  }, [driverId, online, loadAll]);

  // Expiry clock (also drives countdowns).
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 5000);
    return () => window.clearInterval(timer);
  }, []);

  // Realtime invalidation (same channels the engine uses).
  useEffect(() => {
    if (!driverId || !online) return;
    const channels = [
      supabase
        .channel(`hub-driver-offers-${driverId}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "ride_offers",
            filter: `driver_id=eq.${driverId}`,
          },
          (payload) => {
            const incoming = (payload.new ?? {}) as { id?: string };
            if (!incoming.id) {
              void loadAll();
              return;
            }
            void fetchPendingOffer(driverId)
              .then((pending) => {
                if (!mountedRef.current) return;
                if (pending) {
                  setRideOffer(pending);
                  playRequestChime();
                  showBrowserNotification(
                    "New ride offer",
                    `${pending.ride.pickup_address} → ${pending.ride.destination_address}`
                  );
                }
              })
              .catch(() => {});
          }
        )
        .subscribe(),
      supabase
        .channel(`hub-driver-assigned-${driverId}`)
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "rides",
            filter: `driver_id=eq.${driverId}`,
          },
          () => {
            void loadAll();
          }
        )
        .subscribe(),
      supabase
        .channel("hub-driver-pakyawan-requests")
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "pakyawan_bookings" },
          (payload) => {
            const incoming = (payload.new ?? {}) as Partial<PakyawanBooking>;
            if (!incoming.id || !mountedRef.current) return;
            setPakyawanRequests((current) =>
              current.some((b) => b.id === incoming.id)
                ? current
                : [incoming as PakyawanBooking, ...current]
            );
            if (online) {
              playRequestChime();
              showBrowserNotification("New Pakyawan request", "A customer is requesting a trip.");
            }
          }
        )
        .subscribe(),
      supabase
        .channel(`hub-driver-pakyawan-offers-${driverId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "pakyawan_offers",
            filter: `driver_id=eq.${driverId}`,
          },
          () => {
            void loadAll();
          }
        )
        .subscribe(),
      supabase
        .channel("hub-driver-deliveries-requests")
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "deliveries" },
          (payload) => {
            const incoming = (payload.new ?? {}) as Partial<DeliveryBooking>;
            if (!incoming.id || !mountedRef.current) return;
            setDeliveryRequests((current) =>
              current.some((b) => b.id === incoming.id)
                ? current
                : [incoming as DeliveryBooking, ...current]
            );
            if (online) {
              playRequestChime();
              showBrowserNotification("New delivery request", "A customer is requesting a delivery.");
            }
          }
        )
        .subscribe(),
      supabase
        .channel(`hub-driver-delivery-offers-${driverId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "delivery_offers",
            filter: `driver_id=eq.${driverId}`,
          },
          () => {
            void loadAll();
          }
        )
        .subscribe(),
    ];
    const unsubscribeAssigned = subscribeToAssignedRides(driverId, () => {
      void loadAll();
    });
    return () => {
      unsubscribeAssigned();
      for (const channel of channels) void supabase.removeChannel(channel);
    };
  }, [driverId, online, loadAll]);

  const jobs: DriverJob[] = [];
  if (rideOffer && isLiveOffer(rideOffer.offer.expires_at, now)) {
    jobs.push(rideToJob(rideOffer));
  }
  for (const offer of pakyawanOffers) {
    if (!isLiveOffer(offer.expires_at, now)) continue;
    jobs.push(pakyawanOfferToJob(offer));
  }
  for (const booking of pakyawanRequests) {
    const key = `pakyawan-request-${booking.id}`;
    if (dismissed.has(key)) continue;
    jobs.push(pakyawanRequestToJob(booking));
  }
  for (const offer of deliveryOffers) {
    if (!isLiveOffer(offer.expires_at, now)) continue;
    jobs.push(deliveryOfferToJob(offer));
  }
  for (const booking of deliveryRequests) {
    const key = `delivery-request-${booking.id}`;
    if (dismissed.has(key)) continue;
    jobs.push(deliveryRequestToJob(booking));
  }

  const runAction = useCallback(
    async (job: DriverJob, fn: () => Promise<unknown>) => {
      if (!driverId || submittingKey) return;
      setSubmittingKey(job.key);
      setActionError("");
      try {
        await fn();
        // Backend is source of truth: refresh, then prune locally.
        await loadAll();
      } catch (err) {
        setActionError(friendlyError(err, "Something went wrong. Please try again."));
        await loadAll().catch(() => {});
      } finally {
        if (mountedRef.current) setSubmittingKey(null);
      }
    },
    [driverId, submittingKey, loadAll]
  );

  const acceptJob = useCallback(
    (job: DriverJob) => {
      if (!driverId) return Promise.resolve();
      if (job.kind === "ride") {
        return runAction(job, () => acceptRideOffer(job.rideId, driverId));
      }
      if (job.kind === "pakyawan") {
        if (job.offerId) {
          const offerId = job.offerId;
          return runAction(job, () => acceptPakyawanOffer(offerId));
        }
        return runAction(job, () =>
          acceptPakyawanBooking(job.bookingId, driverId)
        );
      }
      if (job.offerId) {
        const offerId = job.offerId;
        return runAction(job, () => acceptDeliveryOffer(offerId));
      }
      return runAction(job, () =>
        acceptDeliveryBooking(job.deliveryId, driverId)
      );
    },
    [driverId, runAction]
  );

  const declineJob = useCallback(
    (job: DriverJob) => {
      if (!driverId) return Promise.resolve();
      // Ride + Pakyawan offers decline through engine RPCs. Delivery offers
      // expire server-side and pull requests dismiss locally — exactly the
      // legacy behavior (no decline RPC exists for those paths).
      if (job.kind === "ride" && job.offerId) {
        return runAction(job, () => declineRideOffer(job.rideId, driverId));
      }
      if (job.kind === "pakyawan" && job.offerId) {
        return runAction(job, () => declinePakyawanOffer(job.offerId as string));
      }
      return Promise.resolve();
    },
    [driverId, runAction]
  );

  const dismissJob = useCallback((job: DriverJob) => {
    setDismissed((current) => new Set(current).add(job.key));
  }, []);

  const retry = useCallback(() => {
    setError("");
    void loadAll();
  }, [loadAll]);

  return {
    jobs,
    assignedRide,
    loading,
    error,
    actionError,
    submittingKey,
    now,
    acceptJob,
    declineJob,
    dismissJob,
    retry,
  };
}
