import type { SupabaseClient } from '@supabase/supabase-js';
import { changedSince, mappers, nextCursor, pullFrom, slugify, tombstoneRows } from '../lib/sync';
import type { SyncTable } from '../lib/types';
import { useAppStore } from '../store/useAppStore';
import { getClient } from './client';

export type SyncResult =
  | { ok: true; pulled: number; pushed: number }
  | { ok: false; error: 'not_configured' | 'not_signed_in' | 'payment_data' | 'network' | string };

const TABLES: SyncTable[] = ['events', 'money_records', 'booking_requests', 'contacts', 'songs', 'setlists', 'contracts', 'riders'];

let running: Promise<SyncResult> | null = null;

/** One sync round: ensure workspace -> push local changes -> pull remote changes. Never runs twice at once. */
export function syncNow(): Promise<SyncResult> {
  if (!running) running = doSync().finally(() => (running = null));
  return running;
}

async function ensureWorkspace(sb: SupabaseClient): Promise<{ id: string; slug: string } | null> {
  const st = useAppStore.getState();
  if (st.cloud.workspaceId && st.cloud.slug) return { id: st.cloud.workspaceId, slug: st.cloud.slug };

  const { data: member, error } = await sb
    .from('workspace_members')
    .select('workspace_id, workspaces(slug)')
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (member) {
    const ws = member.workspaces as unknown as { slug: string } | null;
    return { id: member.workspace_id as string, slug: ws?.slug ?? '' };
  }

  // First sign-in: create the workspace from the onboarding profile.
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
  return { id: id as string, slug };
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
  }
}

function toRows(table: SyncTable, ws: string, since: string | null): Record<string, unknown>[] {
  const items = changedSince(localItems(table) as { id: string; updatedAt: string }[], since);
  const m = mappers[table] as { toRow: (x: unknown, ws: string) => Record<string, unknown> };
  return items.map((x) => m.toRow(x, ws));
}

async function doSync(): Promise<SyncResult> {
  const sb = getClient();
  if (!sb) return { ok: false, error: 'not_configured' };
  const { data: sess } = await sb.auth.getSession();
  if (!sess.session) return { ok: false, error: 'not_signed_in' };

  try {
    const ws = await ensureWorkspace(sb);
    if (!ws) return { ok: false, error: 'no_profile' };
    const store = useAppStore.getState();
    store.setCloud({ email: sess.session.user.email ?? null, workspaceId: ws.id, slug: ws.slug });

    // ---- push ----
    const pushStartedAt = new Date().toISOString();
    const { lastPushAt } = store.cloud;
    let pushed = 0;
    for (const table of TABLES) {
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
    useAppStore.getState().clearTombstones(pushStartedAt);

    // ---- pull ----
    const cursors = { ...useAppStore.getState().cloud.pullCursors };
    let pulled = 0;
    for (const table of TABLES) {
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

    useAppStore.getState().setCloud({ lastPushAt: pushStartedAt, pullCursors: cursors, lastSyncAt: new Date().toISOString() });
    return { ok: true, pulled, pushed };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String((e as { message?: string })?.message ?? e);
    if (msg.includes('payment_data_not_allowed')) return { ok: false, error: 'payment_data' };
    if (/fetch|network/i.test(msg)) return { ok: false, error: 'network' };
    return { ok: false, error: msg };
  }
}
