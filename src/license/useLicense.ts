import { useEffect, useState } from 'react';
import { isCloudConfigured } from '../cloud/config';
import { useAppStore } from '../store/useAppStore';
import { canWriteWithLicense, licenseState, type LicenseState } from './license';

/** Current licence state; re-evaluated every minute so the trial ends on time without a restart. */
export function useLicense(): { state: LicenseState; canWrite: boolean } {
  const server = useAppStore((s) => s.cloud.license);
  const localStart = useAppStore((s) => s.profile?.createdAt ?? null);
  const demo = useAppStore((s) => !!s.settings.demo);
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);
  const state = licenseState({ cloudConfigured: isCloudConfigured() && !demo, server, localStart, now });
  return { state, canWrite: canWriteWithLicense(state) };
}
