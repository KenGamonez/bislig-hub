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
  username: string | null;
  email: string | null;
  profile_photo_url: string | null;
  must_change_password: boolean;
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

    // Full select includes first-login + photo columns. If the
    // BTRP mini-system migration has not been applied yet, fall back to
    // the core columns so existing sessions keep working.
    let driver: Record<string, unknown> | null = null;
    const fullSelect = await supabase
      .from("drivers")
      .select(
        "id, full_name, vehicle_type, vehicle_model, plate_number, vehicle_capacity, status, rating_average, can_accept_pakyawan, can_accept_deliveries, username, email, profile_photo_url, must_change_password"
      )
      .eq("auth_user_id", user.id)
      .maybeSingle();

    if (fullSelect.error) {
      console.warn(
        "Driver session falling back to core columns:",
        fullSelect.error.message
      );
      const coreSelect = await supabase
        .from("drivers")
        .select(
          "id, full_name, vehicle_type, vehicle_model, plate_number, vehicle_capacity, status, rating_average, can_accept_pakyawan, can_accept_deliveries, username, email"
        )
        .eq("auth_user_id", user.id)
        .maybeSingle();
      driver = coreSelect.data;
    } else {
      driver = fullSelect.data;
    }

    if (!driver) {
      setState({ status: "logged-out", driver: null, authUserId: null });
      return;
    }

    const identity = driver as unknown as DriverIdentity;
    identity.can_accept_pakyawan = Boolean(identity.can_accept_pakyawan);
    identity.can_accept_deliveries = Boolean(identity.can_accept_deliveries);
    identity.must_change_password = Boolean(identity.must_change_password);
    if (identity.profile_photo_url === undefined) {
      identity.profile_photo_url = null;
    }

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
