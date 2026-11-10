// Pure (no React Native imports) so it can be unit-tested in Node.

export interface CloudState {
  email: string | null;
  workspaceId: string | null;
  slug: string | null;
  lastPushAt: string | null;
  /** Per-table pull cursor (server synced_at). */
  pullCursors: Partial<Record<'events' | 'money_records' | 'booking_requests' | 'contacts' | 'songs' | 'setlists' | 'contracts' | 'riders', string>>;
  lastSyncAt: string | null;
}

export const emptyCloud: CloudState = {
  email: null,
  workspaceId: null,
  slug: null,
  lastPushAt: null,
  pullCursors: {},
  lastSyncAt: null,
};

/** v1 -> v2: updatedAt, bookings, contacts, tombstones, cloud. v2 -> v3: studio (songs, assets, setlists). v3 -> v4: contracts, riders, personal docs, reminders flag. */
export function migrateStore(state: Record<string, unknown>, version: number): Record<string, unknown> {
  let out = state;
  if (version < 2) out = migrateV1(out);
  if (version < 3) out = { ...out, songs: [], assets: [], setlists: [] };
  if (version < 4) out = { ...out, contracts: [], riders: [], docs: [], reminders: false };
  return out;
}

function migrateV1(state: Record<string, unknown>): Record<string, unknown> {
  const withUpdated = (list: unknown) =>
    Array.isArray(list) ? list.map((x: Record<string, unknown>) => ({ ...x, updatedAt: x.updatedAt ?? x.createdAt })) : [];
  return {
    ...state,
    events: withUpdated(state.events),
    records: withUpdated(state.records),
    bookings: [],
    contacts: [],
    tombstones: [],
    cloud: emptyCloud,
  };
}
