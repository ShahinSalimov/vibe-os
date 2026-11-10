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
