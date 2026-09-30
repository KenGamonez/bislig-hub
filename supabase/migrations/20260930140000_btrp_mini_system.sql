-- BTRP TODA mini-system backend (organization self-administration).
--
-- Adds ONLY additive, explicitly-scoped capabilities. No existing table,
-- policy, function, trigger, grant, RPC, or workflow is modified, with one
-- exception documented in section 7 (forum flag-guard trigger retarget to
-- the function name that actually exists).
--
-- Sections:
--   1. drivers.must_change_password flag (first-login password change)
--   2. update_org_driver RPC (org-scoped driver profile editing)
--   3. provision_org_driver RPC (org-scoped driver + membership creation)
--   4. complete_first_password_change RPC (driver clears own flag)
--   5. can_manage_driver_photo helper + storage policies (org/self photos)
--   6. Org-admin read policies on member transport rows (ops visibility)
--   7. Forum realtime publication + flag-guard trigger fix
--   8. Driver self photo-url update RPC

-- 1. First-login flag ---------------------------------------------------------
alter table public.drivers
  add column if not exists must_change_password boolean not null default false;

-- 2. Organization-scoped driver update ---------------------------------------
-- Allows an org admin to edit EXPLICITLY listed profile columns of drivers
-- who are members of an organization the caller administers. auth_user_id,
-- username, and email are deliberately NOT updatable here (identity and
-- auth linkage stay platform-managed). Passwords are never handled here.
create or replace function public.update_org_driver(
  p_driver_id uuid,
  p_full_name text,
  p_phone text,
  p_vehicle_type text,
  p_vehicle_model text,
  p_vehicle_color text,
  p_vehicle_capacity integer,
  p_plate_number text,
  p_status text,
  p_can_accept_pakyawan boolean,
  p_can_accept_deliveries boolean,
  p_profile_photo_url text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if not exists (
    select 1
    from public.organization_members m
    join public.organization_admins a on a.org_id = m.org_id
    where m.driver_id = p_driver_id
      and a.auth_user_id = auth.uid()
  ) then
    raise exception 'Organization admin access required.'
      using errcode = '42501';
  end if;

  if nullif(trim(coalesce(p_full_name, '')), '') is null then
    raise exception 'Driver full name is required.';
  end if;

  if p_status not in ('active', 'inactive') then
    raise exception 'Invalid driver status.';
  end if;

  update public.drivers
  set
    full_name = trim(p_full_name),
    phone = coalesce(nullif(trim(coalesce(p_phone, '')), ''), phone),
    vehicle_type = coalesce(nullif(trim(coalesce(p_vehicle_type, '')), ''), vehicle_type),
    vehicle_model = nullif(trim(coalesce(p_vehicle_model, '')), ''),
    vehicle_color = nullif(trim(coalesce(p_vehicle_color, '')), ''),
    vehicle_capacity = p_vehicle_capacity,
    plate_number = nullif(trim(coalesce(p_plate_number, '')), ''),
    status = p_status,
    can_accept_pakyawan = coalesce(p_can_accept_pakyawan, can_accept_pakyawan),
    can_accept_deliveries = coalesce(p_can_accept_deliveries, can_accept_deliveries),
    profile_photo_url = nullif(trim(coalesce(p_profile_photo_url, '')), '')
  where id = p_driver_id;

  if not found then
    raise exception 'Driver not found.';
  end if;

  return true;
end;
$fn$;

revoke all on function public.update_org_driver(uuid, text, text, text, text, text, integer, text, text, boolean, boolean, text) from public;
grant execute on function public.update_org_driver(uuid, text, text, text, text, text, integer, text, text, boolean, boolean, text) to authenticated;

-- 3. Organization-scoped driver provisioning ----------------------------------
-- Creates a drivers row (linked to a freshly signed-up auth user) plus the
-- organization membership atomically. The caller must administer p_org_id.
-- Auth user creation itself happens client-side via the existing public
-- signup helper; the unconfirmed account is inert until the driver confirms
-- their own email. must_change_password forces the first-login change.
create or replace function public.provision_org_driver(
  p_org_id uuid,
  p_full_name text,
  p_email text,
  p_username text,
  p_auth_user_id uuid,
  p_phone text,
  p_vehicle_type text,
  p_vehicle_model text,
  p_plate_number text,
  p_vehicle_capacity integer default null,
  p_vehicle_color text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_driver_id uuid;
begin
  if not exists (
    select 1 from public.organization_admins a
    where a.org_id = p_org_id and a.auth_user_id = auth.uid()
  ) then
    raise exception 'Organization admin access required.'
      using errcode = '42501';
  end if;

  if nullif(trim(coalesce(p_full_name, '')), '') is null then
    raise exception 'Driver full name is required.';
  end if;

  if coalesce(trim(p_email), '') not like '%@%' then
    raise exception 'A valid driver email is required.';
  end if;

  if nullif(trim(coalesce(p_username, '')), '') is null then
    raise exception 'A driver username is required.';
  end if;

  if p_auth_user_id is null then
    raise exception 'A linked auth account is required.';
  end if;

  if exists (
    select 1 from public.drivers d
    where lower(coalesce(d.username, '')) = lower(trim(p_username))
  ) then
    raise exception 'That username is already taken.'
      using errcode = '23505';
  end if;

  if exists (
    select 1 from public.drivers d
    where lower(coalesce(d.email, '')) = lower(trim(p_email))
  ) then
    raise exception 'That email is already registered.'
      using errcode = '23505';
  end if;

  if exists (
    select 1 from public.drivers d
    where d.auth_user_id = p_auth_user_id
  ) then
    raise exception 'That auth account is already linked to a driver.'
      using errcode = '23505';
  end if;

  insert into public.drivers (
    full_name, email, username, auth_user_id, phone,
    vehicle_type, vehicle_model, vehicle_color, vehicle_capacity,
    plate_number, status, can_accept_pakyawan, can_accept_deliveries,
    must_change_password
  ) values (
    trim(p_full_name), trim(p_email), trim(p_username), p_auth_user_id,
    nullif(trim(coalesce(p_phone, '')), ''),
    nullif(trim(coalesce(p_vehicle_type, '')), 'sedan'),
    nullif(trim(coalesce(p_vehicle_model, '')), ''),
    nullif(trim(coalesce(p_vehicle_color, '')), ''),
    p_vehicle_capacity,
    nullif(trim(coalesce(p_plate_number, '')), ''),
    'active', true, true, true
  )
  returning id into v_driver_id;

  insert into public.organization_members (org_id, driver_id)
  values (p_org_id, v_driver_id);

  return v_driver_id;
end;
$fn$;

revoke all on function public.provision_org_driver(uuid, text, text, text, uuid, text, text, text, text, integer, text) from public;
grant execute on function public.provision_org_driver(uuid, text, text, text, uuid, text, text, text, text, integer, text) to authenticated;

-- 4. Driver clears their own first-login flag ---------------------------------
-- Called only after a successful password change. Touches nobody else's row.
create or replace function public.complete_first_password_change()
returns boolean
language plpgsql
security definer
set search_path = public
as $fn$
begin
  update public.drivers
  set must_change_password = false
  where auth_user_id = auth.uid()
    and must_change_password = true;

  return found;
end;
$fn$;

revoke all on function public.complete_first_password_change() from public;
grant execute on function public.complete_first_password_change() to authenticated;

-- 5. Driver photo management (org admins + self) ------------------------------
-- Path convention for organization-managed photos (the legacy
-- admin/<uuid>/... convention stays platform-admin-only and untouched):
--   org-drivers/<driver_id>/profile-photo.<ext>
create or replace function public.can_manage_driver_photo(p_path text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.drivers d
    where array_length(string_to_array(p_path, '/'), 1) = 3
      and (string_to_array(p_path, '/'))[1] = 'org-drivers'
      and d.id::text = (string_to_array(p_path, '/'))[2]
      and (
        d.auth_user_id = auth.uid()
        or exists (
          select 1
          from public.organization_members m
          join public.organization_admins a on a.org_id = m.org_id
          where m.driver_id = d.id
            and a.auth_user_id = auth.uid()
        )
      )
  );
$$;

revoke all on function public.can_manage_driver_photo(text) from public;
grant execute on function public.can_manage_driver_photo(text) to authenticated;

drop policy if exists "Organization drivers and admins upload org photos"
  on storage.objects;
create policy "Organization drivers and admins upload org photos"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'driver-photos'
    and public.can_manage_driver_photo(name)
  );

drop policy if exists "Organization drivers and admins replace org photos"
  on storage.objects;
create policy "Organization drivers and admins replace org photos"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'driver-photos'
    and public.can_manage_driver_photo(name)
  )
  with check (
    bucket_id = 'driver-photos'
    and public.can_manage_driver_photo(name)
  );

drop policy if exists "Organization drivers and admins remove org photos"
  on storage.objects;
create policy "Organization drivers and admins remove org photos"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'driver-photos'
    and public.can_manage_driver_photo(name)
  );

-- 6. Read-only member transport visibility for org admins ---------------------
-- Lets an org admin list member drivers' own operational rows. No writes,
-- no customer/message/rating/proof data beyond what these tables hold, and
-- no new columns on transport tables.
drop policy if exists "Organization admins read member rides"
  on public.rides;
create policy "Organization admins read member rides"
  on public.rides for select to authenticated
  using (public.is_org_admin_for_driver(rides.driver_id));

drop policy if exists "Organization admins read member pakyawan bookings"
  on public.pakyawan_bookings;
create policy "Organization admins read member pakyawan bookings"
  on public.pakyawan_bookings for select to authenticated
  using (public.is_org_admin_for_driver(pakyawan_bookings.driver_id));

drop policy if exists "Organization admins read member deliveries"
  on public.deliveries;
create policy "Organization admins read member deliveries"
  on public.deliveries for select to authenticated
  using (public.is_org_admin_for_driver(deliveries.driver_id));

-- 7. Forum realtime publication + flag-guard trigger fix ----------------------
-- The original forum migration references
-- public.forbid_forum_flag_changes_by_members(), but the function that was
-- actually created is public.forbid_forum_topic_flag_changes_by_members().
-- Retarget the trigger at the existing function (idempotent under re-run).
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'org_forum_topics'
  ) then
    alter publication supabase_realtime add table public.org_forum_topics;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'org_forum_posts'
  ) then
    alter publication supabase_realtime add table public.org_forum_posts;
  end if;
end;
$$;

drop trigger if exists org_forum_topics_guard_flags on public.org_forum_topics;
create trigger org_forum_topics_guard_flags
  before update on public.org_forum_topics
  for each row execute function public.forbid_forum_topic_flag_changes_by_members();

-- 8. Driver updates their own profile photo URL -------------------------------
-- Photo bytes go through storage policies above; this only records the URL
-- on the caller's own driver row after a successful upload.
create or replace function public.update_own_profile_photo(p_photo_url text)
returns boolean
language plpgsql
security definer
set search_path = public
as $fn$
begin
  update public.drivers
  set profile_photo_url = nullif(trim(coalesce(p_photo_url, '')), '')
  where auth_user_id = auth.uid();

  if not found then
    raise exception 'Driver profile not found.';
  end if;

  return true;
end;
$fn$;

revoke all on function public.update_own_profile_photo(text) from public;
grant execute on function public.update_own_profile_photo(text) to authenticated;
