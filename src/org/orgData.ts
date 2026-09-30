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

export type DriverSearchResult = {
  id: string;
  username: string | null;
  full_name: string;
  vehicle_type: string | null;
  status: string;
  has_other_membership: boolean;
};

/**
 * Username-prefix search for the Add-Driver picker. Server-enforced:
 * caller must administer at least one organization, active drivers
 * only, five approved fields plus a membership flag, max 10 rows.
 */
export async function searchDriversForMembership(
  search: string
): Promise<DriverSearchResult[]> {
  const { data, error } = await supabase.rpc("find_drivers_for_membership", {
    p_search: search,
  });

  if (error) throw error;
  return (data ?? []) as DriverSearchResult[];
}

export async function addOrganizationMember(
  orgId: string,
  driverId: string
): Promise<void> {
  const { error } = await supabase.from("organization_members").insert({
    org_id: orgId,
    driver_id: driverId,
  });

  if (error) throw error;
}

export async function removeOrganizationMember(
  orgId: string,
  driverId: string
): Promise<void> {
  const { error } = await supabase
    .from("organization_members")
    .delete()
    .eq("org_id", orgId)
    .eq("driver_id", driverId);

  if (error) throw error;
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
export type OrgRideStats = {
  total_rides: number;
  completed_rides: number;
  active_rides: number;
  cancelled_rides: number;
};

/**
 * Aggregate ride statistics for one organization via the read-only
 * org_ride_stats RPC. Returns counts only — no ride, customer, fare, or
 * payment data ever leaves the database. Throws (including on
 * non-admin callers) instead of returning fabricated zeros.
 */
export async function fetchOrgRideStats(
  orgId: string
): Promise<OrgRideStats> {
  const { data, error } = await supabase.rpc("org_ride_stats", {
    p_org_id: orgId,
  });

  if (error) throw error;

  const row = (Array.isArray(data) ? data[0] : data) as OrgRideStats | null;

  if (!row) {
    throw new Error("Ride statistics are unavailable.");
  }

  return {
    total_rides: Number(row.total_rides ?? 0),
    completed_rides: Number(row.completed_rides ?? 0),
    active_rides: Number(row.active_rides ?? 0),
    cancelled_rides: Number(row.cancelled_rides ?? 0),
  };
}

export type OrgForumTopic = {
  id: string;
  org_id: string;
  author_auth_user_id: string;
  title: string;
  body: string;
  created_at: string;
  updated_at: string;
  is_pinned: boolean;
  is_closed: boolean;
};

export type OrgForumPost = {
  id: string;
  topic_id: string;
  author_auth_user_id: string;
  body: string;
  created_at: string;
  updated_at: string;
};

const FORUM_TOPIC_COLUMNS =
  "id,org_id,author_auth_user_id,title,body,created_at,updated_at,is_pinned,is_closed";
const FORUM_POST_COLUMNS =
  "id,topic_id,author_auth_user_id,body,created_at,updated_at";

export async function fetchOrgForumTopics(
  orgId: string
): Promise<OrgForumTopic[]> {
  const { data, error } = await supabase
    .from("org_forum_topics")
    .select(FORUM_TOPIC_COLUMNS)
    .eq("org_id", orgId)
    .order("is_pinned", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as OrgForumTopic[];
}

export async function fetchOrgForumTopic(
  topicId: string
): Promise<OrgForumTopic | null> {
  const { data, error } = await supabase
    .from("org_forum_topics")
    .select(FORUM_TOPIC_COLUMNS)
    .eq("id", topicId)
    .maybeSingle();

  if (error) throw error;
  return (data as OrgForumTopic | null) ?? null;
}

export async function fetchOrgForumPosts(
  topicIds: string[]
): Promise<OrgForumPost[]> {
  if (topicIds.length === 0) return [];
  const { data, error } = await supabase
    .from("org_forum_posts")
    .select(FORUM_POST_COLUMNS)
    .in("topic_id", topicIds)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return (data ?? []) as OrgForumPost[];
}

export async function fetchOrgForumTopicPosts(
  topicId: string
): Promise<OrgForumPost[]> {
  return fetchOrgForumPosts([topicId]);
}

export async function createOrgForumTopic(input: {
  org_id: string;
  title: string;
  body: string;
}): Promise<OrgForumTopic> {
  const { data: sessionData } = await supabase.auth.getSession();
  const authUserId = sessionData.session?.user.id;

  if (!authUserId) {
    throw new Error("Sign in again to post in the forum.");
  }

  const { data, error } = await supabase
    .from("org_forum_topics")
    .insert({
      org_id: input.org_id,
      author_auth_user_id: authUserId,
      title: input.title,
      body: input.body,
    })
    .select(FORUM_TOPIC_COLUMNS)
    .single();

  if (error) throw error;
  return data as OrgForumTopic;
}

export async function updateOrgForumTopic(
  id: string,
  patch: Partial<Pick<OrgForumTopic, "title" | "body" | "is_pinned" | "is_closed">>
): Promise<OrgForumTopic> {
  const { data, error } = await supabase
    .from("org_forum_topics")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select(FORUM_TOPIC_COLUMNS)
    .single();

  if (error) throw error;
  return data as OrgForumTopic;
}

export async function deleteOrgForumTopic(id: string): Promise<void> {
  const { error } = await supabase
    .from("org_forum_topics")
    .delete()
    .eq("id", id);

  if (error) throw error;
}

export async function createOrgForumPost(input: {
  topic_id: string;
  body: string;
}): Promise<OrgForumPost> {
  const { data: sessionData } = await supabase.auth.getSession();
  const authUserId = sessionData.session?.user.id;

  if (!authUserId) {
    throw new Error("Sign in again to post in the forum.");
  }

  const { data, error } = await supabase
    .from("org_forum_posts")
    .insert({
      topic_id: input.topic_id,
      author_auth_user_id: authUserId,
      body: input.body,
    })
    .select(FORUM_POST_COLUMNS)
    .single();

  if (error) throw error;
  return data as OrgForumPost;
}

export async function updateOrgForumPost(
  id: string,
  patch: Partial<Pick<OrgForumPost, "body">>
): Promise<OrgForumPost> {
  const { data, error } = await supabase
    .from("org_forum_posts")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select(FORUM_POST_COLUMNS)
    .single();

  if (error) throw error;
  return data as OrgForumPost;
}

export async function deleteOrgForumPost(id: string): Promise<void> {
  const { error } = await supabase
    .from("org_forum_posts")
    .delete()
    .eq("id", id);

  if (error) throw error;
}

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

/**
 * BTRP mini-system data layer. Every function below is scoped by the same
 * organization RLS as the rest of this file: org admins act only within
 * organizations they administer (enforced DB-side by update_org_driver /
 * provision_org_driver / storage helper / member-row policies), and drivers
 * act only on their own rows. No passwords are ever handled here.
 */

export type MemberDriverDetail = {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  username: string | null;
  vehicle_type: string | null;
  vehicle_model: string | null;
  vehicle_color: string | null;
  vehicle_capacity: number | null;
  plate_number: string | null;
  profile_photo_url: string | null;
  status: string;
  can_accept_pakyawan: boolean;
  can_accept_deliveries: boolean;
  must_change_password: boolean;
};

/**
 * Full driver record for the org-admin editor. Readable only for drivers
 * holding membership in an administered organization (RLS).
 */
export async function fetchMemberDriverDetail(
  driverId: string
): Promise<MemberDriverDetail | null> {
  const { data, error } = await supabase
    .from("drivers")
    .select(
      "id,full_name,phone,email,username,vehicle_type,vehicle_model,vehicle_color,vehicle_capacity,plate_number,profile_photo_url,status,can_accept_pakyawan,can_accept_deliveries,must_change_password"
    )
    .eq("id", driverId)
    .maybeSingle();

  if (error) throw error;
  return (data as MemberDriverDetail | null) ?? null;
}

export type OrgDriverPatch = {
  full_name: string;
  phone: string;
  vehicle_type: string;
  vehicle_model: string;
  vehicle_color: string;
  vehicle_capacity: number | null;
  plate_number: string;
  status: "active" | "inactive";
  can_accept_pakyawan: boolean;
  can_accept_deliveries: boolean;
  profile_photo_url: string;
};

/**
 * Organization-scoped driver update via the update_org_driver RPC.
 * Column allowlist + org authorization are enforced DB-side; auth_user_id,
 * username, and email can never change through this path.
 */
export async function updateOrgDriver(
  driverId: string,
  patch: OrgDriverPatch
): Promise<void> {
  const { error } = await supabase.rpc("update_org_driver", {
    p_driver_id: driverId,
    p_full_name: patch.full_name,
    p_phone: patch.phone,
    p_vehicle_type: patch.vehicle_type,
    p_vehicle_model: patch.vehicle_model,
    p_vehicle_color: patch.vehicle_color,
    p_vehicle_capacity: patch.vehicle_capacity,
    p_plate_number: patch.plate_number,
    p_status: patch.status,
    p_can_accept_pakyawan: patch.can_accept_pakyawan,
    p_can_accept_deliveries: patch.can_accept_deliveries,
    p_profile_photo_url: patch.profile_photo_url,
  });

  if (error) throw error;
}

export type ProvisionDriverInput = {
  org_id: string;
  full_name: string;
  email: string;
  username: string;
  auth_user_id: string;
  phone: string;
  vehicle_type: string;
  vehicle_model: string;
  plate_number: string;
  vehicle_capacity?: number | null;
  vehicle_color?: string | null;
};

/**
 * Organization-scoped provisioning via the provision_org_driver RPC.
 * Creates the drivers row (must_change_password = true) plus the
 * organization membership atomically. The auth account itself must already
 * exist (created via the existing public signup helper); this never
 * handles passwords or service credentials.
 */
export async function provisionOrgDriver(
  input: ProvisionDriverInput
): Promise<string> {
  const { data, error } = await supabase.rpc("provision_org_driver", {
    p_org_id: input.org_id,
    p_full_name: input.full_name,
    p_email: input.email,
    p_username: input.username,
    p_auth_user_id: input.auth_user_id,
    p_phone: input.phone,
    p_vehicle_type: input.vehicle_type,
    p_vehicle_model: input.vehicle_model,
    p_plate_number: input.plate_number,
    p_vehicle_capacity: input.vehicle_capacity ?? null,
    p_vehicle_color: input.vehicle_color ?? null,
  });

  if (error) throw error;
  return data as string;
}

/**
 * Driver clears their own first-login flag after a successful password
 * change. Touches nobody else's row (enforced DB-side).
 */
export async function completeFirstPasswordChange(): Promise<boolean> {
  const { data, error } = await supabase.rpc("complete_first_password_change");

  if (error) throw error;
  return data === true;
}

/**
 * Driver records their own profile photo URL after uploading bytes through
 * the storage policies. URL only — no other field is touched.
 */
export async function updateOwnProfilePhoto(photoUrl: string): Promise<void> {
  const { error } = await supabase.rpc("update_own_profile_photo", {
    p_photo_url: photoUrl,
  });

  if (error) throw error;
}

/**
 * Organization memberships for one driver. A driver may read their own
 * membership rows (RLS); org admins read their org's rows.
 */
export async function fetchMyMemberships(
  driverId: string
): Promise<OrgMemberRow[]> {
  const { data, error } = await supabase
    .from("organization_members")
    .select("org_id,driver_id,role,joined_at")
    .eq("driver_id", driverId);

  if (error) throw error;
  return (data ?? []) as OrgMemberRow[];
}

export type MemberOpsRide = {
  id: string;
  status: string;
  created_at: string;
  driver_id: string;
};

export type MemberOpsBooking = {
  id: string;
  status: string;
  created_at: string;
  driver_id: string | null;
};

/**
 * Read-only member transport rows for admin operational visibility.
 * Scoped to member driver ids; RLS (member-rows policies) enforces the
 * organization boundary. No org_id columns are added anywhere.
 */
export async function fetchMemberRecentRides(
  driverIds: string[],
  limit = 15
): Promise<MemberOpsRide[]> {
  if (driverIds.length === 0) return [];
  const { data, error } = await supabase
    .from("rides")
    .select("id,status,created_at,driver_id")
    .in("driver_id", driverIds)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data ?? []) as MemberOpsRide[];
}

export async function fetchMemberRecentPakyawan(
  driverIds: string[],
  limit = 15
): Promise<MemberOpsBooking[]> {
  if (driverIds.length === 0) return [];
  const { data, error } = await supabase
    .from("pakyawan_bookings")
    .select("id,status,created_at,driver_id")
    .in("driver_id", driverIds)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data ?? []) as MemberOpsBooking[];
}

export async function fetchMemberRecentDeliveries(
  driverIds: string[],
  limit = 15
): Promise<MemberOpsBooking[]> {
  if (driverIds.length === 0) return [];
  const { data, error } = await supabase
    .from("deliveries")
    .select("id,status,created_at,driver_id")
    .in("driver_id", driverIds)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data ?? []) as MemberOpsBooking[];
}

const ORG_PHOTO_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

/**
 * Organization-managed photo path convention:
 *   org-drivers/<driver_id>/profile-photo.<ext>
 * The can_manage_driver_photo storage helper authorizes org admins of the
 * driver's organization plus the driver themself. Legacy admin/<uuid>/...
 * paths stay platform-admin-only and untouched.
 */
export function buildOrgDriverPhotoPath(driverId: string, file: File): string {
  const ext = ORG_PHOTO_EXTENSIONS[file.type] ?? "img";
  return `org-drivers/${driverId}/profile-photo.${ext}`;
}

export async function uploadOrgDriverPhoto(
  driverId: string,
  file: File
): Promise<{ path: string; publicUrl: string }> {
  const path = buildOrgDriverPhotoPath(driverId, file);

  // Remove any previous photo at a sibling extension first so a driver
  // never accumulates orphaned variants; ignore cleanup failures.
  const { error } = await supabase.storage
    .from("driver-photos")
    .upload(path, file, { upsert: true });

  if (error) throw error;

  const { data } = supabase.storage.from("driver-photos").getPublicUrl(path);

  return { path, publicUrl: data.publicUrl };
}

export async function removeOrgDriverPhoto(path: string): Promise<void> {
  if (!path) return;
  const { error } = await supabase.storage
    .from("driver-photos")
    .remove([path]);

  if (error) throw error;
}
