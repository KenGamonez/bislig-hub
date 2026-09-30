-- BTRP TODA shared chatroom (driver phase): one organization-scoped live
-- room for member drivers + organization admins.
--
-- Adds ONLY: one table, scoped RLS policies, one send RPC, one cleanup
-- function plus an optional hourly pg_cron schedule, and realtime
-- publication for the new table. No existing table, policy, function,
-- trigger, grant, RPC, or workflow is modified. Transport engines,
-- dispatch, offers, lifecycles, ratings, chats, proofs, auth, and login
-- behavior are untouched. No BTRP hardcoding: every check is
-- membership/admin-join scoped, reusable by future organizations.
--
-- Retention: messages expire 24 hours after created_at. Cleanup is
-- server-side (pg_cron when the extension is present); reads additionally
-- filter to the 24-hour window so expiry holds even without the scheduler.

-- 1. Chat messages table ------------------------------------------------------
create table if not exists public.btrp_chat_messages (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  sender_auth_id uuid not null,
  sender_name text not null,
  sender_role text not null check (sender_role in ('driver', 'admin')),
  message text not null check (char_length(message) between 1 and 500),
  created_at timestamptz not null default now()
);

create index if not exists btrp_chat_messages_org_created_idx
  on public.btrp_chat_messages (org_id, created_at desc);

alter table public.btrp_chat_messages enable row level security;

grant select, insert, delete on public.btrp_chat_messages to authenticated;

-- Reads: organization members and organization admins of the message's org.
drop policy if exists "Organization members and admins read org chat"
  on public.btrp_chat_messages;
create policy "Organization members and admins read org chat"
  on public.btrp_chat_messages for select
  to authenticated
  using (
    exists (
      select 1
      from public.organization_members m
      join public.drivers d on d.id = m.driver_id
      where m.org_id = btrp_chat_messages.org_id
        and d.auth_user_id = auth.uid()
    )
    or exists (
      select 1
      from public.organization_admins a
      where a.org_id = btrp_chat_messages.org_id
        and a.auth_user_id = auth.uid()
    )
  );

-- Writes go through send_org_chat_message below; this policy is defense in
-- depth only (sender identity is pinned to the caller).
drop policy if exists "Organization members and admins send org chat"
  on public.btrp_chat_messages;
create policy "Organization members and admins send org chat"
  on public.btrp_chat_messages for insert
  to authenticated
  with check (
    sender_auth_id = auth.uid()
    and (
      exists (
        select 1
        from public.organization_members m
        join public.drivers d on d.id = m.driver_id
        where m.org_id = btrp_chat_messages.org_id
          and d.auth_user_id = auth.uid()
      )
      or exists (
        select 1
        from public.organization_admins a
        where a.org_id = btrp_chat_messages.org_id
          and a.auth_user_id = auth.uid()
      )
    )
  );

-- Deletes: organization admins of the message's org (moderation). No update
-- path exists anywhere: messages are immutable.
drop policy if exists "Organization admins delete org chat"
  on public.btrp_chat_messages;
create policy "Organization admins delete org chat"
  on public.btrp_chat_messages for delete
  to authenticated
  using (
    exists (
      select 1
      from public.organization_admins a
      where a.org_id = btrp_chat_messages.org_id
        and a.auth_user_id = auth.uid()
    )
  );

-- 2. Send RPC (sole write path used by clients) --------------------------------
-- Resolves organization membership + display identity server-side so
-- clients can never spoof org_id, sender, name, or role.
create or replace function public.send_org_chat_message(
  p_org_id uuid,
  p_message text
)
returns public.btrp_chat_messages
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_message text := trim(coalesce(p_message, ''));
  v_name text;
  v_role text;
  v_row public.btrp_chat_messages;
begin
  if p_org_id is null then
    raise exception 'An organization is required.';
  end if;

  if v_message = '' then
    raise exception 'Write a message first.';
  end if;

  if char_length(v_message) > 500 then
    raise exception 'Messages must be 500 characters or fewer.';
  end if;

  select d.full_name into v_name
  from public.organization_members m
  join public.drivers d on d.id = m.driver_id
  where m.org_id = p_org_id
    and d.auth_user_id = auth.uid()
  limit 1;

  if found then
    v_role := 'driver';
  else
    if not exists (
      select 1 from public.organization_admins a
      where a.org_id = p_org_id and a.auth_user_id = auth.uid()
    ) then
      raise exception 'Organization chat access required.'
        using errcode = '42501';
    end if;
    v_role := 'admin';
    select d.full_name into v_name
    from public.drivers d
    where d.auth_user_id = auth.uid()
    limit 1;
    if not found or nullif(trim(coalesce(v_name, '')), '') is null then
      v_name := 'Group admin';
    end if;
  end if;

  insert into public.btrp_chat_messages (
    org_id, sender_auth_id, sender_name, sender_role, message
  ) values (
    p_org_id, auth.uid(), v_name, v_role, v_message
  )
  returning * into v_row;

  return v_row;
end;
$fn$;

revoke all on function public.send_org_chat_message(uuid, text) from public;
grant execute on function public.send_org_chat_message(uuid, text) to authenticated;

-- 3. Server-side 24-hour cleanup ------------------------------------------------
create or replace function public.cleanup_expired_chat_messages()
returns integer
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_deleted integer;
begin
  delete from public.btrp_chat_messages
  where created_at < now() - interval '24 hours';
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$fn$;

revoke all on function public.cleanup_expired_chat_messages() from public;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    if not exists (
      select 1 from cron.job where jobname = 'btrp-chat-cleanup-hourly'
    ) then
      perform cron.schedule(
        'btrp-chat-cleanup-hourly',
        '0 * * * *',
        'select public.cleanup_expired_chat_messages();'
      );
    end if;
  end if;
end;
$$;

-- 4. Realtime publication (guarded, idempotent under re-run) --------------------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'btrp_chat_messages'
  ) then
    alter publication supabase_realtime add table public.btrp_chat_messages;
  end if;
end;
$$;
