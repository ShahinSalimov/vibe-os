import type { Currency, ISODate, MoneyRecord } from './types';

/** Amount still outstanding on a record (never negative). */
export function outstanding(r: MoneyRecord): number {
  if (r.status === 'paid') return 0;
  return Math.max(0, r.amount - r.paidAmount);
}

/** Amount actually settled so far. */
export function settled(r: MoneyRecord): number {
  if (r.status === 'paid') return r.amount;
  return Math.min(r.amount, r.paidAmount);
}

export interface Summary {
  income: number;
  expense: number;
  net: number;
  owedToYou: number;
  youOwe: number;
}

/**
 * Summary in one currency. Records in other currencies are excluded — VIBE OS
 * does not invent exchange rates.
 */
export function summarize(
  records: MoneyRecord[],
  currency: Currency,
  range?: { from: ISODate; to: ISODate },
): Summary {
  const s: Summary = { income: 0, expense: 0, net: 0, owedToYou: 0, youOwe: 0 };
  for (const r of records) {
    if (r.currency !== currency) continue;
    const inRange = !range || (r.date >= range.from && r.date <= range.to);
    if (inRange) {
      if (r.kind === 'income') s.income += settled(r);
      else s.expense += settled(r);
    }
    // balances are all-time
    if (r.kind === 'income') s.owedToYou += outstanding(r);
    else s.youOwe += outstanding(r);
  }
  s.net = s.income - s.expense;
  return s;
}

/** Derive the status from paid amount, keeping 'overdue' only if still unpaid. */
export function deriveStatus(amount: number, paid: number, requested: MoneyRecord['status']): MoneyRecord['status'] {
  if (amount > 0 && paid >= amount) return 'paid';
  if (requested === 'paid') return 'paid';
  if (requested === 'overdue') return 'overdue';
  if (paid > 0) return 'partial';
  return 'planned';
}

export function monthRange(today: ISODate): { from: ISODate; to: ISODate } {
  const [y, m] = today.split('-');
  return { from: `${y}-${m}-01`, to: `${y}-${m}-31` };
}

export interface CounterpartyBalance {
  name: string;
  currency: Currency;
  owedToYou: number;
  youOwe: number;
}

/** "Who owes whom": outstanding balance per counterparty and currency. */
export function balancesByCounterparty(records: MoneyRecord[]): CounterpartyBalance[] {
  const map = new Map<string, CounterpartyBalance>();
  for (const r of records) {
    const out = outstanding(r);
    if (out <= 0) continue;
    const name = r.counterparty.trim() || '—';
    const key = `${name.toLowerCase()}|${r.currency}`;
    const b = map.get(key) ?? { name, currency: r.currency, owedToYou: 0, youOwe: 0 };
    if (r.kind === 'income') b.owedToYou += out;
    else b.youOwe += out;
    map.set(key, b);
  }
  return [...map.values()].sort((a, b) => b.owedToYou + b.youOwe - (a.owedToYou + a.youOwe));
}
