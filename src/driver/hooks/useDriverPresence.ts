import { useCallback, useState } from "react";
import { setDriverPresence } from "../../legacy/lib/dispatch";

/**
 * Thin adapter over the existing set_driver_presence RPC.
 * Preserves deliberate engine behavior: going online requires no GPS fix.
 * No heartbeat/pagehide logic here (owned by the legacy workspace until
 * later phases); this adapter only flips presence state on demand.
 */
export function useDriverPresence() {
  const [online, setOnlineState] = useState(false);
  const [available, setAvailableState] = useState(true);
  const [autoAccept, setAutoAcceptState] = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const [error, setError] = useState("");

  const setOnline = useCallback(async () => {
    if (transitioning) return;
    setTransitioning(true);
    setError("");
    try {
      const presence = await setDriverPresence(true, available, autoAccept);
      setAvailableState(presence.is_available);
      setAutoAcceptState(presence.auto_accept);
      setOnlineState(true);
    } catch (err) {
      if (import.meta.env.DEV) console.error("[driver] online", err);
      setError("Unable to go online right now. Check your connection and try again.");
    } finally {
      setTransitioning(false);
    }
  }, [available, autoAccept, transitioning]);

  const setOffline = useCallback(async () => {
    if (transitioning) return;
    setTransitioning(true);
    setError("");
    try {
      await setDriverPresence(false, false, autoAccept);
      setOnlineState(false);
    } catch (err) {
      if (import.meta.env.DEV) console.error("[driver] offline", err);
      setError("Unable to go offline right now. Please try again.");
    } finally {
      setTransitioning(false);
    }
  }, [autoAccept, transitioning]);

  return {
    online,
    available,
    autoAccept,
    transitioning,
    error,
    setOnline,
    setOffline,
  };
}
