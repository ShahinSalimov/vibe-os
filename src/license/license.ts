// Licence state shown in the app. The server is the authority (see 0005_license.sql);
// this mirrors it so the UI can lock writes and show the right message.

export const TRIAL_DAYS = 3;

export interface ServerLicense {
  status: 'trial' | 'active' | 'suspended';
  trialEndsAt: string; // ISO
  activatedAt: string | null;
}

export type LicenseState =
  | { kind: 'active' }
  | { kind: 'trial'; endsAt: string; daysLeft: number; hoursLeft: number }
  | { kind: 'expired'; endsAt: string }
  | { kind: 'suspended' }
  | { kind: 'unlimited' }; // builds without a cloud (development / private use)

/**
 * @param cloudConfigured licensing only applies to builds connected to the VIBE OS cloud
 * @param server licence from the server when signed in (null before the first sync)
 * @param localStart when this phone started using the app (profile.createdAt) — local trial before sign-in
 */
export function licenseState(input: {
  cloudConfigured: boolean;
  server: ServerLicense | null;
  localStart: string | null;
  now: Date;
}): LicenseState {
  if (!input.cloudConfigured) return { kind: 'unlimited' };
  const s = input.server;
  if (s?.status === 'active') return { kind: 'active' };
  if (s?.status === 'suspended') return { kind: 'suspended' };
  const endsAt = s?.trialEndsAt ?? (input.localStart ? new Date(Date.parse(input.localStart) + TRIAL_DAYS * 86400000).toISOString() : null);
  if (!endsAt) return { kind: 'trial', endsAt: new Date(input.now.getTime() + TRIAL_DAYS * 86400000).toISOString(), daysLeft: TRIAL_DAYS, hoursLeft: TRIAL_DAYS * 24 };
  const ms = Date.parse(endsAt) - input.now.getTime();
  if (ms <= 0) return { kind: 'expired', endsAt };
  return { kind: 'trial', endsAt, daysLeft: Math.ceil(ms / 86400000), hoursLeft: Math.ceil(ms / 3600000) };
}

export const canWriteWithLicense = (s: LicenseState) => s.kind === 'active' || s.kind === 'trial' || s.kind === 'unlimited';

/** "abcd ef-gh1234 5678" -> "ABCD-EFGH-2345"-style display; returns cleaned 12 chars or null. */
export function cleanLicenseCode(input: string): string | null {
  const c = input.toUpperCase().replace(/[^A-Z0-9]/g, '');
  return /^[A-HJ-NP-Z2-9]{12}$/.test(c) ? c : null;
}
export function formatLicenseCode(code: string): string {
  const c = code.toUpperCase().replace(/[^A-Z0-9]/g, '');
  return c.match(/.{1,4}/g)?.join('-') ?? c;
}
