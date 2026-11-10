import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { outstanding } from '../lib/finance';
import { daysBetween, formatDate, formatMoney, MONTHS, parseISODate, toISODate } from '../lib/format';
import type { ArtistEvent, EventType, Language, MoneyRecord, TxStatus } from '../lib/types';
import { colors, radius, space, themed } from '../theme/tokens';
import { T, tap, type IconName } from './ui';

export const EVENT_ICONS: Record<EventType, IconName> = {
  concert: 'mic',
  wedding: 'heart',
  corporate: 'business',
  private: 'wine',
  restaurant: 'restaurant',
  tv: 'tv',
  festival: 'flag',
  rehearsal: 'repeat',
  studio: 'headset',
};

export const STATUS_COLORS: Record<TxStatus, { fg: string; bg: string }> = themed(() => ({
  planned: { fg: colors.violet, bg: colors.violetSoft },
  partial: { fg: colors.warning, bg: colors.goldSoft },
  paid: { fg: colors.success, bg: colors.successSoft },
  overdue: { fg: colors.danger, bg: colors.dangerSoft },
}));

export function useRelativeDay() {
  const { t } = useTranslation();
  return (date: string) => {
    const diff = daysBetween(toISODate(new Date()), date);
    if (diff === 0) return t('events.todayLabel');
    if (diff === 1) return t('events.tomorrow');
    if (diff > 1) return t('events.inDays', { count: diff });
    return null;
  };
}

export function EventRow({ event, onPress }: { event: ArtistEvent; onPress: () => void }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language as Language;
  const relative = useRelativeDay()(event.date);
  const due = Math.max(0, event.fee - event.advance);
  const place = [event.venue, event.city].filter(Boolean).join(', ');
  const { m, day } = parseISODate(event.date);

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => {
        tap();
        onPress();
      }}
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.8 }]}
    >
      <View style={styles.dateBox}>
        <T variant="title" color={colors.gold}>
          {day}
        </T>
        <T variant="caption" numberOfLines={1}>
          {MONTHS[lang].short[m]}
        </T>
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <View style={styles.titleLine}>
          <Ionicons name={EVENT_ICONS[event.type]} size={16} color={colors.violet} />
          <T variant="bodyLg" numberOfLines={1} style={{ flex: 1 }}>
            {event.title}
          </T>
        </View>
        <T variant="caption" numberOfLines={1}>
          {[t(`events.types.${event.type}`), event.time, place].filter(Boolean).join(' · ')}
        </T>
        {event.fee > 0 ? (
          <T variant="caption" color={due > 0 ? colors.warning : colors.success}>
            {due > 0
              ? `${t('events.balanceDue')}: ${formatMoney(due, event.currency, lang)}`
              : t('events.fullyPaid')}
          </T>
        ) : null}
      </View>
      {relative ? (
        <View style={styles.pill}>
          <T variant="caption" color={colors.gold}>
            {relative}
          </T>
        </View>
      ) : null}
    </Pressable>
  );
}

export function RecordRow({ record, onPress }: { record: MoneyRecord; onPress: () => void }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language as Language;
  const isIncome = record.kind === 'income';
  const left = outstanding(record);
  const sc = STATUS_COLORS[record.status];
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => {
        tap();
        onPress();
      }}
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.8 }]}
    >
      <View style={[styles.kindIcon, { backgroundColor: isIncome ? colors.successSoft : colors.dangerSoft }]}>
        <Ionicons
          name={isIncome ? 'arrow-down' : 'arrow-up'}
          size={20}
          color={isIncome ? colors.success : colors.danger}
        />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <T variant="bodyLg" numberOfLines={1}>
          {record.counterparty}
        </T>
        <T variant="caption" numberOfLines={1}>
          {[formatDate(record.date, lang), record.category].filter(Boolean).join(' · ')}
        </T>
        <View style={[styles.status, { backgroundColor: sc.bg }]}>
          <T variant="caption" color={sc.fg}>
            {t(`money.status.${record.status}`)}
            {left > 0 && record.status !== 'planned'
              ? ` · ${t('money.remaining', { amount: formatMoney(left, record.currency, lang) })}`
              : ''}
          </T>
        </View>
      </View>
      <T variant="bodyLg" color={isIncome ? colors.success : colors.text}>
        {(isIncome ? '+' : '−') + formatMoney(record.amount, record.currency, lang)}
      </T>
    </Pressable>
  );
}

const styles = themed(() =>
  StyleSheet.create({
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
  dateBox: {
    width: 56,
    height: 60,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleLine: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  pill: {
    backgroundColor: colors.goldSoft,
    paddingHorizontal: space.sm,
    paddingVertical: 4,
    borderRadius: radius.pill,
    alignSelf: 'flex-start',
  },
  kindIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  status: {
    alignSelf: 'flex-start',
    paddingHorizontal: space.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
    marginTop: 2,
  },
  }),
);
