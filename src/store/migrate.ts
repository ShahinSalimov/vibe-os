// Pure (no React Native imports) so it can be unit-tested in Node.

export interface CloudState {
  email: string | null;
  workspaceId: string | null;
  slug: string | null;
  lastPushAt: string | null;
  /** Per-table pull cursor (server synced_at). */
  pullCursors: Partial<Record<'events' | 'money_records' | 'booking_requests' | 'contacts', string>>;
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

/** v1 (Phase 1) -> v2: adds updatedAt, bookings, contacts, tombstones, cloud. Exported for tests. */
export function migrateStore(state: Record<string, unknown>, version: number): Record<string, unknown> {
  if (version < 2) {
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
  return state;
}
