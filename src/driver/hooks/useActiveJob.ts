import { useCallback, useEffect, useRef, useState } from "react";
import { subscribeToAssignedRides } from "../../legacy/lib/dispatch";
import {
  fetchAssignedRidesForDriver,
  fetchRideById,
} from "../../legacy/lib/rides";
import type { Ride } from "../../legacy/types/ride";

export type ActiveJobState =
  | { status: "loading"; ride: null; cancelled: false }
  | { status: "empty"; ride: null; cancelled: boolean }
  | { status: "active"; ride: Ride; cancelled: false }
  | { status: "error"; ride: null; cancelled: false };

/**
 * Active-ride adapter. Backend is authoritative: reads the assigned ride
 * via the existing engine query, refreshes on the existing realtime
 * channel + polling fallback. Detects server-side cancellation by
 * re-reading a vanished assignment. No local state machine.
 */
export function useActiveJob(driverId: string | null) {
  const [ride, setRide] = useState<Ride | null>(null);
  const [cancelled, setCancelled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tick, setTick] = useState(0);
  const mountedRef = useRef(true);
  const lastIdRef = useRef<string | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    if (!driverId) return;
    try {
      const items = await fetchAssignedRidesForDriver(driverId);
      if (!mountedRef.current) return;
      const current = items[0] ?? null;
      if (current) {
        lastIdRef.current = current.id;
        setCancelled(false);
        setRide(current);
        setError("");
        return;
      }
      // Assignment vanished: check whether the server cancelled it.
      if (lastIdRef.current) {
        try {
          const previous = await fetchRideById(lastIdRef.current);
          if (mountedRef.current && previous?.status === "cancelled") {
            setCancelled(true);
          }
        } catch {
          // Non-fatal: fall through to empty below.
        }
        lastIdRef.current = null;
      }
      if (mountedRef.current) {
        setRide(null);
        setError("");
      }
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
  if (loading) state = { status: "loading", ride: null, cancelled: false };
  else if (error && !ride)
    state = { status: "error", ride: null, cancelled: false };
  else if (ride) state = { status: "active", ride, cancelled: false };
  else state = { status: "empty", ride: null, cancelled };

  return { ...state, error, refresh, retry };
}
