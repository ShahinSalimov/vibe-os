import { useEffect } from 'react';
import { AppState } from 'react-native';
import { useAppStore } from '../store/useAppStore';
import { isCloudConfigured } from './config';
import { syncNow } from './sync';

const DEBOUNCE_MS = 3000;

/**
 * Background sync while signed in: on app start, when the app returns to the
 * foreground, and a few seconds after any local change. Failures are silent here
 * (offline is normal); the Account screen shows errors on manual sync.
 */
export function useAutoSync() {
  useEffect(() => {
    if (!isCloudConfigured()) return;
    const signedIn = () => !!useAppStore.getState().cloud.email;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const schedule = (delay = DEBOUNCE_MS) => {
      if (!signedIn()) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => void syncNow(), delay);
    };

    schedule(500);
    const appSub = AppState.addEventListener('change', (s) => s === 'active' && schedule(500));
    const unsub = useAppStore.subscribe((s, prev) => {
      if (
        s.events !== prev.events ||
        s.records !== prev.records ||
        s.bookings !== prev.bookings ||
        s.contacts !== prev.contacts ||
        s.songs !== prev.songs ||
        s.setlists !== prev.setlists ||
        s.contracts !== prev.contracts ||
        s.riders !== prev.riders ||
        s.tasks !== prev.tasks ||
        s.tombstones !== prev.tombstones
      ) {
        schedule();
      }
    });
    return () => {
      if (timer) clearTimeout(timer);
      appSub.remove();
      unsub();
    };
  }, []);
}
