import { cleanLicenseCode } from '../license/license';
import { useAppStore } from '../store/useAppStore';
import { getClient } from './client';
import { refreshLicense, syncNow } from './sync';

export type RedeemResult = { ok: true } | { ok: false; error: 'invalid' | 'code_not_found' | 'code_used' | 'not_owner' | 'not_signed_in' | 'network' | string };

/** Owner enters the code bought from the seller -> licence active forever. */
export async function redeemLicense(input: string): Promise<RedeemResult> {
  const code = cleanLicenseCode(input);
  if (!code) return { ok: false, error: 'invalid' };
  const sb = getClient();
  if (!sb) return { ok: false, error: 'not_signed_in' };
  // make sure the workspace exists on the server (first sign-in creates it)
  if (!useAppStore.getState().cloud.workspaceId) await syncNow();
  const ws = useAppStore.getState().cloud.workspaceId;
  if (!ws) return { ok: false, error: 'not_signed_in' };
  const { error } = await sb.rpc('redeem_license', { p_code: code, p_workspace: ws });
  if (error) {
    for (const k of ['code_not_found', 'code_used', 'not_owner']) if (error.message.includes(k)) return { ok: false, error: k };
    return { ok: false, error: /fetch|network/i.test(error.message) ? 'network' : error.message };
  }
  await refreshLicense(sb, ws);
  await syncNow(); // push anything entered during the trial
  return { ok: true };
}
