import { supabase } from "../legacy/lib/supabase";

export type OrgRecord = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  logo_url: string | null;
};

export type OrgAdminRow = {
  org_id: string;
};

export type OrgMemberRow = {
  org_id: string;
  driver_id: string;
  role: string;
  joined_at: string;
};

export type MemberDriver = {
  id: string;
  full_name: string;
  username: string | null;
  vehicle_type: string | null;
  vehicle_model: string | null;
  plate_number: string | null;
  status: string;
};

export type MemberPresence = {
  driver_id: string;
  is_online: boolean;
  is_available: boolean;
  current_ride_id: string | null;
  updated_at: string;
};

/**
 * Read-only organization data access. Every query below is scoped by the
 * Phase 1 organization RLS (org admin rows, member rows, member drivers
 * and locations). No transport writes happen here; dispatch, offers,
 * presence, and ride state machines are never touched.
 */
export async function fetchMyOrgAdminRows(
  authUserId: string
): Promise<OrgAdminRow[]> {
  const { data, error } = await supabase
    .from("organization_admins")
    .select("org_id")
    .eq("auth_user_id", authUserId);

  if (error) throw error;
  return (data ?? []) as OrgAdminRow[];
}

export async function fetchOrganization(
  orgId: string
): Promise<OrgRecord | null> {
  const { data, error } = await supabase
    .from("organizations")
    .select("id,name,slug,description,logo_url")
    .eq("id", orgId)
    .maybeSingle();

  if (error) throw error;
  return (data as OrgRecord | null) ?? null;
}

export async function fetchOrgMembers(
  orgId: string
): Promise<OrgMemberRow[]> {
  const { data, error } = await supabase
    .from("organization_members")
    .select("org_id,driver_id,role,joined_at")
    .eq("org_id", orgId)
    .order("joined_at", { ascending: true });

  if (error) throw error;
  return (data ?? []) as OrgMemberRow[];
}

export async function fetchMemberDrivers(
  driverIds: string[]
): Promise<MemberDriver[]> {
  if (driverIds.length === 0) return [];
  const { data, error } = await supabase
    .from("drivers")
    .select("id,full_name,username,vehicle_type,vehicle_model,plate_number,status")
    .in("id", driverIds);

  if (error) throw error;
  return (data ?? []) as MemberDriver[];
}

export async function fetchMemberPresence(
  driverIds: string[]
): Promise<MemberPresence[]> {
  if (driverIds.length === 0) return [];
  const { data, error } = await supabase
    .from("driver_locations")
    .select("driver_id,is_online,is_available,current_ride_id,updated_at")
    .in("driver_id", driverIds);

  if (error) throw error;
  return (data ?? []) as MemberPresence[];
}
