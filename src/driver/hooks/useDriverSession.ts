import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../legacy/lib/supabase";

export type DriverIdentity = {
  id: string;
  full_name: string;
  vehicle_type: string | null;
  vehicle_model: string | null;
  plate_number: string | null;
  vehicle_capacity: number | null;
  status: string;
  rating_average: number | null;
  can_accept_pakyawan: boolean;
  can_accept_deliveries: boolean;
};

export type DriverSessionState =
  | { status: "loading"; driver: null; authUserId: null }
  | { status: "logged-out"; driver: null; authUserId: null }
  | { status: "blocked"; driver: null; authUserId: string | null }
  | { status: "active"; driver: DriverIdentity; authUserId: string };

/**
 * Thin adapter over the existing driver auth model (Supabase Auth +
 * drivers.auth_user_id + status gate). Read-only: no new auth system,
 * no behavior change — same checks as the legacy driver entry.
 */
export function useDriverSession() {
  const [state, setState] = useState<DriverSessionState>({
    status: "loading",
    driver: null,
    authUserId: null,
  });

  const refresh = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    const user = data.session?.user;

    if (!user) {
      setState({ status: "logged-out", driver: null, authUserId: null });
      return;
    }

    const { data: driver } = await supabase
      .from("drivers")
      .select(
        "id, full_name, vehicle_type, vehicle_model, plate_number, vehicle_capacity, status, rating_average, can_accept_pakyawan, can_accept_deliveries"
      )
      .eq("auth_user_id", user.id)
      .maybeSingle();

    if (!driver) {
      setState({ status: "logged-out", driver: null, authUserId: null });
      return;
    }

    const identity = driver as DriverIdentity;
    identity.can_accept_pakyawan = Boolean(identity.can_accept_pakyawan);
    identity.can_accept_deliveries = Boolean(identity.can_accept_deliveries);

    if (identity.status === "inactive") {
      setState({ status: "blocked", driver: null, authUserId: user.id });
      return;
    }

    setState({ status: "active", driver: identity, authUserId: user.id });
  }, []);

  useEffect(() => {
    let mounted = true;
    void refresh().finally(() => {
      if (!mounted) return;
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      if (mounted) void refresh();
    });
    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [refresh]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    await refresh();
  }, [refresh]);

  return { ...state, refresh, signOut };
}
