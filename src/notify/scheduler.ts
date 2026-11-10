import type { TFunction } from 'i18next';
import { Platform } from 'react-native';
import { planReminders } from './plan';

// Local notifications only (no push server). Re-planned from scratch on every data change,
// so edits and deletions are always reflected.

type N = typeof import('expo-notifications');
let mod: N | null | undefined;
async function load(): Promise<N | null> {
  if (Platform.OS === 'web') return null;
  if (mod !== undefined) return mod;
  try {
    mod = await import('expo-notifications');
    mod.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
  } catch {
    mod = null;
  }
  return mod;
}

export async function requestReminderPermission(): Promise<boolean> {
  const n = await load();
  if (!n) return false;
  if (Platform.OS === 'android') {
    await n.setNotificationChannelAsync('reminders', { name: 'Reminders', importance: n.AndroidImportance.HIGH });
  }
  const cur = await n.getPermissionsAsync();
  if (cur.granted) return true;
  const req = await n.requestPermissionsAsync();
  return req.granted;
}

export async function cancelAllReminders(): Promise<void> {
  const n = await load();
  if (n) await n.cancelAllScheduledNotificationsAsync();
}

export async function rescheduleReminders(
  data: Parameters<typeof planReminders>[0],
  t: TFunction,
): Promise<number> {
  const n = await load();
  if (!n) return 0;
  await n.cancelAllScheduledNotificationsAsync();
  const plan = planReminders(data, new Date());
  for (const r of plan) {
    const [d, time] = r.at.split('T');
    const [y, m, day] = d.split('-').map(Number);
    const [hh, mm] = time.split(':').map(Number);
    await n.scheduleNotificationAsync({
      identifier: r.id,
      content: { title: 'VIBE OS', body: t(r.key, r.params) },
      trigger: { type: n.SchedulableTriggerInputTypes.DATE, date: new Date(y, m - 1, day, hh, mm), channelId: 'reminders' },
    });
  }
  return plan.length;
}
