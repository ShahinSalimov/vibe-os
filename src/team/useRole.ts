import { useAppStore } from '../store/useAppStore';
import { canRead, canWrite, effectiveRole, type Area, type MemberRole } from './permissions';

/** Current user's role and permission helpers for the UI. */
export function useRole(): { role: MemberRole; read: (a: Area) => boolean; write: (a: Area) => boolean; inTeam: boolean } {
  const cloudRole = useAppStore((s) => s.cloud.role);
  const ws = useAppStore((s) => s.cloud.workspaceId);
  const role = effectiveRole(cloudRole, ws);
  return { role, read: (a) => canRead(role, a), write: (a) => canWrite(role, a), inTeam: !!ws };
}
