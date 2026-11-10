import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '../store/useAppStore';
import { cancelAllReminders, rescheduleReminders } from './scheduler';

/** Keeps scheduled reminders in sync with the data and language while reminders are on. */
export function useReminders() {
  const { t, i18n } = useTranslation();
  const on = useAppStore((s) => s.reminders);
  const events = useAppStore((s) => s.events);
  const records = useAppStore((s) => s.records);
  const contracts = useAppStore((s) => s.contracts);
  const docs = useAppStore((s) => s.docs);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (on) rescheduleReminders({ events, records, contracts, docs }, t).catch(() => {});
      else cancelAllReminders().catch(() => {});
    }, 1500);
    return () => clearTimeout(timer);
  }, [on, events, records, contracts, docs, t, i18n.language]);
}
