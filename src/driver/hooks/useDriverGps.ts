import { useEffect, useRef, useState } from "react";
import {
  startRideLocationWatch,
  subscribeToRideLocation,
} from "../../legacy/lib/rideLocation";

export type GpsState = "idle" | "locating" | "connected" | "unavailable";
export type LatLng = { latitude: number; longitude: number };

/**
 * Driver GPS adapter for an active ride. Mirrors the proven legacy wiring:
 * - publishes own fixes on the ride broadcast channel (no GPS fix is
 *   required to stay online; failures are non-blocking notes),
 * - receives the passenger's shared fixes, ignoring our own messages,
 * - single watch + single subscription, both cleaned up on unmount,
 *   ride change, or status exit. No new logic, no new tables.
 */
export function useDriverGps(args: {
  rideId: string | null;
  authUserId: string | null;
  tracking: boolean;
}) {
  const { rideId, authUserId, tracking } = args;
  const [ownFix, setOwnFix] = useState<LatLng | null>(null);
  const [passengerFix, setPassengerFix] = useState<LatLng | null>(null);
  const [gpsState, setGpsState] = useState<GpsState>("idle");
  const [gpsNote, setGpsNote] = useState("");
  const stopRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!rideId || !authUserId || !tracking) {
      stopRef.current?.();
      stopRef.current = null;
      return;
    }

    setGpsState("locating");
    setGpsNote("");

    stopRef.current = startRideLocationWatch(rideId, {
      user: authUserId,
      onLocation: (latitude, longitude) => {
        setOwnFix({ latitude, longitude });
        setGpsState("connected");
        setGpsNote("");
      },
      onError: (error) => {
        setGpsState("unavailable");
        if (
          error.code === error.PERMISSION_DENIED ||
          error.code === error.POSITION_UNAVAILABLE
        ) {
          setGpsNote(
            "Live location is unavailable. The passenger won't see your live position."
          );
        } else {
          setGpsNote("Live location isn't working right now.");
        }
      },
      onUnsupported: () => {
        setGpsState("unavailable");
        setGpsNote("Live location is not supported on this device.");
      },
    });

    const unsubscribe = subscribeToRideLocation(rideId, (message) => {
      if (message.user === authUserId) return;
      setPassengerFix({ latitude: message.latitude, longitude: message.longitude });
    });

    return () => {
      stopRef.current?.();
      stopRef.current = null;
      unsubscribe();
    };
  }, [rideId, authUserId, tracking]);

  return { ownFix, passengerFix, gpsState, gpsNote };
}
