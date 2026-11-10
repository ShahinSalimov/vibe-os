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
