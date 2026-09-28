import { createContext, useContext, useCallback, useEffect, useState, type ReactNode } from "react";
import { setDriverPresence } from "../../legacy/lib/dispatch";
import { getBestEffortPosition } from "../../legacy/lib/driverPresence";
import { supabase } from "../../legacy/lib/supabase";

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

/**
 * Surface the real Supabase/RPC message (PostgrestError often carries the
 * cause in `details`/`hint` with an empty `message`). Secrets are never
 * included — these are the backend's own user-safe error strings.
 */
function presenceErrorMessage(error: unknown, fallback: string): string {
  if (error && typeof error === "object") {
    const candidate = error as { message?: unknown; details?: unknown; hint?: unknown };
    for (const part of [candidate.message, candidate.details, candidate.hint]) {
      if (typeof part === "string" && part.trim()) {
        return part.trim();
      }
    }
  }
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }
  return fallback;
}

export function DriverPresenceProvider({ children }: { children: ReactNode }) {
  const [online, setOnlineState] = useState(false);
  const [available, setAvailableState] = useState(true);
  const [autoAccept, setAutoAcceptState] = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const [error, setError] = useState("");

  // Hydrate from the persisted presence row on mount. A driver the backend
  // already considers online must not be shown offline just because the
  // page reloaded; without this, job loading stays blocked until the
  // driver toggles twice. Reads the driver's own driver_locations row,
  // which existing RLS permits. No row yet (brand-new driver) means
  // offline until they explicitly go online.
  useEffect(() => {
    let mounted = true;
    const hydrate = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const user = data.session?.user;
        if (!user) return;
        const { data: driver } = await supabase
          .from("drivers")
          .select("id")
          .eq("auth_user_id", user.id)
          .maybeSingle();
        if (!driver) return;
        const { data: presence } = await supabase
          .from("driver_locations")
          .select("is_online, is_available, auto_accept")
          .eq("driver_id", (driver as { id: string }).id)
          .maybeSingle();
        if (!mounted || !presence) return;
        const row = presence as { is_online: boolean; is_available: boolean; auto_accept: boolean };
        setOnlineState(Boolean(row.is_online));
        setAvailableState(Boolean(row.is_available));
        setAutoAcceptState(Boolean(row.auto_accept));
      } catch {
        // Best effort only — the driver can still toggle explicitly.
      }
    };
    void hydrate();
    return () => {
      mounted = false;
    };
  }, []);

  // Presence heartbeat: re-assert presence about every 60 seconds
  // while online so dispatch keeps treating this driver as genuinely
  // available. The backend excludes presence rows untouched for over 5
  // minutes from dispatch rounds; without this, an idle-but-online
  // driver would go stale and stop receiving offers. Best effort only —
  // failures never touch local state, the next beat retries.
  useEffect(() => {
    if (!online) return;
    const beat = () => {
      void (async () => {
        try {
          const fix = await getBestEffortPosition();
          await setDriverPresence(
            true,
            available,
            autoAccept,
            fix?.latitude ?? null,
            fix?.longitude ?? null
          );
        } catch {
          // Best effort only — next beat retries.
        }
      })();
    };
    beat();
    const timer = window.setInterval(beat, 60000);
    return () => window.clearInterval(timer);
  }, [online, available, autoAccept]);

  const setOnline = useCallback(async () => {
    if (transitioning) return;
    setTransitioning(true);
    setError("");
    try {
      // Best-effort GPS: coordinates improve dispatch ordering when
      // available, but going online never waits on permission.
      const fix = await getBestEffortPosition();
      const presence = await setDriverPresence(
        true,
        available,
        autoAccept,
        fix?.latitude ?? null,
        fix?.longitude ?? null
      );
      setAvailableState(presence.is_available);
      setAutoAcceptState(presence.auto_accept);
      setOnlineState(true);
    } catch (err) {
      if (import.meta.env.DEV) console.error("[driver] online", err);
      setError(presenceErrorMessage(err, "Unable to go online right now. Check your connection and try again."));
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
      setError(presenceErrorMessage(err, "Unable to go offline right now. Please try again."));
    } finally {
      setTransitioning(false);
    }
  }, [autoAccept, transitioning]);

  const setAvailability = useCallback(async (nextAvailable: boolean) => {
    if (!online || transitioning) return;
    setTransitioning(true);
    setError("");
    try {
      const fix = await getBestEffortPosition();
      const presence = await setDriverPresence(
        true,
        nextAvailable,
        autoAccept,
        fix?.latitude ?? null,
        fix?.longitude ?? null
      );
      setAvailableState(presence.is_available);
    } catch (err) {
      if (import.meta.env.DEV) console.error("[driver] availability", err);
      setError(presenceErrorMessage(err, "Unable to update your availability right now. Please try again."));
    } finally {
      setTransitioning(false);
    }
  }, [online, autoAccept, transitioning]);

  const setAutoAccept = useCallback(async (nextAutoAccept: boolean) => {
    if (!online || transitioning) return;
    setTransitioning(true);
    setError("");
    try {
      const fix = await getBestEffortPosition();
      const presence = await setDriverPresence(
        true,
        available,
        nextAutoAccept,
        fix?.latitude ?? null,
        fix?.longitude ?? null
      );
      setAutoAcceptState(presence.auto_accept);
    } catch (err) {
      if (import.meta.env.DEV) console.error("[driver] auto-accept", err);
      setError(presenceErrorMessage(err, "Unable to update auto-accept right now. Please try again."));
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