/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildDemoData } from '../src/demo/demoData';
import { buildAgenda } from '../src/lib/agenda';
import { detectSensitiveIn, validPhone } from '../src/lib/sensitive';
import { LANGUAGES } from '../src/lib/types';

const TODAY = '2026-11-10';

test('demo data is consistent in every language', () => {
  for (const lang of LANGUAGES) {
    const d = buildDemoData(lang, TODAY, '2026-11-10T09:00:00.000Z');
    const eventIds = new Set(d.events.map((e) => e.id));
    const songIds = new Set(d.songs.map((s) => s.id));
    for (const r of d.records) if (r.eventId) assert.ok(eventIds.has(r.eventId), `${lang} record -> event`);
    for (const l of d.setlists) {
      if (l.eventId) assert.ok(eventIds.has(l.eventId), `${lang} setlist -> event`);
      for (const s of l.songIds) assert.ok(songIds.has(s), `${lang} setlist -> song`);
    }
    for (const c of d.contracts) if (c.eventId) assert.ok(eventIds.has(c.eventId), `${lang} contract -> event`);
    const all = [...d.events, ...d.records, ...d.bookings, ...d.contacts, ...d.songs, ...d.setlists, ...d.contracts, ...d.riders, ...d.tasks];
    assert.equal(new Set(all.map((x) => x.id)).size, all.length, `${lang} unique ids`);
    assert.ok(all.every((x) => x.id.startsWith('demo-') && x.id.length >= 8), `${lang} id format`);
    for (const r of d.records) assert.ok(r.paidAmount <= r.amount && r.amount > 0, `${lang} amounts`);
    for (const e of d.events) assert.ok(e.advance <= e.fee || e.fee === 0, `${lang} advance <= fee`);
    // demo data must pass the same guards as user data
    assert.equal(detectSensitiveIn(all.flatMap((x) => Object.values(x).filter((v) => typeof v === 'string') as string[])), null);
    for (const e of d.events) assert.ok(validPhone(e.organizerPhone), `${lang} phone ${e.organizerPhone}`);
    assert.ok(d.riders[0].sections.length > 0);
  }
});

test('demo makes a busy, convincing "today"', () => {
  const d = buildDemoData('az', TODAY, '2026-11-10T09:00:00.000Z');
  const a = buildAgenda({
    today: TODAY, events: d.events, tasks: d.tasks, records: d.records, contracts: d.contracts, bookings: d.bookings, docs: [],
    can: { money: true, contracts: true, bookings: true }, myUserId: null, inTeam: false,
  });
  const kinds = a.items.map((x) => x.kind);
  assert.ok(kinds.filter((k) => k === 'event').length >= 2, 'two events today');
  assert.ok(kinds.includes('task') && kinds.includes('payment') && kinds.includes('bookings'));
  assert.ok(a.tomorrow.length >= 1, 'something tomorrow');
  assert.ok(d.events.some((e) => e.date < TODAY), 'a past event for history');
  assert.equal(d.profile.stageName, 'Aysel (demo)');
});
