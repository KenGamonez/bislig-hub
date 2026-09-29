-- Phase 4 BTRP TODA forum: topics + replies, organization-scoped.
--
-- New tables/policies only. No existing table, policy, function, trigger,
-- grant, RPC, or workflow is modified. RLS enforces every boundary below;
-- the frontend never filters for security.
--
-- Notes:
-- * author_auth_user_id is pinned to auth.uid() on every INSERT.
-- * Members may edit/delete only their own rows and may never change
--   is_pinned / is_closed (WITH CHECK against OLD), so moderation stays
--   admin-only. Co-admin edits of another admin's rows are rejected by
--   the same author pin (accepted Phase 3 limitation, kept consistent).
-- * Closed topics reject member replies at the database level via the
--   INSERT policy below.

CREATE TABLE public.org_forum_topics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  author_auth_user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  title text NOT NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  is_pinned boolean NOT NULL DEFAULT false,
  is_closed boolean NOT NULL DEFAULT false
);

CREATE TABLE public.org_forum_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id uuid NOT NULL REFERENCES public.org_forum_topics (id) ON DELETE CASCADE,
  author_auth_user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX org_forum_topics_org_created_idx
  ON public.org_forum_topics (org_id, created_at DESC);

CREATE INDEX org_forum_posts_topic_created_idx
  ON public.org_forum_posts (topic_id, created_at ASC);

ALTER TABLE public.org_forum_topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_forum_posts ENABLE ROW LEVEL SECURITY;

GRANT ALL ON public.org_forum_topics TO authenticated;
GRANT ALL ON public.org_forum_posts TO authenticated;

-- Platform admins keep unrestricted access (existing authority model).
CREATE POLICY "Platform admins manage forum topics"
  ON public.org_forum_topics FOR ALL TO authenticated
  USING (((auth.jwt() -> 'app_metadata') ->> 'role') = 'admin')
  WITH CHECK (((auth.jwt() -> 'app_metadata') ->> 'role') = 'admin');

CREATE POLICY "Platform admins manage forum posts"
  ON public.org_forum_posts FOR ALL TO authenticated
  USING (((auth.jwt() -> 'app_metadata') ->> 'role') = 'admin')
  WITH CHECK (((auth.jwt() -> 'app_metadata') ->> 'role') = 'admin');

-- Organization admins: full lifecycle within their own organization.
CREATE POLICY "Organization admins select forum topics"
  ON public.org_forum_topics FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_admins a
      WHERE a.org_id = org_forum_topics.org_id AND a.auth_user_id = auth.uid()
    )
  );

CREATE POLICY "Organization admins insert forum topics"
  ON public.org_forum_topics FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.organization_admins a
      WHERE a.org_id = org_forum_topics.org_id AND a.auth_user_id = auth.uid()
    )
    AND author_auth_user_id = auth.uid()
  );

CREATE POLICY "Organization admins update forum topics"
  ON public.org_forum_topics FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_admins a
      WHERE a.org_id = org_forum_topics.org_id AND a.auth_user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.organization_admins a
      WHERE a.org_id = org_forum_topics.org_id AND a.auth_user_id = auth.uid()
    )
    AND author_auth_user_id = auth.uid()
  );

CREATE POLICY "Organization admins delete forum topics"
  ON public.org_forum_topics FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_admins a
      WHERE a.org_id = org_forum_topics.org_id AND a.auth_user_id = auth.uid()
    )
  );

CREATE POLICY "Organization admins select forum posts"
  ON public.org_forum_posts FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.org_forum_topics t
      JOIN public.organization_admins a ON a.org_id = t.org_id
      WHERE t.id = org_forum_posts.topic_id AND a.auth_user_id = auth.uid()
    )
  );

CREATE POLICY "Organization admins insert forum posts"
  ON public.org_forum_posts FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.org_forum_topics t
      JOIN public.organization_admins a ON a.org_id = t.org_id
      WHERE t.id = org_forum_posts.topic_id AND a.auth_user_id = auth.uid()
    )
    AND author_auth_user_id = auth.uid()
  );

CREATE POLICY "Organization admins update forum posts"
  ON public.org_forum_posts FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.org_forum_topics t
      JOIN public.organization_admins a ON a.org_id = t.org_id
      WHERE t.id = org_forum_posts.topic_id AND a.auth_user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.org_forum_topics t
      JOIN public.organization_admins a ON a.org_id = t.org_id
      WHERE t.id = org_forum_posts.topic_id AND a.auth_user_id = auth.uid()
    )
    AND author_auth_user_id = auth.uid()
  );

CREATE POLICY "Organization admins delete forum posts"
  ON public.org_forum_posts FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.org_forum_topics t
      JOIN public.organization_admins a ON a.org_id = t.org_id
      WHERE t.id = org_forum_posts.topic_id AND a.auth_user_id = auth.uid()
    )
  );

-- Members: read own organization's forum; create topics and replies;
-- edit/delete only their own rows; never touch pin/close flags; never
-- reply in closed topics (all enforced below, not in UI).
CREATE POLICY "Members read forum topics"
  ON public.org_forum_topics FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.organization_members m
      JOIN public.drivers d ON d.id = m.driver_id
      WHERE m.org_id = org_forum_topics.org_id AND d.auth_user_id = auth.uid()
    )
  );

CREATE POLICY "Members insert forum topics"
  ON public.org_forum_topics FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.organization_members m
      JOIN public.drivers d ON d.id = m.driver_id
      WHERE m.org_id = org_forum_topics.org_id AND d.auth_user_id = auth.uid()
    )
    AND author_auth_user_id = auth.uid()
    AND is_pinned = false
    AND is_closed = false
  );

CREATE POLICY "Members update own forum topics"
  ON public.org_forum_topics FOR UPDATE TO authenticated
  USING (
    author_auth_user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.organization_members m
      JOIN public.drivers d ON d.id = m.driver_id
      WHERE m.org_id = org_forum_topics.org_id AND d.auth_user_id = auth.uid()
    )
  )
  WITH CHECK (
    author_auth_user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.organization_members m
      JOIN public.drivers d ON d.id = m.driver_id
      WHERE m.org_id = org_forum_topics.org_id AND d.auth_user_id = auth.uid()
    )
  );

-- Pin/close flags may only change via platform or organization admins.
-- WITH CHECK cannot compare against the previous row, so a tiny trigger
-- enforces this; everything else stays in RLS policies above.
CREATE OR REPLACE FUNCTION public.forbid_forum_topic_flag_changes_by_members()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
begin
  if OLD.is_pinned is not distinct from NEW.is_pinned
     and OLD.is_closed is not distinct from NEW.is_closed then
    return NEW;
  end if;

  if (((auth.jwt() -> 'app_metadata') ->> 'role') = 'admin') then
    return NEW;
  end if;

  if exists (
    select 1 from public.organization_admins a
    where a.org_id = OLD.org_id and a.auth_user_id = auth.uid()
  ) then
    return NEW;
  end if;

  raise exception 'Only organization admins can pin or close topics.'
    using errcode = '42501';
end;
$fn$;

CREATE TRIGGER org_forum_topics_guard_flags
  BEFORE UPDATE ON public.org_forum_topics
  FOR EACH ROW EXECUTE FUNCTION public.forbid_forum_flag_changes_by_members();

CREATE POLICY "Members delete own forum topics"
  ON public.org_forum_topics FOR DELETE TO authenticated
  USING (
    author_auth_user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.organization_members m
      JOIN public.drivers d ON d.id = m.driver_id
      WHERE m.org_id = org_forum_topics.org_id AND d.auth_user_id = auth.uid()
    )
  );

CREATE POLICY "Members read forum posts"
  ON public.org_forum_posts FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.org_forum_topics t
      JOIN public.organization_members m ON m.org_id = t.org_id
      JOIN public.drivers d ON d.id = m.driver_id
      WHERE t.id = org_forum_posts.topic_id AND d.auth_user_id = auth.uid()
    )
  );

CREATE POLICY "Members insert forum posts"
  ON public.org_forum_posts FOR INSERT TO authenticated
  WITH CHECK (
    author_auth_user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.org_forum_topics t
      JOIN public.organization_members m ON m.org_id = t.org_id
      JOIN public.drivers d ON d.id = m.driver_id
      WHERE t.id = org_forum_posts.topic_id
        AND d.auth_user_id = auth.uid()
        AND t.is_closed = false
    )
  );

CREATE POLICY "Members update own forum posts"
  ON public.org_forum_posts FOR UPDATE TO authenticated
  USING (
    author_auth_user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.org_forum_topics t
      JOIN public.organization_members m ON m.org_id = t.org_id
      JOIN public.drivers d ON d.id = m.driver_id
      WHERE t.id = org_forum_posts.topic_id AND d.auth_user_id = auth.uid()
    )
  )
  WITH CHECK (
    author_auth_user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.org_forum_topics t
      JOIN public.organization_members m ON m.org_id = t.org_id
      JOIN public.drivers d ON d.id = m.driver_id
      WHERE t.id = org_forum_posts.topic_id AND d.auth_user_id = auth.uid()
    )
  );

CREATE POLICY "Members delete own forum posts"
  ON public.org_forum_posts FOR DELETE TO authenticated
  USING (
    author_auth_user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.org_forum_topics t
      JOIN public.organization_members m ON m.org_id = t.org_id
      JOIN public.drivers d ON d.id = m.driver_id
      WHERE t.id = org_forum_posts.topic_id AND d.auth_user_id = auth.uid()
    )
  );
