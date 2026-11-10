import { useAppStore } from '../store/useAppStore';
import { useLicense } from '../license/useLicense';
import { canRead, canWrite, effectiveRole, type Area, type MemberRole } from './permissions';

/** Current user's role and permission helpers for the UI. */
export function useRole(): { role: MemberRole; read: (a: Area) => boolean; write: (a: Area) => boolean; inTeam: boolean } {
  const cloudRole = useAppStore((s) => s.cloud.role);
  const ws = useAppStore((s) => s.cloud.workspaceId);
  const role = effectiveRole(cloudRole, ws);
  const licensed = useLicense().canWrite;
  // Writing needs both the role and a valid licence (trial or activated).
  return { role, read: (a) => canRead(role, a), write: (a) => licensed && canWrite(role, a), inTeam: !!ws };
}
