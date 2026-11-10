// Pure reminder planner: from app data -> list of local notifications to schedule.
// No network, no push server: everything runs on the phone.
import type { ArtistEvent, Contract, ISODate, MoneyRecord, PersonalDoc } from '../lib/types';

export interface PlannedReminder {
  id: string;
  /** Local date-time "YYYY-MM-DDTHH:MM" */
  at: string;
  kind: 'event' | 'payment' | 'contract' | 'document';
  /** i18n key + params, resolved by the scheduler in the user's language. */
  key: string;
  params: Record<string, string | number>;
}

export const REMINDER_HOUR = '10:00';
export const MAX_REMINDERS = 60; // iOS allows 64 pending local notifications
const DOC_DAYS = [60, 30, 7];

function addDays(iso: ISODate, n: number): ISODate {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return dt.toISOString().slice(0, 10);
}

export function planReminders(
  input: { events: ArtistEvent[]; records: MoneyRecord[]; contracts: Contract[]; docs: PersonalDoc[] },
  now: Date,
): PlannedReminder[] {
  const pad = (n: number) => String(n).padStart(2, '0');
  const nowLocal = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
  const out: PlannedReminder[] = [];
  const push = (r: PlannedReminder) => {
    if (r.at > nowLocal) out.push(r);
  };

  // Events: the day before at 10:00, and 2 hours before if a start time is known.
  for (const e of input.events) {
    push({ id: `ev-${e.id}-1d`, at: `${addDays(e.date, -1)}T${REMINDER_HOUR}`, kind: 'event', key: 'notify.eventTomorrow', params: { title: e.title } });
    if (e.time) {
      const [h, m] = e.time.split(':').map(Number);
      const startMin = h * 60 + m - 120;
      const day = startMin < 0 ? addDays(e.date, -1) : e.date;
      const mm = ((startMin % 1440) + 1440) % 1440;
      push({ id: `ev-${e.id}-2h`, at: `${day}T${pad(Math.floor(mm / 60))}:${pad(mm % 60)}`, kind: 'event', key: 'notify.eventSoon', params: { title: e.title, time: e.time } });
    }
  }

  // Money owed to the artist: on the due date, if still unpaid.
  for (const r of input.records) {
    if (r.kind !== 'income' || r.status === 'paid' || r.amount - r.paidAmount <= 0) continue;
    push({ id: `pay-${r.id}`, at: `${r.date}T${REMINDER_HOUR}`, kind: 'payment', key: 'notify.paymentDue', params: { name: r.counterparty } });
  }

  // Contracts not yet signed: 2 days before and on the sign-by date.
  for (const c of input.contracts) {
    if (!c.deadline || c.status === 'signed' || c.status === 'cancelled') continue;
    push({ id: `ct-${c.id}-2d`, at: `${addDays(c.deadline, -2)}T${REMINDER_HOUR}`, kind: 'contract', key: 'notify.contractSoon', params: { title: c.title } });
    push({ id: `ct-${c.id}-0d`, at: `${c.deadline}T${REMINDER_HOUR}`, kind: 'contract', key: 'notify.contractToday', params: { title: c.title } });
  }

  // Documents: 60, 30 and 7 days before expiry.
  for (const d of input.docs) {
    if (!d.expiry) continue;
    for (const n of DOC_DAYS) {
      push({ id: `doc-${d.id}-${n}`, at: `${addDays(d.expiry, -n)}T${REMINDER_HOUR}`, kind: 'document', key: 'notify.docExpires', params: { title: d.title, days: n } });
    }
  }

  // Nearest first; respect the OS limit.
  return out.sort((a, b) => a.at.localeCompare(b.at)).slice(0, MAX_REMINDERS);
}

/** Days until a date (negative = past). Used for "expires in N days" badges. */
export function daysUntil(date: ISODate, today: ISODate): number {
  const a = Date.UTC(+today.slice(0, 4), +today.slice(5, 7) - 1, +today.slice(8, 10));
  const b = Date.UTC(+date.slice(0, 4), +date.slice(5, 7) - 1, +date.slice(8, 10));
  return Math.round((b - a) / 86400000);
}
