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
