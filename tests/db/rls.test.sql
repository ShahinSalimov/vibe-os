-- VIBE OS database tests: isolation, roles, payment guard, sync, public booking.
-- Each check raises an exception on failure; the script stops at the first error.
\set ON_ERROR_STOP on
\set QUIET on

create or replace function pg_temp.expect_error(sql text, fragment text) returns void language plpgsql as $$
begin
  execute sql;
  raise exception 'EXPECTED ERROR containing "%" but statement succeeded: %', fragment, sql;
exception when others then
  if position(fragment in sqlerrm) = 0 and position(fragment in coalesce(sqlstate, '')) = 0 then
    raise exception 'EXPECTED "%" got "%" for: %', fragment, sqlerrm, sql;
  end if;
end $$;
grant execute on function pg_temp.expect_error(text, text) to anon, authenticated;

create or replace function pg_temp.login(uid text) returns void language sql as $$
  select set_config('request.jwt.claim.sub', uid, false);
$$;
grant execute on function pg_temp.login(text) to anon, authenticated;

create or replace function pg_temp.ok(cond boolean, msg text) returns void language plpgsql as $$
begin if not coalesce(cond, false) then raise exception 'ASSERT FAILED: %', msg; end if; end $$;
grant execute on function pg_temp.ok(boolean, text) to anon, authenticated;

-- users: A1 = artist A (owner), B1 = artist B (owner), M = musician in A, ACC = accountant in A
insert into auth.users values
 ('00000000-0000-0000-0000-0000000000a1'), ('00000000-0000-0000-0000-0000000000b1'),
 ('00000000-0000-0000-0000-00000000000e'), ('00000000-0000-0000-0000-0000000000cc');

-- ---------- 1. pure guard functions ----------
do $$ begin
  assert public.luhn_valid('4111111111111111'), 'luhn valid';
  assert not public.luhn_valid('4111111111111112'), 'luhn invalid';
  assert public.iban_valid('DE89370400440532013000'), 'iban valid';
  assert not public.iban_valid('DE89370400440532013001'), 'iban invalid';
  assert public.contains_payment_data('kart 4111 1111 1111 1111'), 'card in text';
  assert public.contains_payment_data('hesab DE89 3704 0044 0532 0130 00'), 'iban in text';
  assert not public.contains_payment_data('Toy Bakıda, 3000 AZN, +994 50 123 45 67'), 'clean text';
  assert public.valid_phone('+994 50 123 45 67'), 'phone ok';
  assert public.valid_phone(''), 'empty phone ok';
  assert not public.valid_phone('4111 1111 1111 1111'), '16-digit phone rejected';
  assert not public.valid_phone('abc'), 'letters rejected';
  raise notice 'PASS 1  guard functions';
end $$;

-- ---------- 2. create workspaces through RPC ----------
set role authenticated;
select pg_temp.login('00000000-0000-0000-0000-0000000000a1');
select public.create_workspace('Aysel', 'aysel', 'singer', 'Pop', 'AZN') \gset wsa_
select pg_temp.login('00000000-0000-0000-0000-0000000000b1');
select public.create_workspace('Rauf', 'rauf-band', 'band', '', 'USD') \gset wsb_
select pg_temp.expect_error($q$select public.create_workspace('X', 'aysel')$q$, 'duplicate key');
select pg_temp.expect_error($q$select public.create_workspace('X', 'A!')$q$, 'check constraint');
reset role;
\echo PASS 2  create_workspace + unique/valid slug

-- owner A adds a musician and an accountant (membership management is owner-only)
set role authenticated;
select pg_temp.login('00000000-0000-0000-0000-0000000000a1');
insert into public.workspace_members values
  (:'wsa_create_workspace', '00000000-0000-0000-0000-00000000000e', 'member', now()),
  (:'wsa_create_workspace', '00000000-0000-0000-0000-0000000000cc', 'accountant', now());
select pg_temp.expect_error(format($q$insert into public.workspace_members values ('%s', '00000000-0000-0000-0000-0000000000b1', 'owner', now())$q$, :'wsa_create_workspace'), 'row-level security');
reset role;
\echo PASS 3  owner manages team, cannot create second owner

-- ---------- 4. data + isolation ----------
set role authenticated;
select pg_temp.login('00000000-0000-0000-0000-0000000000a1');
insert into public.events (id, workspace_id, title, type, date, currency, fee, advance, updated_at)
values ('evt-aysel-0001', :'wsa_create_workspace', 'Toy Fairmont', 'wedding', current_date + 10, 'AZN', 3000, 1000, now());
insert into public.money_records (id, workspace_id, kind, counterparty, amount, paid_amount, currency, date, status, updated_at)
values ('rec-aysel-0001', :'wsa_create_workspace', 'income', 'Rauf', 3000, 1000, 'AZN', current_date, 'partial', now());

-- B cannot see or touch A's data
select pg_temp.login('00000000-0000-0000-0000-0000000000b1');
do $$ begin
  assert (select count(*) from public.events) = 0, 'B sees A events';
  assert (select count(*) from public.money_records) = 0, 'B sees A money';
  assert (select count(*) from public.workspaces) = 1, 'B sees only own workspace';
end $$;
select pg_temp.expect_error(format($q$insert into public.events (id, workspace_id, title, type, date, currency) values ('evt-hack-0001', '%s', 'x', 'concert', current_date, 'AZN')$q$, :'wsa_create_workspace'), 'row-level security');
update public.events set title = 'hacked' where id = 'evt-aysel-0001';
reset role;
do $$ begin assert (select title from public.events where id = 'evt-aysel-0001') = 'Toy Fairmont', 'B modified A event'; end $$;
\echo PASS 4  workspaces are isolated (read + write)

-- ---------- 5. roles inside a workspace ----------
set role authenticated;
select pg_temp.login('00000000-0000-0000-0000-00000000000e'); -- musician
do $$ begin
  assert (select count(*) from public.events) = 1, 'musician should see schedule';
  assert (select count(*) from public.money_records) = 0, 'musician must NOT see money';
end $$;
update public.events set title = 'changed by musician' where id = 'evt-aysel-0001';
select pg_temp.login('00000000-0000-0000-0000-0000000000cc'); -- accountant
do $$ begin
  assert (select count(*) from public.money_records) = 1, 'accountant should see money';
end $$;
reset role;
do $$ begin assert (select title from public.events where id = 'evt-aysel-0001') = 'Toy Fairmont', 'musician edited event'; end $$;
\echo PASS 5  musician sees schedule not money, accountant sees money, musician cannot edit

-- ---------- 6. payment guard on tables ----------
set role authenticated;
select pg_temp.login('00000000-0000-0000-0000-0000000000a1');
select pg_temp.expect_error(format($q$insert into public.money_records (id, workspace_id, kind, counterparty, amount, currency, date, status, note) values ('rec-card-0001', '%s', 'expense', 'Sound', 100, 'AZN', current_date, 'paid', 'karta 4111111111111111')$q$, :'wsa_create_workspace'), 'payment_data_not_allowed');
select pg_temp.expect_error(format($q$insert into public.events (id, workspace_id, title, type, date, currency, organizer_phone) values ('evt-card-0001', '%s', 'x', 'concert', current_date, 'AZN', '4111 1111 1111 1111')$q$, :'wsa_create_workspace'), 'check constraint');
select pg_temp.expect_error($q$update public.money_records set paid_amount = 5000 where id = 'rec-aysel-0001'$q$, 'check constraint');
reset role;
\echo PASS 6  card/IBAN rejected by server, paid <= amount enforced

-- ---------- 7. sync: last write wins, synced_at moves ----------
set role authenticated;
select pg_temp.login('00000000-0000-0000-0000-0000000000a1');
select synced_at as s0 from public.events where id = 'evt-aysel-0001' \gset
update public.events set title = 'Newer', updated_at = now() + interval '1 minute' where id = 'evt-aysel-0001';
update public.events set title = 'Stale', updated_at = now() - interval '1 day' where id = 'evt-aysel-0001';
do $$ begin assert (select title from public.events where id = 'evt-aysel-0001') = 'Newer', 'stale write overwrote newer'; end $$;
select pg_temp.ok((select synced_at > :'s0'::timestamptz from public.events where id = 'evt-aysel-0001'), 'synced_at did not advance');
-- soft delete
update public.events set deleted_at = now(), updated_at = now() + interval '2 minutes' where id = 'evt-aysel-0001';
do $$ begin assert (select deleted_at is not null from public.events where id = 'evt-aysel-0001'), 'soft delete'; end $$;
reset role;
\echo PASS 7  last-write-wins + pull cursor + soft delete

-- ---------- 8. public booking page (anon) ----------
set role anon;
select pg_temp.login('');
do $$ begin
  assert (select stage_name from public.get_public_profile('AYSEL')) = 'Aysel', 'public profile by slug';
  assert (select count(*) from public.get_public_profile('nobody')) = 0, 'unknown slug';
end $$;
select public.submit_booking('aysel', 'Elvin', '+994 55 111 22 33', '', 'wedding', current_date + 30,
  'Bakı', 'Fairmont', 250, 5000, 'AZN', 'Toy üçün', 'az') as booking_id \gset
select pg_temp.expect_error($q$select public.submit_booking('aysel', 'X', '', '', 'wedding', current_date + 3, '', '', null, null, 'AZN', '', 'az')$q$, 'contact_required');
select pg_temp.expect_error($q$select public.submit_booking('aysel', 'X', '+994551112233', '', 'wedding', current_date - 1, '', '', null, null, 'AZN', '', 'az')$q$, 'date_in_past');
select pg_temp.expect_error($q$select public.submit_booking('nobody', 'X', '+994551112233', '', 'wedding', current_date + 3, '', '', null, null, 'AZN', '', 'az')$q$, 'artist_not_found');
select pg_temp.expect_error($q$select public.submit_booking('aysel', 'X', '+994551112233', '', 'wedding', current_date + 3, '', '', null, null, 'AZN', 'kart 4111 1111 1111 1111', 'az')$q$, 'payment_data_not_allowed');
select pg_temp.expect_error($q$select count(*) from public.booking_requests$q$, 'permission denied');
select pg_temp.expect_error($q$select count(*) from public.workspaces$q$, 'permission denied');
select pg_temp.expect_error($q$select public.create_workspace('X', 'xxx-slug')$q$, 'permission denied');
reset role;
\echo PASS 8  anon: only public profile + submit_booking, validated, no table access

-- the booking arrived in A's workspace, visible to owner but not to B or the musician
set role authenticated;
select pg_temp.login('00000000-0000-0000-0000-0000000000a1');
do $$ begin assert (select count(*) from public.booking_requests where source = 'link') = 1, 'owner sees booking'; end $$;
select pg_temp.login('00000000-0000-0000-0000-00000000000e');
do $$ begin assert (select count(*) from public.booking_requests) = 0, 'musician must not see bookings'; end $$;
select pg_temp.login('00000000-0000-0000-0000-0000000000b1');
do $$ begin assert (select count(*) from public.booking_requests) = 0, 'B must not see A bookings'; end $$;
reset role;
\echo PASS 9  booking request routed to the right artist only

-- ---------- 10. rate limit ----------
set role anon;
do $$ begin
  for i in 1..29 loop
    perform public.submit_booking('aysel', 'Spam', '+994551112233', '', 'concert', current_date + 5, '', '', null, null, 'AZN', '', 'en');
  end loop;
end $$;
select pg_temp.expect_error($q$select public.submit_booking('aysel', 'Spam', '+994551112233', '', 'concert', current_date + 5, '', '', null, null, 'AZN', '', 'en')$q$, 'rate_limited');
reset role;
\echo PASS 10 rate limit (30 requests/hour per artist)
-- ---------- 11. studio: songs & setlists ----------
set role authenticated;
select pg_temp.login('00000000-0000-0000-0000-0000000000a1');
insert into public.songs (id, workspace_id, title, stage, musical_key, bpm, duration_sec, lyrics)
values ('song-aysel-01', :'wsa_create_workspace', 'Gecələr', 'arrangement', 'Am', 96, 215, 'Gecələr uzun...');
insert into public.setlists (id, workspace_id, title, song_ids)
values ('set-aysel-001', :'wsa_create_workspace', 'Toy proqramı', array['song-aysel-01']);
select pg_temp.expect_error(format($q$insert into public.songs (id, workspace_id, title, bpm) values ('song-bad-001', '%s', 'x', 900)$q$, :'wsa_create_workspace'), 'check constraint');
select pg_temp.expect_error(format($q$insert into public.songs (id, workspace_id, title, notes) values ('song-card-01', '%s', 'x', 'kart 4111 1111 1111 1111')$q$, :'wsa_create_workspace'), 'payment_data_not_allowed');
select pg_temp.login('00000000-0000-0000-0000-00000000000e'); -- musician
select pg_temp.ok((select count(*) = 1 from public.songs), 'musician sees songs');
select pg_temp.ok((select count(*) = 1 from public.setlists), 'musician sees setlists');
update public.songs set title = 'changed' where id = 'song-aysel-01';
select pg_temp.login('00000000-0000-0000-0000-0000000000b1'); -- other artist
select pg_temp.ok((select count(*) = 0 from public.songs), 'B must not see A songs');
reset role;
select pg_temp.ok((select title = 'Gecələr' from public.songs where id = 'song-aysel-01'), 'musician must not edit songs');
set role anon;
select pg_temp.expect_error($q$select count(*) from public.songs$q$, 'permission denied');
reset role;
\echo PASS 11 studio: team sees songs/setlists, only owner/manager edit, isolated, guarded
-- ---------- 12. contracts & riders ----------
set role authenticated;
select pg_temp.login('00000000-0000-0000-0000-0000000000a1');
insert into public.contracts (id, workspace_id, title, template, language, counterparty, amount, currency, body)
values ('ctr-aysel-001', :'wsa_create_workspace', 'Toy müqaviləsi', 'wedding', 'az', 'Rauf', 3000, 'AZN', 'Mətn');
insert into public.riders (id, workspace_id, kind, title, language, sections)
values ('rdr-aysel-001', :'wsa_create_workspace', 'technical', 'Texniki rider', 'az', '[{"key":"sound","title":"Səs","items":["2 mikrofon"]}]');
select pg_temp.expect_error(format($q$insert into public.contracts (id, workspace_id, title, template, language, currency, body) values ('ctr-card-001', '%s', 'x', 'custom', 'az', 'AZN', 'Hesab: DE89 3704 0044 0532 0130 00')$q$, :'wsa_create_workspace'), 'payment_data_not_allowed');
select pg_temp.expect_error(format($q$insert into public.riders (id, workspace_id, kind, title, language, sections) values ('rdr-card-001', '%s', 'technical', 'x', 'az', '[{"items":["4111111111111111"]}]')$q$, :'wsa_create_workspace'), 'payment_data_not_allowed');
select pg_temp.login('00000000-0000-0000-0000-00000000000e'); -- musician
select pg_temp.ok((select count(*) = 0 from public.contracts), 'musician must NOT see contracts');
select pg_temp.ok((select count(*) = 1 from public.riders), 'musician sees rider');
update public.riders set title = 'x' where id = 'rdr-aysel-001';
select pg_temp.login('00000000-0000-0000-0000-0000000000cc'); -- accountant
select pg_temp.ok((select count(*) = 1 from public.contracts), 'accountant sees contracts');
update public.contracts set title = 'changed by accountant' where id = 'ctr-aysel-001';
select pg_temp.login('00000000-0000-0000-0000-0000000000b1');
select pg_temp.ok((select count(*) = 0 from public.contracts) and (select count(*) = 0 from public.riders), 'B isolated');
reset role;
select pg_temp.ok((select title = 'Texniki rider' from public.riders where id = 'rdr-aysel-001'), 'musician must not edit rider');
select pg_temp.ok((select title = 'Toy müqaviləsi' from public.contracts where id = 'ctr-aysel-001'), 'accountant must not edit contract');
\echo PASS 12 contracts (finance audience, read-only for accountant) and riders (team reads)
\echo ALL DATABASE TESTS PASSED
