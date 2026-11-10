// "Today" agenda for the Home screen: everything that needs attention today, in time order.
// Pure function -> unit-tested.
import type { ArtistEvent, BookingRequest, Contract, ISODate, MoneyRecord, PersonalDoc, Task } from './types';

export type AgendaItem =
  | { kind: 'event'; id: string; time: string; event: ArtistEvent; balance: number }
  | { kind: 'task'; id: string; task: Task; overdue: boolean }
  | { kind: 'payment'; id: string; record: MoneyRecord; left: number; overdue: boolean }
  | { kind: 'contract'; id: string; contract: Contract; overdue: boolean }
  | { kind: 'bookings'; id: string; count: number }
  | { kind: 'document'; id: string; doc: PersonalDoc; days: number };

export interface AgendaInput {
  today: ISODate;
  events: ArtistEvent[];
  tasks: Task[];
  records: MoneyRecord[];
  contracts: Contract[];
  bookings: BookingRequest[];
  docs: PersonalDoc[];
  /** What this user may see (role + team). */
  can: { money: boolean; contracts: boolean; bookings: boolean };
  /** In a team: only my tasks. Alone: all open tasks. */
  myUserId: string | null;
  inTeam: boolean;
}

export interface Agenda {
  items: AgendaItem[];
  tomorrow: ArtistEvent[];
}

const days = (from: ISODate, to: ISODate) =>
  Math.round(
    (Date.UTC(+to.slice(0, 4), +to.slice(5, 7) - 1, +to.slice(8, 10)) -
      Date.UTC(+from.slice(0, 4), +from.slice(5, 7) - 1, +from.slice(8, 10))) /
      86400000,
  );

function addDays(iso: ISODate, n: number): ISODate {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

export function buildAgenda(i: AgendaInput): Agenda {
  const items: AgendaItem[] = [];

  // 1. Today's events, by start time (no time = end of the list).
  const todays = i.events
    .filter((e) => e.date === i.today)
    .sort((a, b) => (a.time || '99:99').localeCompare(b.time || '99:99'));
  for (const e of todays) {
    items.push({ kind: 'event', id: `ev-${e.id}`, time: e.time, event: e, balance: Math.max(0, e.fee - e.advance) });
  }

  // 2. Open tasks due today or overdue (mine in a team, all when alone).
  for (const t of i.tasks) {
    if (t.done || !t.due || t.due > i.today) continue;
    if (i.inTeam && t.assigneeId !== i.myUserId) continue;
    items.push({ kind: 'task', id: `tk-${t.id}`, task: t, overdue: t.due < i.today });
  }

  // 3. Money owed to the artist that is due today or already late.
  if (i.can.money) {
    for (const r of i.records) {
      const left = r.amount - r.paidAmount;
      if (r.kind !== 'income' || r.status === 'paid' || left <= 0 || r.date > i.today) continue;
      items.push({ kind: 'payment', id: `pay-${r.id}`, record: r, left, overdue: r.date < i.today || r.status === 'overdue' });
    }
  }

  // 4. Contracts to sign today or past their sign-by date.
  if (i.can.contracts) {
    for (const c of i.contracts) {
      if (!c.deadline || c.status === 'signed' || c.status === 'cancelled' || c.deadline > i.today) continue;
      items.push({ kind: 'contract', id: `ct-${c.id}`, contract: c, overdue: c.deadline < i.today });
    }
  }

  // 5. New booking requests (one line).
  if (i.can.bookings) {
    const n = i.bookings.filter((b) => b.status === 'new').length;
    if (n) items.push({ kind: 'bookings', id: 'bookings', count: n });
  }

  // 6. Documents expiring within 30 days (device-only).
  for (const d of i.docs) {
    if (!d.expiry) continue;
    const left = days(i.today, d.expiry);
    if (left <= 30) items.push({ kind: 'document', id: `doc-${d.id}`, doc: d, days: left });
  }

  // Order: timed events first, then late items, then the rest.
  const rank = (x: AgendaItem) =>
    x.kind === 'event'
      ? 0
      : (x.kind === 'task' || x.kind === 'payment' || x.kind === 'contract') && x.overdue
        ? 1
        : x.kind === 'bookings'
          ? 2
          : 3;
  const stable = items.map((x, idx) => ({ x, idx }));
  stable.sort((a, b) => rank(a.x) - rank(b.x) || a.idx - b.idx);

  const tomorrowDate = addDays(i.today, 1);
  const tomorrow = i.events
    .filter((e) => e.date === tomorrowDate)
    .sort((a, b) => (a.time || '99:99').localeCompare(b.time || '99:99'));

  return { items: stable.map((s) => s.x), tomorrow };
}
