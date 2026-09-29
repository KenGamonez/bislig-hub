-- Phase 5.1 org ride statistics (aggregates only).
--
-- Read-only SECURITY DEFINER RPC returning dashboard counts for one
-- organization. No ride/customer/payment fields leave the database:
-- only total/completed/active/cancelled counts. The caller must
-- administer p_org_id or the call raises; independent and foreign
-- drivers can never contribute because the join requires an
-- organization_members row in p_org_id. No existing object is modified.

CREATE OR REPLACE FUNCTION public.org_ride_stats(p_org_id uuid)
RETURNS TABLE (
  total_rides bigint,
  completed_rides bigint,
  active_rides bigint,
  cancelled_rides bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
begin
  if p_org_id is null then
    raise exception 'An organization id is required.';
  end if;

  if not exists (
    select 1 from public.organization_admins a
    where a.org_id = p_org_id and a.auth_user_id = auth.uid()
  ) then
    raise exception 'Organization admin access required.'
      using errcode = '42501';
  end if;

  return query
  select
    count(*)::bigint,
    count(*) filter (where r.status = 'completed')::bigint,
    count(*) filter (where r.status in ('requested', 'accepted', 'arrived', 'in_progress'))::bigint,
    count(*) filter (where r.status = 'cancelled')::bigint
  from public.rides r
  join public.organization_members m
    on m.driver_id = r.driver_id
   and m.org_id = p_org_id;
end;
$fn$;

REVOKE ALL ON FUNCTION public.org_ride_stats(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.org_ride_stats(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.org_ride_stats(uuid) TO service_role;
