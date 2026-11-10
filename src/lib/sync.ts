// Pure sync logic: row mapping (camelCase <-> snake_case) and last-write-wins merge.
// No network code here, so it is fully unit-testable.
import type {
  ArtistEvent,
  BookingRequest,
  Contact,
  MoneyRecord,
  SyncTable,
  Tombstone,
} from './types';

type Row = Record<string, unknown>;

export interface Synced {
  id: string;
  updatedAt: string;
}

// ---------- mappers ----------

export const mappers = {
  events: {
    toRow: (e: ArtistEvent, ws: string): Row => ({
      id: e.id,
      workspace_id: ws,
      title: e.title,
      type: e.type,
      date: e.date,
      time: e.time,
      venue: e.venue,
      city: e.city,
      organizer: e.organizer,
      organizer_phone: e.organizerPhone,
      fee: e.fee,
      advance: e.advance,
      currency: e.currency,
      notes: e.notes,
      created_at: e.createdAt,
      updated_at: e.updatedAt,
      deleted_at: null,
    }),
    fromRow: (r: Row): ArtistEvent => ({
      id: String(r.id),
      title: String(r.title ?? ''),
      type: r.type as ArtistEvent['type'],
      date: String(r.date),
      time: String(r.time ?? ''),
      venue: String(r.venue ?? ''),
      city: String(r.city ?? ''),
      organizer: String(r.organizer ?? ''),
      organizerPhone: String(r.organizer_phone ?? ''),
      fee: Number(r.fee ?? 0),
      advance: Number(r.advance ?? 0),
      currency: r.currency as ArtistEvent['currency'],
      notes: String(r.notes ?? ''),
      createdAt: String(r.created_at),
      updatedAt: String(r.updated_at),
    }),
  },
  money_records: {
    toRow: (m: MoneyRecord, ws: string): Row => ({
      id: m.id,
      workspace_id: ws,
      kind: m.kind,
      counterparty: m.counterparty,
      amount: m.amount,
      paid_amount: m.paidAmount,
      currency: m.currency,
      date: m.date,
      status: m.status,
      category: m.category,
      note: m.note,
      event_id: m.eventId ?? null,
      created_at: m.createdAt,
      updated_at: m.updatedAt,
      deleted_at: null,
    }),
    fromRow: (r: Row): MoneyRecord => ({
      id: String(r.id),
      kind: r.kind as MoneyRecord['kind'],
      counterparty: String(r.counterparty ?? ''),
      amount: Number(r.amount ?? 0),
      paidAmount: Number(r.paid_amount ?? 0),
      currency: r.currency as MoneyRecord['currency'],
      date: String(r.date),
      status: r.status as MoneyRecord['status'],
      category: String(r.category ?? ''),
      note: String(r.note ?? ''),
      ...(r.event_id ? { eventId: String(r.event_id) } : {}),
      createdAt: String(r.created_at),
      updatedAt: String(r.updated_at),
    }),
  },
  booking_requests: {
    toRow: (b: BookingRequest, ws: string): Row => ({
      id: b.id,
      workspace_id: ws,
      source: b.source,
      organizer_name: b.organizerName,
      phone: b.phone,
      email: b.email,
      event_type: b.eventType,
      date: b.date,
      city: b.city,
      venue: b.venue,
      guests: b.guests,
      budget: b.budget,
      currency: b.currency,
      message: b.message,
      language: b.language,
      status: b.status,
      event_id: b.eventId ?? null,
      created_at: b.createdAt,
      updated_at: b.updatedAt,
      deleted_at: null,
    }),
    fromRow: (r: Row): BookingRequest => ({
      id: String(r.id),
      source: (r.source as BookingRequest['source']) ?? 'manual',
      organizerName: String(r.organizer_name ?? ''),
      phone: String(r.phone ?? ''),
      email: String(r.email ?? ''),
      eventType: r.event_type as BookingRequest['eventType'],
      date: String(r.date),
      city: String(r.city ?? ''),
      venue: String(r.venue ?? ''),
      guests: r.guests == null ? null : Number(r.guests),
      budget: r.budget == null ? null : Number(r.budget),
      currency: r.currency as BookingRequest['currency'],
      message: String(r.message ?? ''),
      language: (r.language as BookingRequest['language']) ?? 'az',
      status: r.status as BookingRequest['status'],
      ...(r.event_id ? { eventId: String(r.event_id) } : {}),
      createdAt: String(r.created_at),
      updatedAt: String(r.updated_at),
    }),
  },
  contacts: {
    toRow: (c: Contact, ws: string): Row => ({
      id: c.id,
      workspace_id: ws,
      name: c.name,
      kind: c.kind,
      phone: c.phone,
      email: c.email,
      note: c.note,
      created_at: c.createdAt,
      updated_at: c.updatedAt,
      deleted_at: null,
    }),
    fromRow: (r: Row): Contact => ({
      id: String(r.id),
      name: String(r.name ?? ''),
      kind: r.kind as Contact['kind'],
      phone: String(r.phone ?? ''),
      email: String(r.email ?? ''),
      note: String(r.note ?? ''),
      createdAt: String(r.created_at),
      updatedAt: String(r.updated_at),
    }),
  },
} as const;

// ---------- merge ----------

const ts = (s: string | null | undefined) => (s ? Date.parse(s) : 0);

/**
 * Merges rows pulled from the server into local items (last-write-wins on updatedAt).
 * Rows with deleted_at remove the local item unless the local copy is newer.
 */
export function mergeRemote<T extends Synced>(local: T[], rows: Row[], fromRow: (r: Row) => T): T[] {
  const byId = new Map(local.map((x) => [x.id, x]));
  let changed = false;
  for (const row of rows) {
    const id = String(row.id);
    const mine = byId.get(id);
    const remoteUpdated = ts(row.updated_at as string);
    if (row.deleted_at) {
      if (mine && ts(mine.updatedAt) <= remoteUpdated) {
        byId.delete(id);
        changed = true;
      }
      continue;
    }
    if (!mine || remoteUpdated > ts(mine.updatedAt)) {
      byId.set(id, fromRow(row));
      changed = true;
    }
  }
  // Same reference when nothing changed: avoids re-render and sync loops.
  return changed ? [...byId.values()] : local;
}

/** Items changed locally since the last successful push. */
export function changedSince<T extends Synced>(items: T[], since: string | null): T[] {
  if (!since) return items;
  const t = ts(since);
  return items.filter((x) => ts(x.updatedAt) > t);
}

/** Tombstones pending for a table, as soft-delete rows. */
export function tombstoneRows(tombstones: Tombstone[], table: SyncTable, ws: string): Row[] {
  return tombstones
    .filter((t) => t.table === table)
    .map((t) => ({ id: t.id, workspace_id: ws, updated_at: t.deletedAt, deleted_at: t.deletedAt }));
}

/** Newest synced_at among pulled rows; becomes the next pull cursor. */
export function nextCursor(rows: Row[], prev: string | null): string | null {
  let best = prev ? ts(prev) : 0;
  let out = prev;
  for (const r of rows) {
    const v = ts(r.synced_at as string);
    if (v > best) {
      best = v;
      out = String(r.synced_at);
    }
  }
  return out;
}

/** Pull window starts 60s before the cursor so rows committed late are not missed (merge is idempotent). */
export function pullFrom(cursor: string | null): string | null {
  if (!cursor) return null;
  return new Date(ts(cursor) - 60_000).toISOString();
}

// ---------- booking slug ----------

const TRANSLIT: Record<string, string> = {
  ə: 'e', ı: 'i', ö: 'o', ü: 'u', ğ: 'g', ş: 'sh', ç: 'ch', İ: 'i',
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'yo', ж: 'zh', з: 'z', и: 'i', й: 'y',
  к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f',
  х: 'kh', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
};

/** "Aysel Məmmədova" -> "aysel-memmedova", "Айсель" -> "aysel". Always 3..40 chars, [a-z0-9-]. */
export function slugify(name: string): string {
  const base = [...name.toLowerCase()]
    .map((ch) => TRANSLIT[ch] ?? ch)
    .join('')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32)
    .replace(/-+$/g, '');
  return base.length >= 3 ? base : `artist-${base || 'vibe'}`.slice(0, 40);
}
