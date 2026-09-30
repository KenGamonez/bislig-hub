-- Organization-scoped Pakyawan / Delivery operations (Phase 2).
--
-- Adds ONLY three new SECURITY DEFINER RPCs plus their EXECUTE grants.
-- No existing table, policy, function, trigger, grant, RPC, or workflow is
-- modified. Transport engines, dispatch, offers, lifecycles, ratings,
-- chats, proofs, auth, and login behavior are untouched.
--
-- Each RPC mirrors its Founder counterpart line-for-line (row locking,
-- status preconditions, price validation, offer withdrawal, ledger writes,
-- actor UUID, 'admin' ledger role, idempotency, error semantics) with ONE
-- difference: the platform-role check is replaced by an
-- organization-membership check via public.is_org_admin_for_driver().
-- Rows with driver_id IS NULL (platform pool) and drivers outside the
-- caller's organizations always raise 42501. The new RPCs never call the
-- admin RPCs internally (their role gate would reject org admins).

-- 1. Organization-scoped Pakyawan quoting ------------------------------------
-- Mirrors admin_quote_pakyawan: exactly one pending row with an assigned
-- member driver moves to quoted with the given price.
create or replace function public.quote_org_pakyawan(
  p_booking_id uuid,
  p_price_cents integer
)
returns public.pakyawan_bookings
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_row public.pakyawan_bookings;
  v_driver_id uuid;
begin
  if p_booking_id is null then
    raise exception 'A booking id is required.';
  end if;

  if p_price_cents is null then
    raise exception 'A quoted price is required.';
  end if;

  if p_price_cents < 0 then
    raise exception 'The quoted price cannot be negative.';
  end if;

  select driver_id into v_driver_id
  from public.pakyawan_bookings
  where id = p_booking_id;

  if not found then
    raise exception 'Pakyawan booking not found.';
  end if;

  if v_driver_id is null then
    raise exception 'Only bookings with an assigned driver can be quoted by an organization.';
  end if;

  if not public.is_org_admin_for_driver(v_driver_id) then
    raise exception 'Organization admin access required.'
      using errcode = '42501';
  end if;

  update public.pakyawan_bookings
     set price_cents = p_price_cents,
         status = 'quoted',
         updated_at = now()
   where id = p_booking_id
     and status = 'pending'
     and driver_id is not null
  returning * into v_row;

  if not found then
    raise exception 'Only pending Pakyawan bookings can be quoted.';
  end if;

  return v_row;
end;
$fn$;

revoke all on function public.quote_org_pakyawan(uuid, integer) from public;
grant execute on function public.quote_org_pakyawan(uuid, integer) to authenticated;

-- 2. Organization-scoped Pakyawan cancellation --------------------------------
-- Mirrors admin_cancel_pakyawan: cancellable statuses, live-offer
-- withdrawal, cancelled status, ledger row (role 'admin', actor = caller),
-- idempotent on already-cancelled rows.
create or replace function public.cancel_org_pakyawan(
  p_booking_id uuid,
  p_reason text
)
returns table (
  booking_id uuid,
  success boolean,
  already_cancelled boolean,
  previous_status text,
  new_status text,
  reason text
)
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_booking public.pakyawan_bookings%rowtype;
  v_actor uuid;
  v_reason text;
begin
  if p_booking_id is null then
    raise exception 'A booking id is required.';
  end if;

  v_reason := trim(both from coalesce(p_reason, ''));

  if v_reason = '' then
    raise exception 'A cancellation reason is required.';
  end if;

  v_actor := auth.uid();

  if v_actor is null then
    raise exception 'Admin identity is required to record this cancellation.'
      using errcode = '42501';
  end if;

  select b.*
    into v_booking
    from public.pakyawan_bookings b
   where b.id = p_booking_id
   for update;

  if not found then
    raise exception 'Pakyawan booking not found.';
  end if;

  if v_booking.driver_id is null then
    raise exception 'Only bookings with an assigned driver can be cancelled by an organization.';
  end if;

  if not public.is_org_admin_for_driver(v_booking.driver_id) then
    raise exception 'Organization admin access required.'
      using errcode = '42501';
  end if;

  if v_booking.status = 'cancelled' then
    return query
      select p_booking_id, true, true, 'cancelled', 'cancelled', v_reason;
    return;
  end if;

  if v_booking.status not in (
    'pending', 'quoted', 'scheduled',
    'driver_on_way', 'driver_arrived', 'in_progress'
  ) then
    raise exception 'This Pakyawan booking cannot be cancelled.';
  end if;

  update public.pakyawan_offers
     set status = 'withdrawn', decided_at = now()
   where booking_id = p_booking_id
     and status = 'offered'
     and expires_at > now();

  update public.pakyawan_bookings
     set status = 'cancelled',
         updated_at = now()
   where id = p_booking_id;

  insert into public.pakyawan_cancellations (
    booking_id,
    cancelled_by,
    cancelled_by_role,
    reason
  )
  values (
    p_booking_id,
    v_actor,
    'admin',
    v_reason
  );

  return query
    select p_booking_id, true, false, v_booking.status, 'cancelled', v_reason;
end;
$fn$;

revoke all on function public.cancel_org_pakyawan(uuid, text) from public;
grant execute on function public.cancel_org_pakyawan(uuid, text) to authenticated;

-- 3. Organization-scoped Delivery cancellation ---------------------------------
-- Mirrors admin_cancel_delivery: every status except delivered/cancelled
-- is cancellable (including dead-end no_driver/failed), live-offer
-- withdrawal, ledger row (role 'admin', actor = caller), idempotent on
-- already-cancelled rows. Delivered (proof-complete) stays terminal.
create or replace function public.cancel_org_delivery(
  p_delivery_id uuid,
  p_reason text
)
returns table (
  delivery_id uuid,
  success boolean,
  already_cancelled boolean,
  previous_status text,
  new_status text,
  reason text
)
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_delivery public.deliveries%rowtype;
  v_actor uuid;
  v_reason text;
begin
  if p_delivery_id is null then
    raise exception 'A delivery id is required.';
  end if;

  v_reason := trim(both from coalesce(p_reason, ''));

  if v_reason = '' then
    raise exception 'A cancellation reason is required.';
  end if;

  v_actor := auth.uid();

  if v_actor is null then
    raise exception 'Admin identity is required to record this cancellation.'
      using errcode = '42501';
  end if;

  select d.*
    into v_delivery
    from public.deliveries d
   where d.id = p_delivery_id
   for update;

  if not found then
    raise exception 'Delivery not found.';
  end if;

  if v_delivery.driver_id is null then
    raise exception 'Only deliveries with an assigned driver can be cancelled by an organization.';
  end if;

  if not public.is_org_admin_for_driver(v_delivery.driver_id) then
    raise exception 'Organization admin access required.'
      using errcode = '42501';
  end if;

  if v_delivery.status = 'cancelled' then
    return query
      select p_delivery_id, true, true, 'cancelled', 'cancelled', v_reason;
    return;
  end if;

  if v_delivery.status in ('delivered') then
    raise exception 'This delivery cannot be cancelled.';
  end if;

  update public.delivery_offers
     set status = 'withdrawn', decided_at = now()
   where delivery_id = p_delivery_id
     and status = 'offered'
     and expires_at > now();

  update public.deliveries
     set status = 'cancelled',
         updated_at = now()
   where id = p_delivery_id;

  insert into public.delivery_cancellations (
    delivery_id,
    cancelled_by,
    cancelled_by_role,
    reason
  )
  values (
    p_delivery_id,
    v_actor,
    'admin',
    v_reason
  );

  return query
    select p_delivery_id, true, false, v_delivery.status, 'cancelled', v_reason;
end;
$fn$;

revoke all on function public.cancel_org_delivery(uuid, text) from public;
grant execute on function public.cancel_org_delivery(uuid, text) to authenticated;
