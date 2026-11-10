-- VIBE OS — team: invites, member names, owner protection, tasks.

alter table public.workspace_members
  add column display_name text not null default '' check (length(display_name) <= 60);

-- ============================================================
-- Owner protection: the owner row can never be changed or removed,
-- so a workspace can't end up without an owner.
-- ============================================================
create or replace function public.protect_owner() returns trigger
language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    if old.role = 'owner' then raise exception 'owner_protected'; end if;
    return old;
  end if;
  if old.role = 'owner' and (new.role <> 'owner' or new.user_id <> old.user_id or new.workspace_id <> old.workspace_id) then
    raise exception 'owner_protected';
  end if;
  if old.role <> 'owner' and new.role = 'owner' then raise exception 'owner_protected'; end if;
  return new;
end $$;
create trigger workspace_members_protect_owner before update or delete on public.workspace_members
  for each row execute function public.protect_owner();

-- Members may update their own display name (and nothing else) via this RPC.
create or replace function public.set_my_display_name(p_workspace uuid, p_name text) returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.workspace_members set display_name = left(trim(coalesce(p_name, '')), 60)
  where workspace_id = p_workspace and user_id = auth.uid();
end $$;

-- ============================================================
-- Invites: one-time codes, 7 days, created by the owner.
-- ============================================================
create table public.invites (
  code text primary key check (code ~ '^[A-HJ-NP-Z2-9]{8}$'),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  role public.member_role not null check (role <> 'owner'),
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 days',
  used_by uuid references auth.users(id) on delete set null,
  used_at timestamptz
);
create index on public.invites (workspace_id);
alter table public.invites enable row level security;
create policy inv_owner on public.invites for select to authenticated
  using (public.has_role(workspace_id, array['owner']::public.member_role[]));
create policy inv_owner_delete on public.invites for delete to authenticated
  using (public.has_role(workspace_id, array['owner']::public.member_role[]));
revoke all on public.invites from anon;
grant select, delete on public.invites to authenticated;

-- Unambiguous alphabet: no 0/O, 1/I/L.
create or replace function public.create_invite(p_workspace uuid, p_role public.member_role) returns text
language plpgsql security definer set search_path = public as $$
declare
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  c text; i int; tries int := 0; open_count int;
begin
  if not public.has_role(p_workspace, array['owner']::public.member_role[]) then raise exception 'not_owner'; end if;
  if p_role = 'owner' then raise exception 'invalid_role'; end if;
  select count(*) into open_count from public.invites
    where workspace_id = p_workspace and used_at is null and expires_at > now();
  if open_count >= 20 then raise exception 'too_many_invites'; end if;
  loop
    c := '';
    for i in 1..8 loop
      c := c || substr(alphabet, 1 + (get_byte(gen_random_bytes(1), 0) % length(alphabet)), 1);
    end loop;
    begin
      insert into public.invites (code, workspace_id, role, created_by) values (c, p_workspace, p_role, auth.uid());
      return c;
    exception when unique_violation then
      tries := tries + 1;
      if tries > 5 then raise; end if;
    end;
  end loop;
end $$;

-- Accept a code: becomes a member with the invited role. Codes are case-insensitive, dashes/spaces ignored.
create or replace function public.accept_invite(p_code text, p_display_name text default '') returns uuid
language plpgsql security definer set search_path = public as $$
declare inv public.invites; clean text;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  clean := upper(regexp_replace(coalesce(p_code, ''), '[\s-]', '', 'g'));
  select * into inv from public.invites where code = clean for update;
  if inv.code is null then raise exception 'invite_not_found'; end if;
  if inv.used_at is not null then raise exception 'invite_used'; end if;
  if inv.expires_at < now() then raise exception 'invite_expired'; end if;
  if exists (select 1 from public.workspace_members where workspace_id = inv.workspace_id and user_id = auth.uid()) then
    raise exception 'already_member';
  end if;
  insert into public.workspace_members (workspace_id, user_id, role, display_name)
    values (inv.workspace_id, auth.uid(), inv.role, left(trim(coalesce(p_display_name, '')), 60));
  update public.invites set used_by = auth.uid(), used_at = now() where code = inv.code;
  return inv.workspace_id;
end $$;

-- Team list with emails, only for members of that workspace.
create or replace function public.team_members(p_workspace uuid)
returns table (user_id uuid, role public.member_role, display_name text, email text, joined_at timestamptz)
language sql stable security definer set search_path = public, auth as $$
  select m.user_id, m.role, m.display_name, u.email::text, m.created_at
  from public.workspace_members m join auth.users u on u.id = m.user_id
  where m.workspace_id = p_workspace and public.is_member(p_workspace)
  order by (m.role = 'owner') desc, m.created_at;
$$;

revoke all on function public.create_invite(uuid, public.member_role) from public, anon;
revoke all on function public.accept_invite(text, text) from public, anon;
revoke all on function public.team_members(uuid) from public, anon;
revoke all on function public.set_my_display_name(uuid, text) from public, anon;
grant execute on function public.create_invite(uuid, public.member_role) to authenticated;
grant execute on function public.accept_invite(text, text) to authenticated;
grant execute on function public.team_members(uuid) to authenticated;
grant execute on function public.set_my_display_name(uuid, text) to authenticated;

-- ============================================================
-- Tasks
-- ============================================================
create table public.tasks (
  id text primary key check (length(id) between 8 and 64),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  title text not null check (length(title) between 1 and 150),
  note text not null default '' check (length(note) <= 1000),
  assignee_id uuid references auth.users(id) on delete set null,
  due date,
  event_id text,
  done boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  synced_at timestamptz not null default now()
);
create index on public.tasks (workspace_id, synced_at);

-- Assignees who are not owner/manager may only tick done/undone.
create or replace function public.task_assignee_guard() returns trigger
language plpgsql as $$
begin
  if public.has_role(new.workspace_id, array['owner','manager']::public.member_role[]) then return new; end if;
  if new.title is distinct from old.title or new.note is distinct from old.note
     or new.assignee_id is distinct from old.assignee_id or new.due is distinct from old.due
     or new.event_id is distinct from old.event_id or new.deleted_at is distinct from old.deleted_at
     or new.workspace_id is distinct from old.workspace_id then
    raise exception 'assignee_can_only_change_done';
  end if;
  return new;
end $$;

create trigger tasks_payment_guard before insert or update on public.tasks
  for each row execute function public.reject_payment_data('title','note');
create trigger tasks_assignee_guard before update on public.tasks
  for each row execute function public.task_assignee_guard();
create trigger tasks_sync_guard before insert or update on public.tasks
  for each row execute function public.sync_guard();

alter table public.tasks enable row level security;
create policy tk_select on public.tasks for select to authenticated using (public.is_member(workspace_id));
create policy tk_manage on public.tasks for all to authenticated
  using (public.has_role(workspace_id, array['owner','manager']::public.member_role[]))
  with check (public.has_role(workspace_id, array['owner','manager']::public.member_role[]));
create policy tk_assignee_update on public.tasks for update to authenticated
  using (assignee_id = auth.uid() and public.is_member(workspace_id))
  with check (assignee_id = auth.uid() and public.is_member(workspace_id));

revoke all on public.tasks from anon;
grant select, insert, update, delete on public.tasks to authenticated;
