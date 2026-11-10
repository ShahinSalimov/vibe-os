import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { mailtoUrl, telUrl, whatsappUrl } from '../lib/contactLinks';
import { formatDate, formatMoney } from '../lib/format';
import type { BookingRequest, BookingStatus, Language } from '../lib/types';
import { colors, radius, space } from '../theme/tokens';
import { EVENT_ICONS } from './rows';
import { T, tap, type IconName } from './ui';

export const BOOKING_STATUS_COLORS: Record<BookingStatus, { fg: string; bg: string }> = {
  new: { fg: colors.gold, bg: colors.goldSoft },
  negotiating: { fg: colors.violet, bg: colors.violetSoft },
  confirmed: { fg: colors.success, bg: colors.successSoft },
  declined: { fg: colors.textFaint, bg: colors.surfaceAlt },
};

export function StatusPill({ status }: { status: BookingStatus }) {
  const { t } = useTranslation();
  const c = BOOKING_STATUS_COLORS[status];
  return (
    <View style={[styles.pill, { backgroundColor: c.bg }]}>
      <T variant="caption" color={c.fg}>
        {t(`bookings.status.${status}`)}
      </T>
    </View>
  );
}

export function BookingRow({ booking, onPress }: { booking: BookingRequest; onPress: () => void }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language as Language;
  const b = booking;
  const meta = [
    t(`events.types.${b.eventType}`),
    formatDate(b.date, lang),
    b.city,
    b.guests ? t('bookings.guests', { count: b.guests }) : '',
  ].filter(Boolean);
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => {
        tap();
        onPress();
      }}
      style={({ pressed }) => [styles.row, b.status === 'new' && styles.rowNew, pressed && { opacity: 0.8 }]}
    >
      <View style={styles.icon}>
        <Ionicons name={EVENT_ICONS[b.eventType]} size={22} color={colors.violet} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <View style={styles.titleLine}>
          <T variant="bodyLg" numberOfLines={1} style={{ flex: 1 }}>
            {b.organizerName}
          </T>
          <StatusPill status={b.status} />
        </View>
        <T variant="caption" numberOfLines={1}>
          {meta.join(' · ')}
        </T>
        <View style={styles.titleLine}>
          {b.budget ? (
            <T variant="caption" color={colors.gold}>
              {formatMoney(b.budget, b.currency, lang)}
            </T>
          ) : null}
          <T variant="caption" color={colors.textFaint}>
            {b.source === 'link' ? t('bookings.viaLink') : t('bookings.manual')}
          </T>
        </View>
      </View>
    </Pressable>
  );
}

/** Call / WhatsApp / Email buttons. Only shows what the data allows. */
export function ContactActions({ phone, email, message }: { phone: string; email: string; message?: string }) {
  const { t } = useTranslation();
  const actions: { key: string; icon: IconName; label: string; url: string | null; color: string }[] = [
    { key: 'call', icon: 'call', label: t('bookings.call'), url: telUrl(phone), color: colors.success },
    { key: 'wa', icon: 'logo-whatsapp', label: t('bookings.whatsapp'), url: whatsappUrl(phone, message), color: '#25D366' },
    { key: 'mail', icon: 'mail', label: t('bookings.email'), url: mailtoUrl(email), color: colors.violet },
  ];
  const available = actions.filter((a) => a.url);
  if (!available.length) return null;
  return (
    <View style={styles.actions}>
      {available.map((a) => (
        <Pressable
          key={a.key}
          accessibilityRole="link"
          accessibilityLabel={a.label}
          onPress={() => {
            tap();
            Linking.openURL(a.url!).catch(() => {});
          }}
          style={({ pressed }) => [styles.action, pressed && { opacity: 0.8 }]}
        >
          <Ionicons name={a.icon} size={22} color={a.color} />
          <T variant="caption" color={colors.text}>
            {a.label}
          </T>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  pill: { paddingHorizontal: space.sm, paddingVertical: 2, borderRadius: radius.pill },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: space.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  rowNew: { borderColor: colors.gold + '88', borderWidth: 1 },
  icon: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.violetSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleLine: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  actions: { flexDirection: 'row', gap: space.sm },
  action: {
    flex: 1,
    minHeight: 64,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
});
