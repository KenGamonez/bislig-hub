import { createContext, useContext, useCallback, useState, type ReactNode } from "react";
import { setDriverPresence } from "../../legacy/lib/dispatch";

interface DriverPresenceContextValue {
  online: boolean;
  available: boolean;
  autoAccept: boolean;
  transitioning: boolean;
  error: string;
  setOnline: () => Promise<void>;
  setOffline: () => Promise<void>;
  setAvailability: (next: boolean) => Promise<void>;
  setAutoAccept: (next: boolean) => Promise<void>;
}

const DriverPresenceContext = createContext<DriverPresenceContextValue | null>(null);

export function DriverPresenceProvider({ children }: { children: ReactNode }) {
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

  const setAvailability = useCallback(async (nextAvailable: boolean) => {
    if (!online || transitioning) return;
    setTransitioning(true);
    setError("");
    try {
      const presence = await setDriverPresence(true, nextAvailable, autoAccept);
      setAvailableState(presence.is_available);
    } catch (err) {
      if (import.meta.env.DEV) console.error("[driver] availability", err);
      setError("Unable to update your availability right now. Please try again.");
    } finally {
      setTransitioning(false);
    }
  }, [online, autoAccept, transitioning]);

  const setAutoAccept = useCallback(async (nextAutoAccept: boolean) => {
    if (!online || transitioning) return;
    setTransitioning(true);
    setError("");
    try {
      const presence = await setDriverPresence(true, available, nextAutoAccept);
      setAutoAcceptState(presence.auto_accept);
    } catch (err) {
      if (import.meta.env.DEV) console.error("[driver] auto-accept", err);
      setError("Unable to update auto-accept right now. Please try again.");
    } finally {
      setTransitioning(false);
    }
  }, [online, available, transitioning]);

  return (
    <DriverPresenceContext.Provider
      value={{
        online,
        available,
        autoAccept,
        transitioning,
        error,
        setOnline,
        setOffline,
        setAvailability,
        setAutoAccept,
      }}
    >
      {children}
    </DriverPresenceContext.Provider>
  );
}

export function useDriverPresenceContext() {
  const context = useContext(DriverPresenceContext);
  if (!context) {
    throw new Error("useDriverPresenceContext must be used within a DriverPresenceProvider");
  }
  return context;
}