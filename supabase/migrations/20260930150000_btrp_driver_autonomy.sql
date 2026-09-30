-- BTRP driver-lifecycle autonomy (Phase 1): organization-owned applications,
-- scoped application review, username rename, and unconfirmed-account
-- recovery. All additive. No existing table, policy, function, trigger,
-- grant, RPC, or workflow is modified. Transport engines untouched.

-- 1. Application → organization association ----------------------------------
-- Nullable so the existing Founder pool (org_id IS NULL) keeps working
-- exactly as before. Applicants opt into an organization; only admins of
-- that organization can ever see the row.
alter table public.driver_applications
  add column if not exists org_id uuid references public.organizations (id) on delete set null;

create index if not exists driver_applications_org_id_idx
  on public.driver_applications (org_id);

-- 2. Public organization directory -------------------------------------------
-- Lets applicants choose a target organization (and any visitor see the
-- directory). Organizations rows carry only public identity fields.
drop policy if exists "Public organization directory"
  on public.organizations;
create policy "Public organization directory"
  on public.organizations for select
  to anon, authenticated
  using (true);

-- 3. Organization-admin application review -----------------------------------
-- Org admins may READ applications targeted at organizations they
-- administer. Rows with org_id IS NULL (platform pool) stay invisible to
-- them — only the platform admin sees everything (existing policy).
drop policy if exists "Organization admins review own organization applications"
  on public.driver_applications;
create policy "Organization admins review own organization applications"
  on public.driver_applications for select
  to authenticated
  using (
    org_id is not null
    and exists (
      select 1 from public.organization_admins a
      where a.org_id = driver_applications.org_id
        and a.auth_user_id = auth.uid()
    )
  );

-- Status/driver linkage changes go through a narrow RPC (column-safe):
-- org admins can never touch applicant PII or files, only the decision.
create or replace function public.review_org_application(
  p_application_id uuid,
  p_decision text,
  p_driver_id uuid default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_org_id uuid;
  v_status text;
begin
  select org_id, status into v_org_id, v_status
  from public.driver_applications
  where id = p_application_id;

  if not found then
    raise exception 'Application not found.';
  end if;

  if v_org_id is null then
    raise exception 'This application is not targeted at your organization.'
      using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.organization_admins a
    where a.org_id = v_org_id and a.auth_user_id = auth.uid()
  ) then
    raise exception 'Organization admin access required.'
      using errcode = '42501';
  end if;

  if v_status <> 'pending' then
    raise exception 'Only pending applications can be reviewed.';
  end if;

  if p_decision = 'approved' then
    if p_driver_id is not null then
      if not exists (
        select 1 from public.organization_members m
        where m.org_id = v_org_id and m.driver_id = p_driver_id
      ) then
        raise exception 'Driver is not a member of this organization.'
          using errcode = '42501';
      end if;
    end if;
    update public.driver_applications
    set status = 'approved',
        driver_id = coalesce(p_driver_id, driver_id)
    where id = p_application_id;
    return true;
  end if;

  if p_decision = 'rejected' then
    update public.driver_applications
    set status = 'rejected'
    where id = p_application_id;
    return true;
  end if;

  raise exception 'Decision must be approved or rejected.';
end;
$fn$;

revoke all on function public.review_org_application(uuid, text, uuid) from public;
grant execute on function public.review_org_application(uuid, text, uuid) to authenticated;

-- 4. Organization-scoped username rename --------------------------------------
-- Usernames are the login identifier, so renames stay tightly controlled:
-- normalized + globally unique (backstopped by the unique index), members
-- of the caller's organization only. Auth email is never touched here —
-- email changes stay Founder-only.
create or replace function public.rename_org_driver(
  p_driver_id uuid,
  p_username text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_username text := lower(trim(coalesce(p_username, '')));
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

  if v_username = '' then
    raise exception 'A driver username is required.';
  end if;

  if length(v_username) > 32 then
    raise exception 'Username must be 32 characters or fewer.';
  end if;

  if exists (
    select 1 from public.drivers d
    where lower(coalesce(d.username, '')) = v_username
      and d.id <> p_driver_id
  ) then
    raise exception 'That username is already taken.'
      using errcode = '23505';
  end if;

  update public.drivers
  set username = trim(coalesce(p_username, ''))
  where id = p_driver_id;

  if not found then
    raise exception 'Driver not found.';
  end if;

  return true;
end;
$fn$;

revoke all on function public.rename_org_driver(uuid, text) from public;
grant execute on function public.rename_org_driver(uuid, text) to authenticated;

-- 5. Unconfirmed-account recovery ----------------------------------------------
-- Recovers exactly one orphan shape: an auth account that exists but was
-- never confirmed and never linked to any driver (e.g. signup succeeded
-- but provisioning failed, blocking retry with a duplicate error). The
-- caller must administer the target org; the account must be unconfirmed
-- AND unlinked; no password is ever handled (the driver sets their own via
-- the existing reset flow). Confirmed accounts and linked accounts are
-- refused — those stay Founder-only recovery.
create or replace function public.adopt_unconfirmed_org_driver(
  p_org_id uuid,
  p_email text,
  p_full_name text,
  p_username text,
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
  v_auth_user_id uuid;
  v_driver_id uuid;
begin
  if not exists (
    select 1 from public.organization_admins a
    where a.org_id = p_org_id and a.auth_user_id = auth.uid()
  ) then
    raise exception 'Organization admin access required.'
      using errcode = '42501';
  end if;

  if coalesce(trim(p_email), '') not like '%@%' then
    raise exception 'A valid driver email is required.';
  end if;

  if nullif(trim(coalesce(p_full_name, '')), '') is null then
    raise exception 'Driver full name is required.';
  end if;

  if nullif(trim(coalesce(p_username, '')), '') is null then
    raise exception 'A driver username is required.';
  end if;

  select u.id into v_auth_user_id
  from auth.users u
  where lower(u.email) = lower(trim(p_email));

  if v_auth_user_id is null then
    raise exception 'No auth account exists for that email. Use normal provisioning instead.';
  end if;

  if exists (
    select 1 from auth.users u
    where u.id = v_auth_user_id
      and u.email_confirmed_at is not null
  ) then
    raise exception 'That account is already confirmed. Use normal provisioning instead.';
  end if;

  if exists (
    select 1 from public.drivers d
    where d.auth_user_id = v_auth_user_id
  ) then
    raise exception 'That auth account is already linked to a driver.'
      using errcode = '23505';
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

  insert into public.drivers (
    full_name, email, username, auth_user_id, phone,
    vehicle_type, vehicle_model, vehicle_color, vehicle_capacity,
    plate_number, status, can_accept_pakyawan, can_accept_deliveries,
    must_change_password
  ) values (
    trim(p_full_name), trim(p_email), trim(p_username), v_auth_user_id,
    nullif(trim(coalesce(p_phone, '')), ''),
    nullif(trim(coalesce(p_vehicle_type, '')), 'sedan'),
    nullif(trim(coalesce(p_vehicle_model, '')), ''),
    nullif(trim(coalesce(p_vehicle_color, '')), ''),
    p_vehicle_capacity,
    nullif(trim(coalesce(p_plate_number, '')), ''),
    'active', true, true, false
  )
  returning id into v_driver_id;

  insert into public.organization_members (org_id, driver_id)
  values (p_org_id, v_driver_id);

  return v_driver_id;
end;
$fn$;

revoke all on function public.adopt_unconfirmed_org_driver(uuid, text, text, text, text, text, text, text, integer, text) from public;
grant execute on function public.adopt_unconfirmed_org_driver(uuid, text, text, text, text, text, text, text, integer, text) to authenticated;
