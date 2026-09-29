-- Phase 6.4 organization driver membership management.
--
-- Adds ONLY: two scoped write policies on organization_members and one
-- gated lookup RPC. No existing table, policy, function, trigger, grant,
-- RPC, or workflow is modified. Organization admins gain exactly
-- INSERT + DELETE within organizations they administer; members gain
-- nothing new; anonymous gains nothing.

-- Org admins may add memberships only to organizations they administer.
CREATE POLICY "Organization admins insert organization memberships"
  ON public.organization_members FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.organization_admins a
      WHERE a.org_id = organization_members.org_id
        AND a.auth_user_id = auth.uid()
    )
  );

-- Org admins may remove memberships only from organizations they administer.
-- The driver row itself is never touched (membership row only).
CREATE POLICY "Organization admins delete organization memberships"
  ON public.organization_members FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_admins a
      WHERE a.org_id = organization_members.org_id
        AND a.auth_user_id = auth.uid()
    )
  );

-- Gated driver lookup for the Add-Driver picker. Returns only the five
-- approved fields for ACTIVE drivers whose username starts with the
-- given prefix (minimum 2 characters), plus whether the driver already
-- belongs to another organization. The caller must administer at least
-- one organization; everyone else (including plain drivers and
-- anonymous, who additionally lack EXECUTE) is rejected with 42501.
-- Never exposes phone, email, auth linkage, location, or customer data.
CREATE OR REPLACE FUNCTION public.find_drivers_for_membership(p_search text)
RETURNS TABLE (
  id uuid,
  username text,
  full_name text,
  vehicle_type text,
  status text,
  has_other_membership boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
declare
  v_prefix text;
begin
  if p_search is null or length(trim(both from p_search)) < 2 then
    return;
  end if;

  if not exists (
    select 1 from public.organization_admins a
    where a.auth_user_id = auth.uid()
  ) then
    raise exception 'Organization admin access required.'
      using errcode = '42501';
  end if;

  v_prefix := lower(trim(both from p_search)) || '%';

  return query
  select
    d.id,
    d.username,
    d.full_name,
    d.vehicle_type,
    d.status,
    exists (
      select 1 from public.organization_members m
      where m.driver_id = d.id
    ) as has_other_membership
  from public.drivers d
  where d.status = 'active'
    and lower(coalesce(d.username, '')) like v_prefix
  order by d.username
  limit 10;
end;
$fn$;

REVOKE ALL ON FUNCTION public.find_drivers_for_membership(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.find_drivers_for_membership(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.find_drivers_for_membership(text) TO service_role;
