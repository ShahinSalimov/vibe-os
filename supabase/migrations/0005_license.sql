-- VIBE OS — licensing: 3-day trial, then a one-time activation code sold by the platform owner.
-- Payment happens outside the app. The server blocks business writes when the licence is not valid.

-- Platform admins (the person who sells VIBE OS). Added by hand in the SQL editor:
--   insert into public.platform_admins (user_id) select id from auth.users where email = 'you@example.com';
create table public.platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.platform_admins enable row level security; -- no policies: only security-definer functions read it
revoke all on public.platform_admins from anon, authenticated;

create or replace function public.is_platform_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.platform_admins where user_id = auth.uid());
$$;

create table public.licenses (
  workspace_id uuid primary key references public.workspaces(id) on delete cascade,
  status text not null default 'trial' check (status in ('trial', 'active', 'suspended')),
  trial_ends_at timestamptz not null default now() + interval '3 days',
  activated_at timestamptz,
  code text
);
alter table public.licenses enable row level security;
create policy lic_member_read on public.licenses for select to authenticated using (public.is_member(workspace_id));
revoke all on public.licenses from anon;
grant select on public.licenses to authenticated;

create table public.license_codes (
  code text primary key check (code ~ '^[A-HJ-NP-Z2-9]{12}$'),
  note text not null default '' check (length(note) <= 200),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  redeemed_workspace uuid references public.workspaces(id) on delete set null,
  redeemed_at timestamptz,
  revoked boolean not null default false
);
alter table public.license_codes enable row level security; -- admin access only through functions
revoke all on public.license_codes from anon, authenticated;

-- A workspace may write when the trial is running or the licence is active.
create or replace function public.license_valid(ws uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.licenses l
    where l.workspace_id = ws
      and (l.status = 'active' or (l.status = 'trial' and l.trial_ends_at > now()))
  );
$$;

-- Every new workspace starts a 3-day trial (also covers workspaces created before this migration: see below).
create or replace function public.start_trial() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.licenses (workspace_id) values (new.id) on conflict do nothing;
  return new;
end $$;
create trigger workspaces_start_trial after insert on public.workspaces
  for each row execute function public.start_trial();
insert into public.licenses (workspace_id) select id from public.workspaces on conflict do nothing;

-- Write guard on business tables (insert/update; the app never hard-deletes, it soft-deletes via update).
-- Public booking requests are not guarded: leads keep arriving.
create or replace function public.require_license() returns trigger
language plpgsql security definer set search_path = public as $$
declare ws uuid;
begin
  ws := (to_jsonb(new) ->> 'workspace_id')::uuid;
  if not public.license_valid(ws) then
    raise exception 'license_required' using errcode = 'P0001';
  end if;
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['events','money_records','contacts','songs','setlists','contracts','riders','tasks'] loop
    execute format('create trigger %I_license before insert or update on public.%I for each row execute function public.require_license()', t, t);
  end loop;
end $$;
-- booking_requests: only changes by the team are guarded (status, edits); public inserts go through.
create trigger booking_requests_license before update on public.booking_requests
  for each row execute function public.require_license();

-- Owner redeems a code for their workspace: active forever (one-time purchase).
create or replace function public.redeem_license(p_code text, p_workspace uuid) returns void
language plpgsql security definer set search_path = public as $$
declare c public.license_codes; clean text;
begin
  if not public.has_role(p_workspace, array['owner']::public.member_role[]) then raise exception 'not_owner'; end if;
  clean := upper(regexp_replace(coalesce(p_code, ''), '[\s-]', '', 'g'));
  select * into c from public.license_codes where code = clean for update;
  if c.code is null or c.revoked then raise exception 'code_not_found'; end if;
  if c.redeemed_workspace is not null then raise exception 'code_used'; end if;
  update public.license_codes set redeemed_workspace = p_workspace, redeemed_at = now() where code = clean;
  update public.licenses set status = 'active', activated_at = now(), code = clean where workspace_id = p_workspace;
end $$;

-- ---------- admin (platform owner) ----------
create or replace function public.admin_create_code(p_note text) returns text
language plpgsql security definer set search_path = public as $$
declare alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; c text; i int;
begin
  if not public.is_platform_admin() then raise exception 'not_admin'; end if;
  loop
    c := '';
    for i in 1..12 loop
      c := c || substr(alphabet, 1 + (get_byte(gen_random_bytes(1), 0) % length(alphabet)), 1);
    end loop;
    begin
      insert into public.license_codes (code, note, created_by) values (c, left(coalesce(p_note, ''), 200), auth.uid());
      return c;
    exception when unique_violation then null;
    end;
  end loop;
end $$;

create or replace function public.admin_revoke_code(p_code text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_platform_admin() then raise exception 'not_admin'; end if;
  update public.license_codes set revoked = true where code = upper(p_code) and redeemed_workspace is null;
end $$;

create or replace function public.admin_set_license(p_workspace uuid, p_status text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_platform_admin() then raise exception 'not_admin'; end if;
  if p_status not in ('trial', 'active', 'suspended') then raise exception 'invalid_status'; end if;
  update public.licenses set status = p_status,
    activated_at = case when p_status = 'active' then coalesce(activated_at, now()) else activated_at end
  where workspace_id = p_workspace;
end $$;

create or replace function public.admin_extend_trial(p_workspace uuid, p_days int) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_platform_admin() then raise exception 'not_admin'; end if;
  update public.licenses set trial_ends_at = greatest(trial_ends_at, now()) + make_interval(days => least(greatest(p_days, 1), 60))
  where workspace_id = p_workspace and status = 'trial';
end $$;

create or replace function public.admin_overview()
returns table (workspace_id uuid, stage_name text, slug text, owner_email text, status text,
               trial_ends_at timestamptz, activated_at timestamptz, code text, members int, created_at timestamptz)
language plpgsql stable security definer set search_path = public, auth as $$
begin
  if not public.is_platform_admin() then raise exception 'not_admin'; end if;
  return query
    select w.id, w.stage_name, w.slug, u.email::text, l.status, l.trial_ends_at, l.activated_at, l.code,
           (select count(*)::int from public.workspace_members m2 where m2.workspace_id = w.id), w.created_at
    from public.workspaces w
    join public.licenses l on l.workspace_id = w.id
    left join public.workspace_members m on m.workspace_id = w.id and m.role = 'owner'
    left join auth.users u on u.id = m.user_id
    order by w.created_at desc;
end $$;

create or replace function public.admin_codes()
returns table (code text, note text, created_at timestamptz, redeemed_workspace uuid, redeemed_at timestamptz, revoked boolean)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_platform_admin() then raise exception 'not_admin'; end if;
  return query select c.code, c.note, c.created_at, c.redeemed_workspace, c.redeemed_at, c.revoked
    from public.license_codes c order by c.created_at desc;
end $$;

do $$
declare f text;
begin
  foreach f in array array[
    'redeem_license(text, uuid)', 'admin_create_code(text)', 'admin_revoke_code(text)',
    'admin_set_license(uuid, text)', 'admin_extend_trial(uuid, int)', 'admin_overview()', 'admin_codes()', 'is_platform_admin()'
  ] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
