// Pure (no React Native imports) so it can be unit-tested in Node.

export interface CloudState {
  email: string | null;
  workspaceId: string | null;
  slug: string | null;
  lastPushAt: string | null;
  /** Per-table pull cursor (server synced_at). */
  pullCursors: Partial<Record<'events' | 'money_records' | 'booking_requests' | 'contacts' | 'songs' | 'setlists' | 'contracts' | 'riders' | 'tasks', string>>;
  /** Role in the cloud workspace; null = not signed in (local owner). */
  role: 'owner' | 'manager' | 'member' | 'accountant' | 'viewer' | null;
  /** Cloud user id (to recognise "my" tasks). */
  userId: string | null;
  lastSyncAt: string | null;
}

export const emptyCloud: CloudState = {
  email: null,
  workspaceId: null,
  slug: null,
  lastPushAt: null,
  pullCursors: {},
  lastSyncAt: null,
  role: null,
  userId: null,
};

/** v1 -> v2: updatedAt, bookings, contacts, tombstones, cloud. v2 -> v3: studio (songs, assets, setlists). v3 -> v4: contracts, riders, personal docs, reminders flag. v4 -> v5: tasks, team members, cloud role. */
export function migrateStore(state: Record<string, unknown>, version: number): Record<string, unknown> {
  let out = state;
  if (version < 2) out = migrateV1(out);
  if (version < 3) out = { ...out, songs: [], assets: [], setlists: [] };
  if (version < 4) out = { ...out, contracts: [], riders: [], docs: [], reminders: false };
  if (version < 5) {
    const cloud = { ...emptyCloud, ...((out.cloud as object) ?? {}) };
    // existing signed-in users created their own workspace -> they are its owner
    if (cloud.workspaceId && !cloud.role) cloud.role = 'owner';
    out = { ...out, tasks: [], members: [], cloud };
  }
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
