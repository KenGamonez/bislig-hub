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

export type OrgAnnouncement = {
  id: string;
  org_id: string;
  author_auth_user_id: string;
  title: string;
  body: string;
  image_url: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

export type OrgAnnouncementInput = {
  org_id: string;
  title: string;
  body: string;
  image_url: string | null;
  published_at: string | null;
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

/**
 * Announcements an org admin may manage (drafts + published, own org).
 * RLS enforces the boundary; author pinning is enforced DB-side too.
 */
export async function fetchOrgAnnouncements(
  orgId: string
): Promise<OrgAnnouncement[]> {
  const { data, error } = await supabase
    .from("org_announcements")
    .select(
      "id,org_id,author_auth_user_id,title,body,image_url,published_at,created_at,updated_at"
    )
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as OrgAnnouncement[];
}

export async function createOrgAnnouncement(
  input: OrgAnnouncementInput
): Promise<OrgAnnouncement> {
  const { data: sessionData } = await supabase.auth.getSession();
  const authUserId = sessionData.session?.user.id;

  if (!authUserId) {
    throw new Error("Sign in again to create announcements.");
  }

  const { data, error } = await supabase
    .from("org_announcements")
    .insert({
      org_id: input.org_id,
      author_auth_user_id: authUserId,
      title: input.title,
      body: input.body,
      image_url: input.image_url,
      published_at: input.published_at,
    })
    .select(
      "id,org_id,author_auth_user_id,title,body,image_url,published_at,created_at,updated_at"
    )
    .single();

  if (error) throw error;
  return data as OrgAnnouncement;
}

export async function updateOrgAnnouncement(
  id: string,
  patch: Partial<
    Pick<OrgAnnouncement, "title" | "body" | "image_url" | "published_at">
  >
): Promise<OrgAnnouncement> {
  const { data, error } = await supabase
    .from("org_announcements")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select(
      "id,org_id,author_auth_user_id,title,body,image_url,published_at,created_at,updated_at"
    )
    .single();

  if (error) throw error;
  return data as OrgAnnouncement;
}

export async function deleteOrgAnnouncement(id: string): Promise<void> {
  const { error } = await supabase
    .from("org_announcements")
    .delete()
    .eq("id", id);

  if (error) throw error;
}

/**
 * Reusable member read layer for the future driver "My Group"
 * experience: published announcements of every organization the
 * signed-in member-driver belongs to. RLS (published-only + own org)
 * enforces visibility; this only shapes the query.
 */
export async function fetchPublishedAnnouncementsForMember(
  authUserId: string
): Promise<OrgAnnouncement[]> {
  const { data: memberships, error: membershipError } = await supabase
    .from("organization_members")
    .select("org_id, drivers!inner(auth_user_id)")
    .eq("drivers.auth_user_id", authUserId);

  if (membershipError) throw membershipError;

  const orgIds = Array.from(
    new Set(
      ((memberships ?? []) as Array<{ org_id: string }>).map((row) => row.org_id)
    )
  );

  if (orgIds.length === 0) return [];

  const { data, error } = await supabase
    .from("org_announcements")
    .select(
      "id,org_id,author_auth_user_id,title,body,image_url,published_at,created_at,updated_at"
    )
    .in("org_id", orgIds)
    .not("published_at", "is", null)
    .order("published_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as OrgAnnouncement[];
}
