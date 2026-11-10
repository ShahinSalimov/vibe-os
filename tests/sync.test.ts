/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { changedSince, mappers, mergeRemote, nextCursor, pullFrom, slugify, tombstoneRows } from '../src/lib/sync';
import { validPhone } from '../src/lib/sensitive';
import { migrateStore } from '../src/store/migrate';
import type { ArtistEvent, BookingRequest } from '../src/lib/types';

const ev = (p: Partial<ArtistEvent>): ArtistEvent => ({
  id: 'evt-000000001',
  title: 'Toy',
  type: 'wedding',
  date: '2026-12-15',
  time: '19:30',
  venue: 'Fairmont',
  city: 'Bakı',
  organizer: 'Rauf',
  organizerPhone: '+994 50 123 45 67',
  fee: 3000,
  advance: 1000,
  currency: 'AZN',
  notes: '',
  createdAt: '2026-11-01T10:00:00.000Z',
  updatedAt: '2026-11-01T10:00:00.000Z',
  ...p,
});

test('event row mapping round-trips', () => {
  const e = ev({});
  const row = mappers.events.toRow(e, 'ws-1');
  assert.equal(row.workspace_id, 'ws-1');
  assert.equal(row.organizer_phone, e.organizerPhone);
  assert.equal(row.deleted_at, null);
  assert.deepEqual(mappers.events.fromRow({ ...row, fee: '3000.00', advance: '1000.00' }), e);
});

test('booking mapping keeps nulls for guests/budget', () => {
  const b: BookingRequest = {
    id: 'bk-000000001', source: 'link', organizerName: 'Elvin', phone: '', email: 'e@x.az',
    eventType: 'corporate', date: '2027-01-10', city: '', venue: '', guests: null, budget: null,
    currency: 'USD', message: '', language: 'ru', status: 'new',
    createdAt: '2026-11-01T10:00:00.000Z', updatedAt: '2026-11-01T10:00:00.000Z',
  };
  assert.deepEqual(mappers.booking_requests.fromRow(mappers.booking_requests.toRow(b, 'w')), b);
});

test('merge: newer remote wins, older remote ignored, new rows added', () => {
  const local = [ev({ id: 'a-00000001', title: 'local', updatedAt: '2026-11-02T00:00:00Z' }), ev({ id: 'b-00000001', title: 'local-b', updatedAt: '2026-11-05T00:00:00Z' })];
  const rows = [
    mappers.events.toRow(ev({ id: 'a-00000001', title: 'remote-newer', updatedAt: '2026-11-03T00:00:00Z' }), 'w'),
    mappers.events.toRow(ev({ id: 'b-00000001', title: 'remote-older', updatedAt: '2026-11-04T00:00:00Z' }), 'w'),
    mappers.events.toRow(ev({ id: 'c-00000001', title: 'remote-new' }), 'w'),
  ];
  const out = mergeRemote(local, rows, mappers.events.fromRow);
  const byId = Object.fromEntries(out.map((e) => [e.id, e.title]));
  assert.deepEqual(byId, { 'a-00000001': 'remote-newer', 'b-00000001': 'local-b', 'c-00000001': 'remote-new' });
});

test('merge: remote delete removes local unless local is newer', () => {
  const local = [ev({ id: 'a-00000001', updatedAt: '2026-11-01T00:00:00Z' }), ev({ id: 'b-00000001', updatedAt: '2026-11-09T00:00:00Z' })];
  const rows = [
    { id: 'a-00000001', updated_at: '2026-11-02T00:00:00Z', deleted_at: '2026-11-02T00:00:00Z' },
    { id: 'b-00000001', updated_at: '2026-11-02T00:00:00Z', deleted_at: '2026-11-02T00:00:00Z' },
  ];
  assert.deepEqual(mergeRemote(local, rows, mappers.events.fromRow).map((e) => e.id), ['b-00000001']);
});

test('changedSince, tombstones, cursors', () => {
  const items = [ev({ id: 'old-0000001', updatedAt: '2026-11-01T00:00:00Z' }), ev({ id: 'new-0000001', updatedAt: '2026-11-05T00:00:00Z' })];
  assert.equal(changedSince(items, null).length, 2);
  assert.deepEqual(changedSince(items, '2026-11-02T00:00:00Z').map((e) => e.id), ['new-0000001']);
  const rows = tombstoneRows(
    [{ table: 'events', id: 'x-00000001', deletedAt: '2026-11-03T00:00:00Z' }, { table: 'contacts', id: 'y-00000001', deletedAt: '2026-11-03T00:00:00Z' }],
    'events', 'w',
  );
  assert.deepEqual(rows, [{ id: 'x-00000001', workspace_id: 'w', updated_at: '2026-11-03T00:00:00Z', deleted_at: '2026-11-03T00:00:00Z' }]);
  assert.equal(nextCursor([{ synced_at: '2026-11-03T00:00:00Z' }, { synced_at: '2026-11-04T00:00:00Z' }], null), '2026-11-04T00:00:00Z');
  assert.equal(nextCursor([], '2026-11-01T00:00:00Z'), '2026-11-01T00:00:00Z');
  assert.equal(pullFrom('2026-11-04T00:01:00.000Z'), '2026-11-04T00:00:00.000Z');
  assert.equal(pullFrom(null), null);
});

test('slugify handles Azerbaijani, Russian and short names', () => {
  assert.equal(slugify('Aysel Məmmədova'), 'aysel-memmedova');
  assert.equal(slugify('Айсель'), 'aysel');
  assert.equal(slugify('Şəbnəm Tovuzlu'), 'shebnem-tovuzlu');
  assert.equal(slugify('DJ'), 'artist-dj');
  assert.equal(slugify('!!!'), 'artist-vibe');
  for (const s of ['Aysel Məmmədova', 'Айсель', 'DJ', 'A very very long stage name that keeps going on']) {
    assert.match(slugify(s), /^[a-z0-9][a-z0-9-]{2,39}$/);
  }
});

test('validPhone mirrors the server rule', () => {
  for (const p of ['', '+994 50 123 45 67', '+7 (912) 345-67-89', '0501234567']) assert.equal(validPhone(p), true, p);
  for (const p of ['4111 1111 1111 1111', 'abc', '123', '+1234567890123456']) assert.equal(validPhone(p), false, p);
});

test('store migration v1 -> v3 keeps Phase 1 data', () => {
  const v1 = {
    profile: { stageName: 'Aysel' },
    events: [{ id: 'e1', createdAt: '2026-11-01T00:00:00Z' }],
    records: [{ id: 'r1', createdAt: '2026-11-02T00:00:00Z' }],
  };
  const v2 = migrateStore(v1, 1) as any;
  assert.equal(v2.profile.stageName, 'Aysel');
  assert.equal(v2.events[0].updatedAt, '2026-11-01T00:00:00Z');
  assert.equal(v2.records[0].updatedAt, '2026-11-02T00:00:00Z');
  assert.deepEqual(v2.bookings, []);
  assert.deepEqual(v2.contacts, []);
  assert.deepEqual(v2.tombstones, []);
  assert.equal(v2.cloud.workspaceId, null);
  assert.deepEqual(v2.songs, []);
  assert.deepEqual(v2.setlists, []);
  const v3 = migrateStore({ events: [{ id: 'e' }], songs: [{ id: 's' }] }, 3);
  assert.deepEqual((v3 as any).songs, [{ id: 's' }], 'v3 data untouched');
});

import { internationalDigits, mailtoUrl, telUrl, whatsappUrl } from '../src/lib/contactLinks';
test('phone links: local AZ/RU formats become international', () => {
  assert.equal(internationalDigits('050 123 45 67'), '994501234567');
  assert.equal(internationalDigits('+994 (50) 123-45-67'), '994501234567');
  assert.equal(internationalDigits('8 912 345 67 89'), '79123456789');
  assert.equal(internationalDigits('00994501234567'), '994501234567');
  assert.equal(internationalDigits('123'), null);
  assert.equal(telUrl('050 123 45 67'), 'tel:+994501234567');
  assert.equal(whatsappUrl('+7 912 345 67 89', 'Salam'), 'https://wa.me/79123456789?text=Salam');
  assert.equal(mailtoUrl('a@b.az'), 'mailto:a@b.az');
  assert.equal(mailtoUrl('nope'), null);
});

test('merge returns the same array when nothing changed (no sync loop)', () => {
  const local = [ev({ id: 'a-00000001', updatedAt: '2026-11-05T00:00:00.000Z' })];
  const sameRow = mappers.events.toRow(local[0], 'w');
  assert.equal(mergeRemote(local, [sameRow], mappers.events.fromRow), local);
  assert.equal(mergeRemote(local, [], mappers.events.fromRow), local);
  assert.notEqual(mergeRemote(local, [{ ...sameRow, updated_at: '2026-11-06T00:00:00.000Z' }], mappers.events.fromRow), local);
});

import type { Setlist, Song } from '../src/lib/types';
test('song and setlist mapping round-trips (nulls, empty release date, array)', () => {
  const song: Song = { id: 'song-000001', title: 'Gecələr', stage: 'arrangement', musicalKey: 'Am', bpm: 96, durationSec: 215,
    lyrics: 'Gecələr uzun', authors: 'Aysel', notes: '', releaseDate: '', createdAt: '2026-11-01T00:00:00.000Z', updatedAt: '2026-11-01T00:00:00.000Z' };
  const row = mappers.songs.toRow(song, 'w');
  assert.equal(row.release_date, null);
  assert.deepEqual(mappers.songs.fromRow(row), song);
  const empty: Song = { ...song, bpm: null, durationSec: null, releaseDate: '2027-02-14' };
  assert.deepEqual(mappers.songs.fromRow(mappers.songs.toRow(empty, 'w')), empty);
  const sl: Setlist = { id: 'set-000001', title: 'Toy', songIds: ['a', 'b'], createdAt: song.createdAt, updatedAt: song.updatedAt };
  assert.deepEqual(mappers.setlists.fromRow(mappers.setlists.toRow(sl, 'w')), sl);
  assert.deepEqual(mappers.setlists.fromRow({ ...mappers.setlists.toRow({ ...sl, eventId: 'ev1' }, 'w') }).eventId, 'ev1');
});

import { formatDuration, moveItem, parseDuration, setlistTotals } from '../src/studio/format';
test('studio: durations, setlist totals, reordering', () => {
  assert.equal(formatDuration(215), '3:35');
  assert.equal(formatDuration(3725), '1:02:05');
  assert.equal(formatDuration(null), '—');
  assert.equal(parseDuration('3:35'), 215);
  assert.equal(parseDuration('215'), 215);
  assert.equal(parseDuration(''), null);
  assert.equal(parseDuration('3:75'), undefined);
  assert.equal(parseDuration('abc'), undefined);
  const mk = (id: string, d: number | null) => ({ id, durationSec: d }) as any;
  const t = setlistTotals({ songIds: ['a', 'b', 'gone', 'c'] } as any, [mk('a', 200), mk('b', null), mk('c', 100)]);
  assert.deepEqual(t, { seconds: 300, unknown: 1, count: 3 });
  assert.deepEqual(moveItem(['a', 'b', 'c'], 0, 2), ['b', 'c', 'a']);
  const same = ['a'];
  assert.equal(moveItem(same, 0, 1), same);
});

import type { Contract, Rider } from '../src/lib/types';
test('contract/rider mapping: round-trip, no device file sent to cloud', () => {
  const c: Contract = { id: 'ctr-000001', title: 'Toy', template: 'wedding', language: 'ru', counterparty: 'Rauf', amount: 3000, currency: 'AZN',
    status: 'sent', deadline: '', body: 'text', signedFileUri: 'file:///scan.jpg', createdAt: '2026-11-01T00:00:00.000Z', updatedAt: '2026-11-01T00:00:00.000Z' };
  const row = mappers.contracts.toRow(c, 'w');
  assert.equal(row.deadline, null);
  assert.ok(!JSON.stringify(row).includes('scan.jpg'), 'scan stays on device');
  const { signedFileUri, ...rest } = c;
  assert.deepEqual(mappers.contracts.fromRow({ ...row, amount: '3000.00' }), rest);
  const r: Rider = { id: 'rdr-000001', kind: 'technical', title: 'Rider', language: 'az', notes: '',
    sections: [{ key: 'sound', title: 'Səs', items: ['2 mic'] }], createdAt: c.createdAt, updatedAt: c.updatedAt };
  assert.deepEqual(mappers.riders.fromRow(mappers.riders.toRow(r, 'w')), r);
  assert.deepEqual(mappers.riders.fromRow({ ...mappers.riders.toRow(r, 'w'), sections: null }).sections, []);
});

import { canRead, canWrite, effectiveRole, pushableTables, readableTables, TABLE_AREA } from '../src/team/permissions';
test('permissions mirror the database policies', () => {
  assert.equal(canRead('member', 'money'), false);
  assert.equal(canRead('accountant', 'money'), true);
  assert.equal(canWrite('accountant', 'money'), true);
  assert.equal(canWrite('accountant', 'contracts'), false);
  assert.equal(canRead('accountant', 'contracts'), true);
  assert.equal(canRead('member', 'bookings'), false);
  assert.equal(canWrite('member', 'events'), false);
  assert.equal(canRead('viewer', 'riders'), true);
  assert.equal(canWrite('manager', 'team'), false);
  assert.equal(canWrite('owner', 'team'), true);
  const all = Object.keys(TABLE_AREA) as any[];
  assert.deepEqual(pushableTables('member', all), []);
  assert.deepEqual(pushableTables('accountant', all), ['money_records']);
  assert.deepEqual(readableTables('member', all).sort(), ['contacts', 'events', 'riders', 'setlists', 'songs', 'tasks']);
  assert.equal(effectiveRole(null, null), 'owner');
  assert.equal(effectiveRole('member', null), 'owner', 'no workspace -> local owner');
  assert.equal(effectiveRole('member', 'ws'), 'member');
});

import type { Task } from '../src/lib/types';
test('task mapping and migration v5 (existing cloud users become owners)', () => {
  const t: Task = { id: 'task-000001', title: 'Notlar', note: '', assigneeId: '', due: '', done: false, createdAt: '2026-11-01T00:00:00.000Z', updatedAt: '2026-11-01T00:00:00.000Z' };
  const row = mappers.tasks.toRow(t, 'w');
  assert.equal(row.assignee_id, null);
  assert.equal(row.due, null);
  assert.deepEqual(mappers.tasks.fromRow(row), t);
  const withAll = { ...t, assigneeId: 'u1', due: '2026-12-01', eventId: 'ev1', done: true };
  assert.deepEqual(mappers.tasks.fromRow(mappers.tasks.toRow(withAll, 'w')), withAll);
  const v5 = migrateStore({ cloud: { workspaceId: 'ws1', email: 'a@b.az' } }, 4) as any;
  assert.equal(v5.cloud.role, 'owner');
  assert.deepEqual(v5.tasks, []);
  const local = migrateStore({ cloud: { workspaceId: null } }, 4) as any;
  assert.equal(local.cloud.role, null);
});
