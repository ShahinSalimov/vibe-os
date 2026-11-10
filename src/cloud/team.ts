import { useAppStore } from '../store/useAppStore';
import type { MemberRole } from '../team/permissions';
import { getClient } from './client';
import { refreshMembers, syncNow } from './sync';

export type TeamResult<T = void> = { ok: true; value: T } | { ok: false; error: string };

function errCode(msg: string): string {
  for (const code of ['invite_not_found', 'invite_used', 'invite_expired', 'already_member', 'not_owner', 'owner_protected', 'too_many_invites']) {
    if (msg.includes(code)) return code;
  }
  return /fetch|network/i.test(msg) ? 'network' : msg;
}

/** "ABCD2345" -> "ABCD-2345" for reading aloud / sharing. */
export function formatInviteCode(code: string): string {
  const c = code.replace(/[^A-Z0-9]/gi, '').toUpperCase();
  return c.length === 8 ? `${c.slice(0, 4)}-${c.slice(4)}` : c;
}

export async function createInvite(role: MemberRole): Promise<TeamResult<string>> {
  const sb = getClient();
  const ws = useAppStore.getState().cloud.workspaceId;
  if (!sb || !ws) return { ok: false, error: 'not_signed_in' };
  const { data, error } = await sb.rpc('create_invite', { p_workspace: ws, p_role: role });
  return error ? { ok: false, error: errCode(error.message) } : { ok: true, value: String(data) };
}

/**
 * Joins a team. The phone switches to that workspace: local business data is cleared first
 * (the caller must have confirmed this with the user), then everything is pulled from the cloud.
 */
export async function joinTeam(code: string, displayName: string): Promise<TeamResult<string>> {
  const sb = getClient();
  if (!sb) return { ok: false, error: 'not_configured' };
  const { data, error } = await sb.rpc('accept_invite', { p_code: code, p_display_name: displayName });
  if (error) return { ok: false, error: errCode(error.message) };
  const st = useAppStore.getState();
  st.resetWorkspaceData();
  st.setCloud({ workspaceId: String(data), slug: null, role: null, lastPushAt: new Date().toISOString(), pullCursors: {}, lastSyncAt: null });
  const r = await syncNow();
  return r.ok ? { ok: true, value: String(data) } : { ok: false, error: r.error };
}

export async function changeRole(userId: string, role: MemberRole): Promise<TeamResult> {
  const sb = getClient();
  const ws = useAppStore.getState().cloud.workspaceId;
  if (!sb || !ws) return { ok: false, error: 'not_signed_in' };
  const { error } = await sb.from('workspace_members').update({ role }).eq('workspace_id', ws).eq('user_id', userId);
  if (error) return { ok: false, error: errCode(error.message) };
  await refreshMembers(sb, ws);
  return { ok: true, value: undefined };
}

export async function removeMember(userId: string): Promise<TeamResult> {
  const sb = getClient();
  const ws = useAppStore.getState().cloud.workspaceId;
  if (!sb || !ws) return { ok: false, error: 'not_signed_in' };
  const { error } = await sb.from('workspace_members').delete().eq('workspace_id', ws).eq('user_id', userId);
  if (error) return { ok: false, error: errCode(error.message) };
  await refreshMembers(sb, ws);
  return { ok: true, value: undefined };
}

export async function loadMembers(): Promise<void> {
  const sb = getClient();
  const ws = useAppStore.getState().cloud.workspaceId;
  if (sb && ws) await refreshMembers(sb, ws);
}
