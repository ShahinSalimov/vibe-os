/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildAgenda, type AgendaInput } from '../src/lib/agenda';

const T = '2026-11-10';
const ev = (id: string, date: string, time = '', fee = 0, advance = 0) =>
  ({ id, title: id, type: 'wedding', date, time, venue: '', city: '', organizer: '', organizerPhone: '', fee, advance, currency: 'AZN', notes: '', createdAt: '', updatedAt: '' }) as any;
const base = (p: Partial<AgendaInput> = {}): AgendaInput => ({
  today: T, events: [], tasks: [], records: [], contracts: [], bookings: [], docs: [],
  can: { money: true, contracts: true, bookings: true }, myUserId: null, inTeam: false, ...p,
});

test('agenda: today events sorted by time, balance computed; tomorrow separate', () => {
  const a = buildAgenda(base({ events: [ev('late', T, '21:00'), ev('notime', T), ev('early', T, '10:30', 3000, 1000), ev('tmr', '2026-11-11', '19:00'), ev('past', '2026-11-09')] }));
  assert.deepEqual(a.items.map((x) => x.id), ['ev-early', 'ev-late', 'ev-notime']);
  assert.equal((a.items[0] as any).balance, 2000);
  assert.deepEqual(a.tomorrow.map((e) => e.id), ['tmr']);
});

test('agenda: tasks due today/overdue; mine only in a team', () => {
  const tasks = [
    { id: 'a', title: 'a', note: '', assigneeId: 'me', due: T, done: false },
    { id: 'b', title: 'b', note: '', assigneeId: 'other', due: '2026-11-01', done: false },
    { id: 'c', title: 'c', note: '', assigneeId: 'me', due: '2026-11-20', done: false },
    { id: 'd', title: 'd', note: '', assigneeId: 'me', due: '2026-11-01', done: true },
    { id: 'e', title: 'e', note: '', assigneeId: '', due: '', done: false },
  ] as any[];
  assert.deepEqual(buildAgenda(base({ tasks })).items.map((x) => x.id).sort(), ['tk-a', 'tk-b']);
  const team = buildAgenda(base({ tasks, inTeam: true, myUserId: 'me' }));
  assert.deepEqual(team.items.map((x) => x.id), ['tk-a']);
});

test('agenda: payments and contracts respect permissions; late items first after events', () => {
  const records = [
    { id: 'p1', kind: 'income', counterparty: 'Rauf', amount: 3000, paidAmount: 1000, status: 'partial', date: '2026-11-05' },
    { id: 'p2', kind: 'income', counterparty: 'X', amount: 500, paidAmount: 0, status: 'planned', date: T },
    { id: 'p3', kind: 'income', counterparty: 'Y', amount: 500, paidAmount: 500, status: 'paid', date: T },
    { id: 'p4', kind: 'expense', counterparty: 'Z', amount: 100, paidAmount: 0, status: 'planned', date: T },
    { id: 'p5', kind: 'income', counterparty: 'F', amount: 100, paidAmount: 0, status: 'planned', date: '2026-12-01' },
  ] as any[];
  const contracts = [
    { id: 'c1', status: 'sent', deadline: T },
    { id: 'c2', status: 'signed', deadline: '2026-11-01' },
    { id: 'c3', status: 'draft', deadline: '2026-11-08' },
  ] as any[];
  const a = buildAgenda(base({ records, contracts, events: [ev('show', T, '20:00')] }));
  assert.deepEqual(a.items.map((x) => x.id), ['ev-show', 'pay-p1', 'ct-c3', 'pay-p2', 'ct-c1']);
  assert.equal((a.items[1] as any).left, 2000);
  const member = buildAgenda(base({ records, contracts, can: { money: false, contracts: false, bookings: false } }));
  assert.deepEqual(member.items, []);
});

test('agenda: new bookings line and documents within 30 days', () => {
  const a = buildAgenda(base({
    bookings: [{ status: 'new' }, { status: 'new' }, { status: 'confirmed' }] as any,
    docs: [{ id: 'pass', expiry: '2026-11-25' }, { id: 'far', expiry: '2027-06-01' }, { id: 'none', expiry: '' }, { id: 'gone', expiry: '2026-11-01' }] as any,
  }));
  assert.deepEqual(a.items.map((x) => x.id), ['bookings', 'doc-pass', 'doc-gone']);
  assert.equal((a.items[0] as any).count, 2);
  assert.equal((a.items[1] as any).days, 15);
  assert.equal((a.items[2] as any).days, -9);
});
