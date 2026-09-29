-- Phase 3 BTRP TODA announcements.
--
-- One new table only. No existing table, policy, function, trigger, or
-- grant is modified. Drafts (published_at IS NULL) are visible solely to
-- platform admins and administering org admins; members see published
-- rows of their own organization only; anonymous users see nothing.

CREATE TABLE public.org_announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  author_auth_user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  title text NOT NULL,
  body text NOT NULL,
  image_url text,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX org_announcements_org_id_idx
  ON public.org_announcements (org_id);

CREATE INDEX org_announcements_published_at_idx
  ON public.org_announcements (published_at);

ALTER TABLE public.org_announcements ENABLE ROW LEVEL SECURITY;

GRANT ALL ON public.org_announcements TO authenticated;

-- Platform admins keep unrestricted access (existing authority model).
CREATE POLICY "Platform admins manage org announcements"
  ON public.org_announcements FOR ALL TO authenticated
  USING (((auth.jwt() -> 'app_metadata') ->> 'role') = 'admin')
  WITH CHECK (((auth.jwt() -> 'app_metadata') ->> 'role') = 'admin');

-- Organization admins: full lifecycle, own organization only.
-- author_auth_user_id is pinned to auth.uid() so admins cannot
-- impersonate another author.
CREATE POLICY "Organization admins manage own org announcements"
  ON public.org_announcements FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_admins a
      WHERE a.org_id = org_announcements.org_id
        AND a.auth_user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.organization_admins a
      WHERE a.org_id = org_announcements.org_id
        AND a.auth_user_id = auth.uid()
    )
    AND author_auth_user_id = auth.uid()
  );

-- Organization admins read everything in their organization (drafts
-- included). Covered by the manage policy above; stated here for clarity
-- via the same USING clause (no separate policy needed).

-- Member drivers: published rows of their own organization only.
CREATE POLICY "Members read published org announcements"
  ON public.org_announcements FOR SELECT TO authenticated
  USING (
    published_at IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.organization_members m
      JOIN public.drivers d ON d.id = m.driver_id
      WHERE m.org_id = org_announcements.org_id
        AND d.auth_user_id = auth.uid()
    )
  );
