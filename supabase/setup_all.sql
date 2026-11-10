-- VIBE OS — complete server setup (all migrations in order).
-- Supabase: SQL Editor -> New query -> paste this whole file -> Run. Run it ONCE on a new project.
-- Generated from supabase/migrations/*.sql — edit those files, not this one.

-- ===================== 0001_init.sql =====================
-- VIBE OS — cloud schema (Supabase / PostgreSQL)
-- Multi-tenant: every artist is a workspace. Row Level Security isolates workspaces.
-- Record-only finance: no payment tables, and a trigger rejects card numbers / IBANs.

create extension if not exists pgcrypto;

-- ============================================================
-- Payment-data guard (server side, mirrors src/lib/sensitive.ts)
-- ============================================================
create or replace function public.luhn_valid(digits text) returns boolean
language plpgsql immutable as $$
declare
  s int := 0; d int; dbl boolean := false; i int;
begin
  if digits !~ '^\d+$' then return false; end if;
  for i in reverse length(digits)..1 loop
    d := substr(digits, i, 1)::int;
    if dbl then d := d * 2; if d > 9 then d := d - 9; end if; end if;
    s := s + d;
    dbl := not dbl;
  end loop;
  return s % 10 = 0;
end $$;

create or replace function public.iban_valid(raw text) returns boolean
language plpgsql immutable as $$
declare
  iban text := upper(regexp_replace(raw, '\s', '', 'g'));
  r text; ch text; rem int := 0; v text; i int; j int;
begin
  if iban !~ '^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$' then return false; end if;
  r := substr(iban, 5) || substr(iban, 1, 4);
  for i in 1..length(r) loop
    ch := substr(r, i, 1);
    if ch ~ '[A-Z]' then v := (ascii(ch) - 55)::text; else v := ch; end if;
    for j in 1..length(v) loop
      rem := (rem * 10 + substr(v, j, 1)::int) % 97;
    end loop;
  end loop;
  return rem = 1;
end $$;

create or replace function public.contains_payment_data(t text) returns boolean
language plpgsql immutable as $$
declare m text[];
begin
  if t is null or t = '' then return false; end if;
  for m in select regexp_matches(t, '\d(?:[ -]?\d){12,18}', 'g') loop
    if public.luhn_valid(regexp_replace(m[1], '[ -]', '', 'g')) then return true; end if;
  end loop;
  for m in select regexp_matches(upper(t), '[A-Z]{2}\d{2}(?:\s?[A-Z0-9]){11,30}', 'g') loop
    if public.iban_valid(m[1]) then return true; end if;
  end loop;
  return false;
end $$;

-- Trigger: checks the free-text columns named in the trigger arguments.
create or replace function public.reject_payment_data() returns trigger
language plpgsql as $$
declare row jsonb := to_jsonb(new); k text;
begin
  foreach k in array tg_argv loop
    if public.contains_payment_data(row ->> k) then
      raise exception 'payment_data_not_allowed' using errcode = 'P0001', detail = k;
    end if;
  end loop;
  return new;
end $$;

-- Phone: E.164 allows at most 15 digits, card numbers are 16+ in practice.
create or replace function public.valid_phone(p text) returns boolean
language sql immutable as $$
  select p = '' or (p ~ '^[+0-9 ()-]{3,20}$' and length(regexp_replace(p, '\D', '', 'g')) between 5 and 15);
$$;

-- ============================================================
-- Sync helpers: client sets updated_at (last-write-wins),
-- server sets synced_at (pull cursor).
-- ============================================================
create or replace function public.sync_guard() returns trigger
language plpgsql as $$
begin
  if tg_op = 'UPDATE' and new.updated_at < old.updated_at then
    return old; -- stale write from another device: keep the newer row
  end if;
  new.synced_at := clock_timestamp();
  return new;
end $$;

-- ============================================================
-- Workspaces & membership
-- ============================================================
create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  stage_name text not null check (length(stage_name) between 1 and 60),
  artist_role text not null default 'singer',
  genre text not null default '' check (length(genre) <= 60),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{2,39}$'),
  booking_enabled boolean not null default true,
  default_currency text not null default 'AZN' check (default_currency in ('AZN','USD','EUR','RUB','TRY')),
  created_at timestamptz not null default now()
);

create type public.member_role as enum ('owner', 'manager', 'member', 'accountant', 'viewer');

create table public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.member_role not null,
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);
create index on public.workspace_members (user_id);

-- Role check used by every policy. SECURITY DEFINER avoids recursive RLS on workspace_members.
create or replace function public.has_role(ws uuid, roles public.member_role[]) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.workspace_members m
    where m.workspace_id = ws and m.user_id = auth.uid() and m.role = any(roles)
  );
$$;

create or replace function public.is_member(ws uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.workspace_members m where m.workspace_id = ws and m.user_id = auth.uid());
$$;

-- ============================================================
-- Domain tables
-- ============================================================
create table public.events (
  id text primary key check (length(id) between 8 and 64),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  title text not null check (length(title) between 1 and 100),
  type text not null check (type in ('concert','wedding','corporate','private','restaurant','tv','festival','rehearsal','studio')),
  date date not null,
  time text not null default '' check (time = '' or time ~ '^([01]\d|2[0-3]):[0-5]\d$'),
  venue text not null default '' check (length(venue) <= 100),
  city text not null default '' check (length(city) <= 60),
  organizer text not null default '' check (length(organizer) <= 100),
  organizer_phone text not null default '' check (public.valid_phone(organizer_phone)),
  fee numeric(14,2) not null default 0 check (fee >= 0),
  advance numeric(14,2) not null default 0 check (advance >= 0),
  currency text not null check (currency in ('AZN','USD','EUR','RUB','TRY')),
  notes text not null default '' check (length(notes) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  synced_at timestamptz not null default now()
);
create index on public.events (workspace_id, synced_at);

create table public.money_records (
  id text primary key check (length(id) between 8 and 64),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  kind text not null check (kind in ('income','expense')),
  counterparty text not null check (length(counterparty) between 1 and 100),
  amount numeric(14,2) not null check (amount > 0),
  paid_amount numeric(14,2) not null default 0 check (paid_amount >= 0 and paid_amount <= amount),
  currency text not null check (currency in ('AZN','USD','EUR','RUB','TRY')),
  date date not null,
  status text not null check (status in ('planned','partial','paid','overdue')),
  category text not null default '' check (length(category) <= 60),
  note text not null default '' check (length(note) <= 500),
  event_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  synced_at timestamptz not null default now()
);
create index on public.money_records (workspace_id, synced_at);

create table public.booking_requests (
  id text primary key default replace(gen_random_uuid()::text, '-', ''),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  source text not null default 'manual' check (source in ('link','manual')),
  organizer_name text not null check (length(organizer_name) between 1 and 100),
  phone text not null default '' check (public.valid_phone(phone)),
  email text not null default '' check (length(email) <= 120),
  event_type text not null check (event_type in ('concert','wedding','corporate','private','restaurant','tv','festival','rehearsal','studio')),
  date date not null,
  city text not null default '' check (length(city) <= 60),
  venue text not null default '' check (length(venue) <= 100),
  guests int check (guests is null or guests between 1 and 100000),
  budget numeric(14,2) check (budget is null or budget >= 0),
  currency text not null default 'AZN' check (currency in ('AZN','USD','EUR','RUB','TRY')),
  message text not null default '' check (length(message) <= 1000),
  language text not null default 'az' check (language in ('az','ru','en')),
  status text not null default 'new' check (status in ('new','negotiating','confirmed','declined')),
  event_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  synced_at timestamptz not null default now()
);
create index on public.booking_requests (workspace_id, synced_at);

create table public.contacts (
  id text primary key check (length(id) between 8 and 64),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null check (length(name) between 1 and 100),
  kind text not null default 'organizer' check (kind in ('organizer','venue','sponsor','team','media','other')),
  phone text not null default '' check (public.valid_phone(phone)),
  email text not null default '' check (length(email) <= 120),
  note text not null default '' check (length(note) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  synced_at timestamptz not null default now()
);
create index on public.contacts (workspace_id, synced_at);

-- Triggers
create trigger events_payment_guard before insert or update on public.events
  for each row execute function public.reject_payment_data('title','venue','city','organizer','notes');
create trigger money_records_payment_guard before insert or update on public.money_records
  for each row execute function public.reject_payment_data('counterparty','category','note');
create trigger booking_requests_payment_guard before insert or update on public.booking_requests
  for each row execute function public.reject_payment_data('organizer_name','email','city','venue','message');
create trigger contacts_payment_guard before insert or update on public.contacts
  for each row execute function public.reject_payment_data('name','email','note');
create trigger workspaces_payment_guard before insert or update on public.workspaces
  for each row execute function public.reject_payment_data('stage_name','genre');

do $$
declare t text;
begin
  foreach t in array array['events','money_records','booking_requests','contacts'] loop
    execute format('create trigger %I_sync_guard before insert or update on public.%I for each row execute function public.sync_guard()', t, t);
  end loop;
end $$;

-- ============================================================
-- Row Level Security
-- ============================================================
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.events enable row level security;
alter table public.money_records enable row level security;
alter table public.booking_requests enable row level security;
alter table public.contacts enable row level security;

-- workspaces: members read, owner updates. Creation only via create_workspace().
create policy ws_select on public.workspaces for select to authenticated using (public.is_member(id));
create policy ws_update on public.workspaces for update to authenticated
  using (public.has_role(id, array['owner']::public.member_role[]))
  with check (public.has_role(id, array['owner']::public.member_role[]));

-- members: everyone in the workspace sees the team; only the owner manages it.
create policy wm_select on public.workspace_members for select to authenticated using (public.is_member(workspace_id));
create policy wm_write on public.workspace_members for all to authenticated
  using (public.has_role(workspace_id, array['owner']::public.member_role[]))
  with check (public.has_role(workspace_id, array['owner']::public.member_role[]) and role <> 'owner');

-- events: whole team sees the schedule; owner/manager edit.
create policy ev_select on public.events for select to authenticated using (public.is_member(workspace_id));
create policy ev_write on public.events for all to authenticated
  using (public.has_role(workspace_id, array['owner','manager']::public.member_role[]))
  with check (public.has_role(workspace_id, array['owner','manager']::public.member_role[]));

-- money: owner, manager, accountant only (musicians/viewers never see finances).
create policy mr_select on public.money_records for select to authenticated
  using (public.has_role(workspace_id, array['owner','manager','accountant']::public.member_role[]));
create policy mr_write on public.money_records for all to authenticated
  using (public.has_role(workspace_id, array['owner','manager','accountant']::public.member_role[]))
  with check (public.has_role(workspace_id, array['owner','manager','accountant']::public.member_role[]));

-- bookings & contacts: owner/manager.
create policy br_all on public.booking_requests for all to authenticated
  using (public.has_role(workspace_id, array['owner','manager']::public.member_role[]))
  with check (public.has_role(workspace_id, array['owner','manager']::public.member_role[]));
create policy ct_select on public.contacts for select to authenticated using (public.is_member(workspace_id));
create policy ct_write on public.contacts for all to authenticated
  using (public.has_role(workspace_id, array['owner','manager']::public.member_role[]))
  with check (public.has_role(workspace_id, array['owner','manager']::public.member_role[]));

-- Anonymous visitors get NO table access at all; they only call the two RPCs below.
revoke all on all tables in schema public from anon;
grant select, insert, update, delete on all tables in schema public to authenticated;

-- ============================================================
-- RPCs
-- ============================================================

-- Creates a workspace for the signed-in user and makes them owner.
create or replace function public.create_workspace(
  p_stage_name text, p_slug text, p_artist_role text default 'singer',
  p_genre text default '', p_currency text default 'AZN'
) returns uuid
language plpgsql security definer set search_path = public as $$
declare ws uuid;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  insert into public.workspaces (stage_name, slug, artist_role, genre, default_currency)
  values (trim(p_stage_name), lower(p_slug), p_artist_role, coalesce(trim(p_genre), ''), p_currency)
  returning id into ws;
  insert into public.workspace_members (workspace_id, user_id, role) values (ws, auth.uid(), 'owner');
  return ws;
end $$;

create or replace function public.slug_available(p_slug text) returns boolean
language sql stable security definer set search_path = public as $$
  select not exists (select 1 from public.workspaces where slug = lower(p_slug));
$$;

-- Public booking page: minimal, non-sensitive artist card.
create or replace function public.get_public_profile(p_slug text)
returns table (stage_name text, artist_role text, genre text, default_currency text)
language sql stable security definer set search_path = public as $$
  select w.stage_name, w.artist_role, w.genre, w.default_currency
  from public.workspaces w where w.slug = lower(p_slug) and w.booking_enabled;
$$;

-- Public booking page: submit a request. Rate-limited per artist.
create or replace function public.submit_booking(
  p_slug text, p_organizer_name text, p_phone text, p_email text, p_event_type text,
  p_date date, p_city text, p_venue text, p_guests int, p_budget numeric,
  p_currency text, p_message text, p_language text
) returns text
language plpgsql security definer set search_path = public as $$
declare ws uuid; new_id text; recent int;
begin
  select id into ws from public.workspaces where slug = lower(p_slug) and booking_enabled;
  if ws is null then raise exception 'artist_not_found'; end if;
  if p_date < current_date then raise exception 'date_in_past'; end if;
  if coalesce(trim(p_phone), '') = '' and coalesce(trim(p_email), '') = '' then
    raise exception 'contact_required';
  end if;
  select count(*) into recent from public.booking_requests
    where workspace_id = ws and source = 'link' and created_at > now() - interval '1 hour';
  if recent >= 30 then raise exception 'rate_limited'; end if;

  insert into public.booking_requests (
    workspace_id, source, organizer_name, phone, email, event_type, date, city, venue,
    guests, budget, currency, message, language
  ) values (
    ws, 'link', trim(p_organizer_name), coalesce(trim(p_phone), ''), coalesce(trim(p_email), ''),
    p_event_type, p_date, coalesce(trim(p_city), ''), coalesce(trim(p_venue), ''),
    p_guests, p_budget, coalesce(p_currency, 'AZN'), coalesce(trim(p_message), ''), coalesce(p_language, 'az')
  ) returning id into new_id;
  return new_id;
end $$;

revoke all on function public.create_workspace(text, text, text, text, text) from public, anon;
grant execute on function public.create_workspace(text, text, text, text, text) to authenticated;
grant execute on function public.slug_available(text) to authenticated;
grant execute on function public.get_public_profile(text) to anon, authenticated;
grant execute on function public.submit_booking(text, text, text, text, text, date, text, text, int, numeric, text, text, text) to anon, authenticated;

-- ===================== 0002_studio.sql =====================
-- VIBE OS — Studio: songs and setlists.
-- Audio files (ideas, demos, finals) stay on the device in this version; only metadata syncs.

create table public.songs (
  id text primary key check (length(id) between 8 and 64),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  title text not null check (length(title) between 1 and 120),
  stage text not null default 'idea'
    check (stage in ('idea','writing','demo','arrangement','recording','mixing','mastering','released')),
  musical_key text not null default '' check (length(musical_key) <= 12),
  bpm int check (bpm is null or bpm between 20 and 300),
  duration_sec int check (duration_sec is null or duration_sec between 1 and 3600),
  lyrics text not null default '' check (length(lyrics) <= 10000),
  authors text not null default '' check (length(authors) <= 200),
  notes text not null default '' check (length(notes) <= 1000),
  release_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  synced_at timestamptz not null default now()
);
create index on public.songs (workspace_id, synced_at);

create table public.setlists (
  id text primary key check (length(id) between 8 and 64),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  title text not null check (length(title) between 1 and 100),
  event_id text,
  song_ids text[] not null default '{}' check (coalesce(array_length(song_ids, 1), 0) <= 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  synced_at timestamptz not null default now()
);
create index on public.setlists (workspace_id, synced_at);

create trigger songs_payment_guard before insert or update on public.songs
  for each row execute function public.reject_payment_data('title','lyrics','authors','notes');
create trigger setlists_payment_guard before insert or update on public.setlists
  for each row execute function public.reject_payment_data('title');
create trigger songs_sync_guard before insert or update on public.songs
  for each row execute function public.sync_guard();
create trigger setlists_sync_guard before insert or update on public.setlists
  for each row execute function public.sync_guard();

alter table public.songs enable row level security;
alter table public.setlists enable row level security;

-- The whole team (musicians included) sees songs and setlists; owner/manager edit.
create policy so_select on public.songs for select to authenticated using (public.is_member(workspace_id));
create policy so_write on public.songs for all to authenticated
  using (public.has_role(workspace_id, array['owner','manager']::public.member_role[]))
  with check (public.has_role(workspace_id, array['owner','manager']::public.member_role[]));
create policy sl_select on public.setlists for select to authenticated using (public.is_member(workspace_id));
create policy sl_write on public.setlists for all to authenticated
  using (public.has_role(workspace_id, array['owner','manager']::public.member_role[]))
  with check (public.has_role(workspace_id, array['owner','manager']::public.member_role[]));

revoke all on public.songs, public.setlists from anon;
grant select, insert, update, delete on public.songs, public.setlists to authenticated;

-- ===================== 0003_documents.sql =====================
-- VIBE OS — contracts and riders.
-- Personal documents (passport, visa) are NOT stored in the cloud by design.
-- Signed contract scans stay on the device in this version.

create table public.contracts (
  id text primary key check (length(id) between 8 and 64),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  title text not null check (length(title) between 1 and 150),
  template text not null check (template in ('performance','wedding','corporate','collaboration','sponsorship','custom')),
  language text not null check (language in ('az','ru','en')),
  event_id text,
  counterparty text not null default '' check (length(counterparty) <= 100),
  amount numeric(14,2) not null default 0 check (amount >= 0),
  currency text not null check (currency in ('AZN','USD','EUR','RUB','TRY')),
  status text not null default 'draft' check (status in ('draft','sent','signed','cancelled')),
  deadline date,
  body text not null default '' check (length(body) <= 30000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  synced_at timestamptz not null default now()
);
create index on public.contracts (workspace_id, synced_at);

create table public.riders (
  id text primary key check (length(id) between 8 and 64),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  kind text not null check (kind in ('technical','hospitality')),
  title text not null check (length(title) between 1 and 100),
  language text not null check (language in ('az','ru','en')),
  sections jsonb not null default '[]'::jsonb check (jsonb_typeof(sections) = 'array' and length(sections::text) <= 20000),
  notes text not null default '' check (length(notes) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  synced_at timestamptz not null default now()
);
create index on public.riders (workspace_id, synced_at);

create trigger contracts_payment_guard before insert or update on public.contracts
  for each row execute function public.reject_payment_data('title','counterparty','body');
create trigger riders_payment_guard before insert or update on public.riders
  for each row execute function public.reject_payment_data('title','sections','notes');
create trigger contracts_sync_guard before insert or update on public.contracts
  for each row execute function public.sync_guard();
create trigger riders_sync_guard before insert or update on public.riders
  for each row execute function public.sync_guard();

alter table public.contracts enable row level security;
alter table public.riders enable row level security;

-- Contracts contain money terms: same audience as finances.
-- Read: owner, manager, accountant. Write: owner, manager only.
create policy ct_contracts_select on public.contracts for select to authenticated
  using (public.has_role(workspace_id, array['owner','manager','accountant']::public.member_role[]));
create policy ct_contracts_write on public.contracts for all to authenticated
  using (public.has_role(workspace_id, array['owner','manager']::public.member_role[]))
  with check (public.has_role(workspace_id, array['owner','manager']::public.member_role[]));
-- Riders: the whole team reads (musicians need the tech rider), owner/manager edit.
create policy rd_select on public.riders for select to authenticated using (public.is_member(workspace_id));
create policy rd_write on public.riders for all to authenticated
  using (public.has_role(workspace_id, array['owner','manager']::public.member_role[]))
  with check (public.has_role(workspace_id, array['owner','manager']::public.member_role[]));

revoke all on public.contracts, public.riders from anon;
grant select, insert, update, delete on public.contracts, public.riders to authenticated;

-- ===================== 0004_team.sql =====================
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

-- ===================== 0005_license.sql =====================
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

-- ===================== 0006_sales_fixes.sql =====================
-- VIBE OS — fixes before selling.
-- 1) Code generators no longer depend on pgcrypto (on Supabase it lives in the "extensions"
--    schema, so gen_random_bytes() was not found from functions with search_path = public).
--    Randomness now comes from gen_random_uuid() (built into PostgreSQL 13+).
-- 2) The 3-day trial counts from the first day the app was used, not from the first sign-in.

-- One random byte from a v4 UUID (byte 0 is fully random).
create or replace function public.random_byte() returns int
language sql volatile as $$
  select get_byte(uuid_send(gen_random_uuid()), 0);
$$;

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
      c := c || substr(alphabet, 1 + (public.random_byte() % length(alphabet)), 1);
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

create or replace function public.admin_create_code(p_note text) returns text
language plpgsql security definer set search_path = public as $$
declare alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; c text; i int;
begin
  if not public.is_platform_admin() then raise exception 'not_admin'; end if;
  loop
    c := '';
    for i in 1..12 loop
      c := c || substr(alphabet, 1 + (public.random_byte() % length(alphabet)), 1);
    end loop;
    begin
      insert into public.license_codes (code, note, created_by) values (c, left(coalesce(p_note, ''), 200), auth.uid());
      return c;
    exception when unique_violation then null;
    end;
  end loop;
end $$;

-- create_workspace now takes when the phone started using the app; the trial ends 3 days after
-- that (never later than 3 days from now). A value in the future is ignored.
drop function if exists public.create_workspace(text, text, text, text, text);
create or replace function public.create_workspace(
  p_stage_name text, p_slug text, p_artist_role text default 'singer',
  p_genre text default '', p_currency text default 'AZN', p_trial_started timestamptz default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare ws uuid; started timestamptz;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  insert into public.workspaces (stage_name, slug, artist_role, genre, default_currency)
  values (trim(p_stage_name), lower(p_slug), p_artist_role, coalesce(trim(p_genre), ''), p_currency)
  returning id into ws;
  insert into public.workspace_members (workspace_id, user_id, role) values (ws, auth.uid(), 'owner');
  started := least(coalesce(p_trial_started, now()), now());
  update public.licenses set trial_ends_at = least(trial_ends_at, started + interval '3 days') where workspace_id = ws;
  return ws;
end $$;

revoke all on function public.random_byte() from public, anon;
revoke all on function public.create_workspace(text, text, text, text, text, timestamptz) from public, anon;
grant execute on function public.create_workspace(text, text, text, text, text, timestamptz) to authenticated;
