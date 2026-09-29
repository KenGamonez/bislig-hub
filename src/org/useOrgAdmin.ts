import { useCallback, useEffect, useState } from "react";
import { supabase } from "../legacy/lib/supabase";
import {
  fetchMyOrgAdminRows,
  fetchOrganization,
  type OrgRecord,
} from "./orgData";

export type OrgAdminState =
  | { status: "loading"; org: null; authUserId: null }
  | { status: "logged-out"; org: null; authUserId: null }
  | { status: "denied"; org: null; authUserId: string | null }
  | { status: "active"; org: OrgRecord; authUserId: string };

/**
 * Organization-admin session. Resolves the signed-in user to their
 * organization via organization_admins — never via URL slug, never via a
 * JWT role. The database RLS remains the final authority; this hook only
 * decides what the UI may attempt to read. Pages must additionally verify
 * that the route :slug matches the resolved org.
 */
export function useOrgAdmin() {
  const [state, setState] = useState<OrgAdminState>({
    status: "loading",
    org: null,
    authUserId: null,
  });

  const refresh = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    const user = data.session?.user;

    if (!user) {
      setState({ status: "logged-out", org: null, authUserId: null });
      return;
    }

    try {
      const rows = await fetchMyOrgAdminRows(user.id);

      if (rows.length === 0) {
        setState({ status: "denied", org: null, authUserId: user.id });
        return;
      }

      const org = await fetchOrganization(rows[0].org_id);

      if (!org) {
        setState({ status: "denied", org: null, authUserId: user.id });
        return;
      }

      setState({ status: "active", org, authUserId: user.id });
    } catch {
      setState({ status: "denied", org: null, authUserId: user.id });
    }
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
