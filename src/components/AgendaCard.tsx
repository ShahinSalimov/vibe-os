import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { Agenda, AgendaItem } from '../lib/agenda';
import { formatDate, formatMoney } from '../lib/format';
import type { Language } from '../lib/types';
import type { RootStackParamList } from '../navigation/types';
import { colors, radius, space, themed } from '../theme/tokens';
import { EVENT_ICONS } from './rows';
import { Card, T, tap, type IconName } from './ui';

type Nav = NativeStackNavigationProp<RootStackParamList>;

/** Today's full plan: events with times, tasks (tickable), payments, contracts, bookings, documents. */
export function AgendaCard({
  agenda,
  today,
  weekCount,
  laterTasks,
  awaitingSignature,
  docsLater,
  canTick,
  onTick,
}: {
  agenda: Agenda;
  today: string;
  weekCount: number;
  /** Open tasks for me with a later or no due date. */
  laterTasks: number;
  /** Contracts sent/drafted with a future sign-by date. */
  awaitingSignature: number;
  /** Documents expiring in 31-60 days. */
  docsLater: number;
  canTick: (taskId: string) => boolean;
  onTick: (taskId: string) => void;
}) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language as Language;
  const nav = useNavigation<Nav>();
  const money = (n: number, c: Parameters<typeof formatMoney>[1]) => formatMoney(n, c, lang);

  const row = (x: AgendaItem) => {
    switch (x.kind) {
      case 'event': {
        const e = x.event;
        const place = [e.venue, e.city].filter(Boolean).join(', ');
        return (
          <Line
            key={x.id}
            time={e.time || '—'}
            icon={EVENT_ICONS[e.type]}
            color={colors.gold}
            title={e.title}
            // the type is already shown by the icon (and usually the title): keep the line for place and money
            sub={[place || t(`events.types.${e.type}`), x.balance > 0 ? `${t('events.balanceDue')}: ${money(x.balance, e.currency)}` : '']
              .filter(Boolean)
              .join(' · ')}
            onPress={() => nav.navigate('EventForm', { id: e.id })}
          />
        );
      }
      case 'task': {
        const tickable = canTick(x.task.id);
        return (
          <Line
            key={x.id}
            icon={x.task.done ? 'checkmark-circle' : 'ellipse-outline'}
            color={colors.success}
            title={x.task.title}
            sub={x.overdue ? t('agenda.overdue') : t('agenda.dueToday')}
            subColor={x.overdue ? colors.danger : undefined}
            onIcon={tickable ? () => onTick(x.task.id) : undefined}
            onPress={() => nav.navigate('Tasks')}
          />
        );
      }
      case 'payment':
        return (
          <Line
            key={x.id}
            icon="cash"
            color={x.overdue ? colors.danger : colors.success}
            title={t('agenda.payment', { name: x.record.counterparty })}
            sub={[t('agenda.left', { amount: money(x.left, x.record.currency) }), x.overdue ? t('agenda.overdue') : t('agenda.dueToday')].join(' · ')}
            subColor={x.overdue ? colors.danger : undefined}
            onPress={() => nav.navigate('RecordForm', { id: x.record.id })}
          />
        );
      case 'contract':
        return (
          <Line
            key={x.id}
            icon="document-text"
            color={colors.violet}
            title={t('agenda.sign', { title: x.contract.title })}
            sub={x.overdue ? t('contracts.overdue') : t('contracts.deadlineToday')}
            subColor={x.overdue ? colors.danger : undefined}
            onPress={() => nav.navigate('Contract', { id: x.contract.id })}
          />
        );
      case 'bookings':
        return (
          <Line
            key={x.id}
            icon="mail-unread"
            color={colors.gold}
            title={t('home.briefingBookings', { count: x.count })}
            onPress={() => nav.navigate('Tabs', { screen: 'Bookings' } as never)}
          />
        );
      case 'document':
        return (
          <Line
            key={x.id}
            icon="globe"
            color={colors.warning}
            title={x.doc.title}
            sub={x.days < 0 ? t('personal.expired') : t('personal.expiresIn', { count: x.days })}
            subColor={x.days < 0 ? colors.danger : colors.warning}
            onPress={() => nav.navigate('PersonalDoc', { id: x.doc.id })}
          />
        );
    }
  };

  return (
    <Card style={styles.card}>
      <View style={styles.head}>
        <Ionicons name="sparkles" size={18} color={colors.gold} />
        <T variant="label" color={colors.gold}>
          {t('agenda.title', { date: formatDate(today, lang, false) })}
        </T>
      </View>

      {agenda.items.length === 0 ? <T>{t('home.briefingEmpty')}</T> : <View style={{ gap: space.xs }}>{agenda.items.map(row)}</View>}

      {agenda.tomorrow.length || weekCount || laterTasks || awaitingSignature || docsLater ? <View style={styles.divider} /> : null}
      {awaitingSignature ? (
        <Pressable onPress={() => nav.navigate('Documents', { tab: 'contracts' })} style={styles.footer}>
          <T variant="caption" color={colors.violet}>
            {t('home.briefingContracts', { count: awaitingSignature })}
          </T>
        </Pressable>
      ) : null}
      {docsLater ? (
        <Pressable onPress={() => nav.navigate('Documents', { tab: 'personal' })} style={styles.footer}>
          <T variant="caption" color={colors.warning}>
            {t('home.briefingDocs', { count: docsLater })}
          </T>
        </Pressable>
      ) : null}
      {laterTasks ? (
        <Pressable onPress={() => nav.navigate('Tasks')} style={styles.footer}>
          <T variant="caption" color={colors.success}>
            {t('home.briefingTasks', { count: laterTasks })}
          </T>
        </Pressable>
      ) : null}
      {agenda.tomorrow.length ? (
        <Pressable onPress={() => nav.navigate('Tabs', { screen: 'Events' } as never)} style={styles.footer}>
          <T variant="caption" color={colors.textMuted}>
            {t('agenda.tomorrow')}:{' '}
            <T variant="caption" color={colors.text}>
              {agenda.tomorrow.map((e) => [e.time, e.title].filter(Boolean).join(' ')).join(' · ')}
            </T>
          </T>
        </Pressable>
      ) : null}
      {weekCount ? (
        <T variant="caption" color={colors.textMuted}>
          {t('home.briefingEventsWeek', { count: weekCount })}
        </T>
      ) : null}
    </Card>
  );
}

function Line({
  time,
  icon,
  color,
  title,
  sub,
  subColor,
  onPress,
  onIcon,
}: {
  time?: string;
  icon: IconName;
  color: string;
  title: string;
  sub?: string;
  subColor?: string;
  onPress: () => void;
  onIcon?: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => {
        tap();
        onPress();
      }}
      style={({ pressed }) => [styles.line, pressed && { opacity: 0.75 }]}
    >
      {time !== undefined ? (
        <T variant="bodyLg" color={colors.gold} style={styles.time}>
          {time}
        </T>
      ) : null}
      <Pressable
        accessibilityRole={onIcon ? 'checkbox' : undefined}
        disabled={!onIcon}
        onPress={() => {
          tap();
          onIcon?.();
        }}
        hitSlop={8}
        style={[styles.icon, { backgroundColor: color + '22' }]}
      >
        <Ionicons name={icon} size={18} color={color} />
      </Pressable>
      <View style={{ flex: 1 }}>
        <T variant="bodyLg" numberOfLines={1}>
          {title}
        </T>
        {sub ? (
          <T variant="caption" color={subColor} numberOfLines={1}>
            {sub}
          </T>
        ) : null}
      </View>
      <Ionicons name="chevron-forward" size={16} color={colors.textFaint} />
    </Pressable>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    card: { backgroundColor: colors.surfaceAlt, borderColor: colors.gold + '55' },
    head: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
    line: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 48, borderRadius: radius.sm },
    time: { width: 52, fontVariant: ['tabular-nums'] },
    icon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
    divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
    footer: { paddingVertical: 2 },
  }),
);
