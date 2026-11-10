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
