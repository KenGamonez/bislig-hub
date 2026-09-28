import { useCallback, useEffect, useRef, useState } from "react";
import { subscribeToAssignedRides } from "../../legacy/lib/dispatch";
import {
  fetchAssignedRidesForDriver,
  fetchRideById,
} from "../../legacy/lib/rides";
import { fetchDriverPakyawanBookings } from "../../legacy/lib/scheduledBookings";
import { fetchDriverDeliveries } from "../../legacy/lib/deliveries";
import { useNotifications } from "../../notifications/notifications";
import { DRIVER_COPY_BY_SERVICE } from "../../notifications/copy";
import type { Ride } from "../../legacy/types/ride";
import type { PakyawanBooking } from "../../legacy/types/scheduledBooking";
import type { DeliveryBooking } from "../../legacy/types/delivery";

export type ActiveServiceJob =
  | { service: "ride"; ride: Ride }
  | { service: "pakyawan"; booking: PakyawanBooking }
  | { service: "delivery"; booking: DeliveryBooking };

export type ActiveJobState =
  | { status: "loading"; job: null; cancelled: false }
  | { status: "empty"; job: null; cancelled: boolean }
  | { status: "active"; job: ActiveServiceJob; cancelled: false }
  | { status: "error"; job: null; cancelled: false };

const RIDE_LIFECYCLE_COPY = DRIVER_COPY_BY_SERVICE.ride;

const PAKYAWAN_LIFECYCLE_COPY = DRIVER_COPY_BY_SERVICE.pakyawan;

const DELIVERY_LIFECYCLE_COPY = DRIVER_COPY_BY_SERVICE.delivery;


/**
 * Multi-service active-job adapter. Backend is authoritative: reads the
 * driver's held work via the existing engine queries (rides assigned,
 * pakyawan held, deliveries held), refreshes on the existing ride
 * realtime channel + polling fallback. Detects server-side ride
 * cancellation by re-reading a vanished assignment. Priority follows
 * recency of assignment: ride, then pakyawan, then delivery. No local
 * state machine, no invented states.
 */
export function useActiveJob(driverId: string | null) {
  const [job, setJob] = useState<ActiveServiceJob | null>(null);
  const [cancelled, setCancelled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tick, setTick] = useState(0);
  const mountedRef = useRef(true);
  const lastRideIdRef = useRef<string | null>(null);
  // Last active-job state already announced (service:id:status). First
  // observation baselines silently so a reload mid-job does not
  // re-announce an old state.
  const notifySigRef = useRef<string | null>(null);
  const cancelledRideRef = useRef<string | null>(null);
  const { notify } = useNotifications();

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    if (!driverId) return;
    try {
      const [rides, pakyawan, deliveries] = await Promise.all([
        fetchAssignedRidesForDriver(driverId).catch(() => [] as Ride[]),
        fetchDriverPakyawanBookings(driverId).catch(
          () => [] as PakyawanBooking[]
        ),
        fetchDriverDeliveries(driverId).catch(() => [] as DeliveryBooking[]),
      ]);
      if (!mountedRef.current) return;
      const ride = rides[0] ?? null;
      // Held pakyawan/delivery rows that are still with the driver and
      // not terminal. Completed/cancelled rows drop out of these lists
      // on their own; anything left here is actionable.
      const pakyawanBooking =
        pakyawan.find((b) => b.driver_id === driverId) ?? null;
      const delivery =
        deliveries.find((d) => d.driver_id === driverId) ?? null;
      const next: ActiveServiceJob | null = ride
        ? { service: "ride", ride }
        : pakyawanBooking
          ? { service: "pakyawan", booking: pakyawanBooking }
          : delivery
            ? { service: "delivery", booking: delivery }
            : null;
      if (next?.service === "ride") {
        lastRideIdRef.current = next.ride.id;
        setCancelled(false);
      } else if (lastRideIdRef.current) {
        // Ride assignment vanished: check whether the server cancelled it.
        try {
          const previous = await fetchRideById(lastRideIdRef.current);
          if (mountedRef.current && previous?.status === "cancelled") {
            setCancelled(true);
          }
        } catch {
          // Non-fatal: fall through below.
        }
        lastRideIdRef.current = null;
      }
      if (!mountedRef.current) return;
      setJob(next);
      // A live job supersedes any earlier cancellation notice.
      if (next) setCancelled(false);
      setError("");
    } catch (err) {
      if (!mountedRef.current) return;
      if (import.meta.env.DEV) console.error("[active-job]", err);
      setError("Couldn't refresh this job. Check your connection.");
    }
  }, [driverId]);

  useEffect(() => {
    if (!driverId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    void refresh().finally(() => {
      if (mountedRef.current) setLoading(false);
    });
    const timer = window.setInterval(() => {
      void refresh();
    }, 10000);
    const unsubscribe = subscribeToAssignedRides(driverId, () => {
      void refresh();
    });
    return () => {
      window.clearInterval(timer);
      unsubscribe();
    };
  }, [driverId, refresh, tick]);

  const retry = useCallback(() => {
    setError("");
    setTick((t) => t + 1);
  }, []);

  let state: ActiveJobState;
  if (loading) state = { status: "loading", job: null, cancelled: false };
  else if (error && !job)
    state = { status: "error", job: null, cancelled: false };
  else if (job) state = { status: "active", job, cancelled: false };
  else state = { status: "empty", job: null, cancelled };

  // Announce active-job transitions once across all three services.
  // First observation baselines silently; the idempotent store guards
  // against repeats from polling, realtime, and foreground recovery.
  useEffect(() => {
    if (state.status === "active" && state.job?.service === "ride") {
      cancelledRideRef.current = state.job.ride.id;
    }
    let sig: string | null = null;
    let copy: { title: string; message: string } | undefined;
    let entityId = "";
    let service: "ride" | "pakyawan" | "delivery" = "ride";
    if (state.status === "active" && state.job) {
      if (state.job.service === "ride") {
        service = "ride";
        entityId = state.job.ride.id;
        sig = `ride:${entityId}:${state.job.ride.status}`;
        copy = RIDE_LIFECYCLE_COPY[state.job.ride.status];
      } else if (state.job.service === "pakyawan") {
        service = "pakyawan";
        entityId = state.job.booking.id;
        sig = `pakyawan:${entityId}:${state.job.booking.status}`;
        copy = PAKYAWAN_LIFECYCLE_COPY[state.job.booking.status];
      } else {
        service = "delivery";
        entityId = state.job.booking.id;
        sig = `delivery:${entityId}:${state.job.booking.status}`;
        copy = DELIVERY_LIFECYCLE_COPY[state.job.booking.status];
      }
    } else if (
      state.status === "empty" &&
      state.cancelled &&
      cancelledRideRef.current
    ) {
      service = "ride";
      entityId = cancelledRideRef.current;
      cancelledRideRef.current = null;
      sig = `ride:${entityId}:cancelled`;
      copy = {
        title: "Ride cancelled",
        message: "This ride was cancelled. Head back to Jobs for new work.",
      };
    }
    if (!sig) return;
    if (notifySigRef.current === null) {
      notifySigRef.current = sig;
      return;
    }
    if (notifySigRef.current === sig) return;
    notifySigRef.current = sig;
    if (!copy) return;
    notify({
      id: sig,
      service,
      title: copy.title,
      message: copy.message,
      entityId,
      target: "/driver/active",
      actionLabel: "View job",
    });
  });

  return { ...state, error, refresh, retry };
}
