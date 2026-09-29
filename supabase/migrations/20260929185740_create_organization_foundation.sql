-- Phase 1 BTRP TODA organization foundation.
--
-- Creates ONLY 3 new tables plus additive RLS. No existing table, policy,
-- function, trigger, or grant is modified. Organization membership is never
-- referenced by transport/dispatch/presence/notification flows: those code
-- paths join only drivers/driver_locations/rides/offers tables, so drivers
-- without an organization_members row (independent drivers) are
-- structurally unaffected.
--
-- RLS notes:
-- * Org membership checks that would otherwise reference RLS-protected
--   tables from both sides (drivers <-> organization_members) go through
--   is_org_admin_for_driver(), a read-only SECURITY DEFINER helper with a
--   fixed search_path, so policy evaluation always terminates.
-- * driver_profiles is a view over drivers; the new drivers SELECT policy
--   below automatically scopes it. No policy can or will be created on it.

-- 1. organizations --------------------------------------------------------
CREATE TABLE public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  description text,
  logo_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 2. organization_members --------------------------------------------------
-- One row per driver per organization. Independent drivers have NO row.
CREATE TABLE public.organization_members (
  org_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  driver_id uuid NOT NULL REFERENCES public.drivers (id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member',
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (org_id, driver_id),
  CONSTRAINT organization_members_role_check CHECK (role = 'member')
);

CREATE INDEX organization_members_driver_id_idx
  ON public.organization_members (driver_id);

-- 3. organization_admins ----------------------------------------------------
-- Table-driven adminship: no Auth/JWT role is created or required.
CREATE TABLE public.organization_admins (
  org_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  auth_user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (org_id, auth_user_id)
);

CREATE INDEX organization_admins_auth_user_id_idx
  ON public.organization_admins (auth_user_id);

-- 4. RLS ---------------------------------------------------------------------
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_admins ENABLE ROW LEVEL SECURITY;

-- Base table privileges: RLS policies below do the actual enforcement.
-- (anon receives nothing: every organization feature requires login.)
GRANT ALL ON public.organizations TO authenticated;
GRANT ALL ON public.organization_members TO authenticated;
GRANT ALL ON public.organization_admins TO authenticated;

-- Read-only helper: is the calling user an admin of the driver's org?
-- SECURITY DEFINER so policy evaluation never recurses through RLS.
CREATE OR REPLACE FUNCTION public.is_org_admin_for_driver(p_driver_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_members m
    JOIN public.organization_admins a ON a.org_id = m.org_id
    WHERE m.driver_id = p_driver_id
      AND a.auth_user_id = auth.uid()
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_org_admin_for_driver(uuid) TO authenticated;

-- Platform admins keep unrestricted access (existing authority model).
CREATE POLICY "Platform admins manage organizations"
  ON public.organizations FOR ALL TO authenticated
  USING (((auth.jwt() -> 'app_metadata') ->> 'role') = 'admin')
  WITH CHECK (((auth.jwt() -> 'app_metadata') ->> 'role') = 'admin');

CREATE POLICY "Platform admins manage organization members"
  ON public.organization_members FOR ALL TO authenticated
  USING (((auth.jwt() -> 'app_metadata') ->> 'role') = 'admin')
  WITH CHECK (((auth.jwt() -> 'app_metadata') ->> 'role') = 'admin');

CREATE POLICY "Platform admins manage organization admins"
  ON public.organization_admins FOR ALL TO authenticated
  USING (((auth.jwt() -> 'app_metadata') ->> 'role') = 'admin')
  WITH CHECK (((auth.jwt() -> 'app_metadata') ->> 'role') = 'admin');

-- Organization admins read their own admin rows and organization record.
CREATE POLICY "Organization admins read own admin rows"
  ON public.organization_admins FOR SELECT TO authenticated
  USING (auth_user_id = auth.uid());

CREATE POLICY "Organization admins read own organization"
  ON public.organizations FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_admins a
      WHERE a.org_id = organizations.id AND a.auth_user_id = auth.uid()
    )
  );

-- Organization admins read member rows of their own organization only.
CREATE POLICY "Organization admins read own organization members"
  ON public.organization_members FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_admins a
      WHERE a.org_id = organization_members.org_id AND a.auth_user_id = auth.uid()
    )
  );

-- Member drivers read their own organization record and membership row
-- (supports the future driver "My Group" experience; nothing broader).
CREATE POLICY "Members read own organization"
  ON public.organizations FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.organization_members m
      JOIN public.drivers d ON d.id = m.driver_id
      WHERE m.org_id = organizations.id AND d.auth_user_id = auth.uid()
    )
  );

CREATE POLICY "Members read own membership row"
  ON public.organization_members FOR SELECT TO authenticated
  USING (
    driver_id IN (SELECT d.id FROM public.drivers d WHERE d.auth_user_id = auth.uid())
  );

-- ADDITIVE scoped reads on transport tables. Existing policies untouched.
-- Org admins see rows ONLY for drivers holding membership in their org.
CREATE POLICY "Organization admins read member drivers"
  ON public.drivers FOR SELECT TO authenticated
  USING (public.is_org_admin_for_driver(drivers.id));

CREATE POLICY "Organization admins read member driver locations"
  ON public.driver_locations FOR SELECT TO authenticated
  USING (public.is_org_admin_for_driver(driver_locations.driver_id));
