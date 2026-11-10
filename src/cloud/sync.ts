import type { SupabaseClient } from '@supabase/supabase-js';
import { changedSince, mappers, nextCursor, pullFrom, slugify, tombstoneRows } from '../lib/sync';
import type { SyncTable, TeamMember } from '../lib/types';
import { useAppStore } from '../store/useAppStore';
import { pushableTables, readableTables, type MemberRole } from '../team/permissions';
import { getClient } from './client';

export type SyncResult =
  | { ok: true; pulled: number; pushed: number }
  | { ok: false; error: 'not_configured' | 'not_signed_in' | 'payment_data' | 'network' | 'removed' | string };

const TABLES: SyncTable[] = [
  'events',
  'money_records',
  'booking_requests',
  'contacts',
  'songs',
  'setlists',
  'contracts',
  'riders',
  'tasks',
];

let running: Promise<SyncResult> | null = null;

/** One sync round: workspace + role -> push what this role may write -> pull what it may read. Never runs twice at once. */
export function syncNow(): Promise<SyncResult> {
  if (!running) running = doSync().finally(() => (running = null));
  return running;
}

type Ws = { id: string; slug: string; role: MemberRole };

/** Finds this user's membership (the current workspace if still valid), or creates a workspace on first sign-in. */
async function ensureWorkspace(sb: SupabaseClient, userId: string): Promise<Ws | 'removed' | null> {
  const st = useAppStore.getState();
  const { data: rows, error } = await sb
    .from('workspace_members')
    .select('workspace_id, role, workspaces(slug)')
    .eq('user_id', userId);
  if (error) throw error;
  const mine = (rows ?? []).map((r) => ({
    id: r.workspace_id as string,
    role: r.role as MemberRole,
    slug: ((r.workspaces as unknown as { slug: string } | null)?.slug ?? '') as string,
  }));

  if (st.cloud.workspaceId) {
    const cur = mine.find((m) => m.id === st.cloud.workspaceId);
    if (cur) return cur;
    return 'removed'; // the owner removed this phone's user from the team
  }
  if (mine.length) {
    // prefer a workspace this user owns, then the most privileged one
    const order: MemberRole[] = ['owner', 'manager', 'accountant', 'member', 'viewer'];
    return [...mine].sort((a, b) => order.indexOf(a.role) - order.indexOf(b.role))[0];
  }

  // First sign-in of an artist: create the workspace from the onboarding profile.
  const p = st.profile;
  if (!p) return null;
  let slug = slugify(p.stageName);
  for (let i = 0; i < 5; i++) {
    const { data: free } = await sb.rpc('slug_available', { p_slug: slug });
    if (free) break;
    slug = `${slugify(p.stageName).slice(0, 34)}-${Math.floor(100 + Math.random() * 900)}`;
  }
  const { data: id, error: e2 } = await sb.rpc('create_workspace', {
    p_stage_name: p.stageName,
    p_slug: slug,
    p_artist_role: p.role,
    p_genre: p.genre,
    p_currency: st.settings.currency,
  });
  if (e2) throw e2;
  return { id: id as string, slug, role: 'owner' };
}

function localItems(table: SyncTable) {
  const s = useAppStore.getState();
  switch (table) {
    case 'events':
      return s.events;
    case 'money_records':
      return s.records;
    case 'booking_requests':
      return s.bookings;
    case 'contacts':
      return s.contacts;
    case 'songs':
      return s.songs;
    case 'setlists':
      return s.setlists;
    case 'contracts':
      return s.contracts;
    case 'riders':
      return s.riders;
    case 'tasks':
      return s.tasks;
  }
}

function toRows(table: SyncTable, ws: string, since: string | null): Record<string, unknown>[] {
  const items = changedSince(localItems(table) as { id: string; updatedAt: string }[], since);
  const m = mappers[table] as { toRow: (x: unknown, ws: string) => Record<string, unknown> };
  return items.map((x) => m.toRow(x, ws));
}

export async function refreshMembers(sb: SupabaseClient, ws: string): Promise<void> {
  const { data, error } = await sb.rpc('team_members', { p_workspace: ws });
  if (error) return;
  const members: TeamMember[] = ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    userId: String(r.user_id),
    role: r.role as TeamMember['role'],
    displayName: String(r.display_name ?? ''),
    email: String(r.email ?? ''),
    joinedAt: String(r.joined_at ?? ''),
  }));
  useAppStore.getState().setMembers(members);
}

export async function refreshLicense(sb: SupabaseClient, ws: string): Promise<void> {
  const { data, error } = await sb.from('licenses').select('status, trial_ends_at, activated_at').eq('workspace_id', ws).maybeSingle();
  if (error || !data) return;
  useAppStore.getState().setCloud({
    license: {
      status: data.status as 'trial' | 'active' | 'suspended',
      trialEndsAt: String(data.trial_ends_at),
      activatedAt: data.activated_at ? String(data.activated_at) : null,
    },
  });
}

async function doSync(): Promise<SyncResult> {
  const sb = getClient();
  if (!sb) return { ok: false, error: 'not_configured' };
  const { data: sess } = await sb.auth.getSession();
  if (!sess.session) return { ok: false, error: 'not_signed_in' };
  const userId = sess.session.user.id;

  try {
    const ws = await ensureWorkspace(sb, userId);
    if (ws === 'removed') {
      // Stop showing that team's data on this phone; keep profile, settings and personal docs.
      const s = useAppStore.getState();
      s.resetWorkspaceData();
      s.setCloud({ workspaceId: null, slug: null, role: null, lastPushAt: null, pullCursors: {}, lastSyncAt: null });
      return { ok: false, error: 'removed' };
    }
    if (!ws) return { ok: false, error: 'no_profile' };
    const store = useAppStore.getState();
    store.setCloud({ email: sess.session.user.email ?? null, userId, workspaceId: ws.id, slug: ws.slug, role: ws.role });

    // ---- push: only what this role may write ----
    const pushStartedAt = new Date().toISOString();
    const { lastPushAt } = store.cloud;
    const writable = pushableTables(ws.role, TABLES);
    let pushed = 0;
    for (const table of writable) {
      const rows = toRows(table, ws.id, lastPushAt);
      for (let i = 0; i < rows.length; i += 200) {
        const chunk = rows.slice(i, i + 200);
        const { error } = await sb.from(table).upsert(chunk, { onConflict: 'id' });
        if (error) throw error;
        pushed += chunk.length;
      }
      const tombs = tombstoneRows(useAppStore.getState().tombstones, table, ws.id);
      for (const t of tombs) {
        const { error } = await sb
          .from(table)
          .update({ deleted_at: t.deleted_at, updated_at: t.updated_at })
          .eq('id', t.id as string);
        if (error) throw error;
        pushed += 1;
      }
    }
    // Assignees without task rights: send only the done flag of their own tasks.
    if (!writable.includes('tasks')) {
      const mine = changedSince(useAppStore.getState().tasks, lastPushAt).filter((x) => x.assigneeId === userId);
      for (const x of mine) {
        const { error } = await sb.from('tasks').update({ done: x.done, updated_at: x.updatedAt }).eq('id', x.id);
        if (error) throw error;
        pushed += 1;
      }
    }
    useAppStore.getState().clearTombstones(pushStartedAt);

    // ---- pull: only what this role may read ----
    const cursors = { ...useAppStore.getState().cloud.pullCursors };
    let pulled = 0;
    for (const table of readableTables(ws.role, TABLES)) {
      const from = pullFrom(cursors[table] ?? null);
      let q = sb.from(table).select('*').eq('workspace_id', ws.id).order('synced_at').limit(1000);
      if (from) q = q.gt('synced_at', from);
      const { data, error } = await q;
      if (error) throw error;
      const rows = (data ?? []) as Record<string, unknown>[];
      useAppStore.getState().applyRemote(table, rows);
      const next = nextCursor(rows, cursors[table] ?? null);
      if (next) cursors[table] = next;
      pulled += rows.length;
    }

    await refreshMembers(sb, ws.id);
    await refreshLicense(sb, ws.id);
    useAppStore.getState().setCloud({ lastPushAt: pushStartedAt, pullCursors: cursors, lastSyncAt: new Date().toISOString() });
    return { ok: true, pulled, pushed };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String((e as { message?: string })?.message ?? e);
    if (msg.includes('payment_data_not_allowed')) return { ok: false, error: 'payment_data' };
    if (msg.includes('license_required')) {
      // licence ended while offline: refresh so the app shows the right state
      const ws = useAppStore.getState().cloud.workspaceId;
      if (ws) await refreshLicense(sb, ws).catch(() => {});
      return { ok: false, error: 'license_required' };
    }
    if (/fetch|network/i.test(msg)) return { ok: false, error: 'network' };
    return { ok: false, error: msg };
  }
}
