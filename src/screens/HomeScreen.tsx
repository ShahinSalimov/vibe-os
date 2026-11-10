import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Avatar } from '../components/Avatar';
import { EventRow } from '../components/rows';
import { Card, Screen, SectionHeader, T, tap, type IconName } from '../components/ui';
import { parseVoice } from '../lib/voiceParse';
import { daysUntil } from '../notify/plan';
import { useLicense } from '../license/useLicense';
import { useRole } from '../team/useRole';
import { VoiceSheet } from '../voice/VoiceSheet';
import { monthRange, summarize } from '../lib/finance';
import { daysBetween, formatMoney, MONTHS, toISODate } from '../lib/format';
import type { Language } from '../lib/types';
import type { RootStackParamList } from '../navigation/types';
import { useAppStore } from '../store/useAppStore';
import { colors, radius, space, themed } from '../theme/tokens';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function HomeScreen() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language as Language;
  const nav = useNavigation<Nav>();
  const profile = useAppStore((s) => s.profile);
  const currency = useAppStore((s) => s.settings.currency);
  const events = useAppStore((s) => s.events);
  const records = useAppStore((s) => s.records);
  const newBookings = useAppStore((s) => s.bookings.filter((b) => b.status === 'new').length);
  const pendingContracts = useAppStore((s) => s.contracts.filter((c) => c.status === 'sent' || (c.status === 'draft' && c.deadline)).length);
  const expiringDocs = useAppStore((s) => s.docs);

  const { read, write } = useRole();
  const lic = useLicense().state;
  const myId = useAppStore((s) => s.cloud.userId);
  const myTasks = useAppStore((s) => s.tasks.filter((x) => !x.done && (!!myId && x.assigneeId === myId)).length);
  const today = toISODate(new Date());
  const [voiceOpen, setVoiceOpen] = useState(false);
  const onVoice = (text: string) => {
    setVoiceOpen(false);
    const draft = parseVoice(text, today);
    if (draft.kind === 'event') nav.navigate('EventForm', { draft });
    else nav.navigate('RecordForm', { kind: draft.kind, draft });
  };
  const hour = new Date().getHours();
  const greeting = hour < 12 ? t('home.morning') : hour < 18 ? t('home.afternoon') : t('home.evening');

  const upcoming = useMemo(
    () =>
      events
        .filter((e) => e.date >= today)
        .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))
        .slice(0, 3),
    [events, today],
  );

  const briefing = useMemo(() => {
    const todayCount = events.filter((e) => e.date === today).length;
    const weekCount = events.filter((e) => {
      const d = daysBetween(today, e.date);
      return d > 0 && d <= 7;
    }).length;
    const overdue = records.filter((r) => r.status === 'overdue').length;
    const lines: { icon: IconName; text: string; color: string; onPress?: () => void }[] = [];
    if (myTasks)
      lines.push({
        icon: 'checkbox',
        text: t('home.briefingTasks', { count: myTasks }),
        color: colors.success,
        onPress: () => nav.navigate('Tasks'),
      });
    if (newBookings && read('bookings'))
      lines.push({
        icon: 'mail-unread',
        text: t('home.briefingBookings', { count: newBookings }),
        color: colors.gold,
        onPress: () => nav.navigate('Tabs', { screen: 'Bookings' } as never),
      });
    if (todayCount) lines.push({ icon: 'flash', text: t('home.briefingEventsToday', { count: todayCount }), color: colors.gold });
    if (weekCount) lines.push({ icon: 'calendar', text: t('home.briefingEventsWeek', { count: weekCount }), color: colors.violet });
    const docsSoon = expiringDocs.filter((d) => d.expiry && daysUntil(d.expiry, today) <= 60).length;
    if (pendingContracts && read('contracts'))
      lines.push({
        icon: 'document-text',
        text: t('home.briefingContracts', { count: pendingContracts }),
        color: colors.violet,
        onPress: () => nav.navigate('Documents', { tab: 'contracts' }),
      });
    if (docsSoon)
      lines.push({
        icon: 'globe',
        text: t('home.briefingDocs', { count: docsSoon }),
        color: colors.warning,
        onPress: () => nav.navigate('Documents', { tab: 'personal' }),
      });
    if (overdue && read('money')) lines.push({ icon: 'alert-circle', text: t('home.briefingOverdue', { count: overdue }), color: colors.danger });
    return lines;
  }, [events, records, today, t, newBookings, nav, pendingContracts, expiringDocs, myTasks, read]);

  const sum = useMemo(() => summarize(records, currency, monthRange(today)), [records, currency, today]);
  const month = MONTHS[lang].nom[new Date().getMonth()];

  return (
    <Screen>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <T variant="caption">{greeting},</T>
          <T variant="h1" numberOfLines={1}>
            {profile?.stageName}
          </T>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel={t('more.profile')} onPress={() => nav.navigate('Tabs', { screen: 'More' } as never)}>
          <Avatar name={profile?.stageName} uri={profile?.photoUri} size={48} />
        </Pressable>
      </View>

      {lic.kind === 'trial' || lic.kind === 'expired' || lic.kind === 'suspended' ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            tap();
            nav.navigate('License');
          }}
          style={[styles.licence, lic.kind !== 'trial' && { backgroundColor: colors.dangerSoft, borderColor: colors.danger + '55' }]}
        >
          <Ionicons name={lic.kind === 'trial' ? 'hourglass' : 'lock-closed'} size={18} color={lic.kind === 'trial' ? colors.gold : colors.danger} />
          <T variant="bodyLg" style={{ flex: 1 }}>
            {lic.kind === 'trial'
              ? lic.daysLeft > 1
                ? t('license.trialDays', { count: lic.daysLeft })
                : t('license.trialHours', { count: lic.hoursLeft })
              : lic.kind === 'expired'
                ? t('license.expiredTitle')
                : t('license.suspendedTitle')}
          </T>
          <T variant="caption" color={colors.gold}>
            {t('license.activate')}
          </T>
        </Pressable>
      ) : null}

      {/* Daily briefing */}
      <Card style={styles.briefing}>
        <View style={styles.rowCenter}>
          <Ionicons name="sparkles" size={18} color={colors.gold} />
          <T variant="label" color={colors.gold}>
            {t('home.briefingTitle')}
          </T>
        </View>
        {briefing.length === 0 ? (
          <T>{t('home.briefingEmpty')}</T>
        ) : (
          briefing.map((b) => (
            <Pressable key={b.text} style={styles.rowCenter} onPress={b.onPress} disabled={!b.onPress}>
              <Ionicons name={b.icon} size={18} color={b.color} />
              <T variant="bodyLg" style={{ flex: 1 }}>
                {b.text}
              </T>
              {b.onPress ? <Ionicons name="chevron-forward" size={18} color={colors.textFaint} /> : null}
            </Pressable>
          ))
        )}
      </Card>

      {/* Voice: one sentence -> pre-filled form */}
      {write('events') ? (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('voice.addByVoice')}
        onPress={() => {
          tap();
          setVoiceOpen(true);
        }}
        style={({ pressed }) => [styles.voice, pressed && { opacity: 0.85 }]}
      >
        <View style={styles.voiceMic}>
          <Ionicons name="mic" size={26} color={colors.gold} />
        </View>
        <View style={{ flex: 1 }}>
          <T variant="bodyLg" color={colors.onGold}>
            {t('voice.addByVoice')}
          </T>
          <T variant="caption" color={colors.onGold}>
            {t('voice.addByVoiceBody')}
          </T>
        </View>
      </Pressable>
      ) : null}
      <VoiceSheet visible={voiceOpen} mode="command" onClose={() => setVoiceOpen(false)} onResult={onVoice} />

      {/* Quick add */}
      {write('events') ? (
        <View style={styles.quickRow}>
          <QuickAction icon="calendar" label={t('home.addEvent')} onPress={() => nav.navigate('EventForm')} />
          {write('money') ? (
            <>
              <QuickAction
                icon="arrow-down"
                label={t('home.addIncome')}
                color={colors.success}
                onPress={() => nav.navigate('RecordForm', { kind: 'income' })}
              />
              <QuickAction
                icon="arrow-up"
                label={t('home.addExpense')}
                color={colors.danger}
                onPress={() => nav.navigate('RecordForm', { kind: 'expense' })}
              />
            </>
          ) : null}
        </View>
      ) : null}

      {/* Month summary */}
      {read('money') ? (
      <Card>
        <T variant="label">
          {t('home.thisMonth')} · {month}
        </T>
        <T variant="display" color={sum.net >= 0 ? colors.text : colors.danger}>
          {formatMoney(sum.net, currency, lang)}
        </T>
        <View style={styles.statsRow}>
          <Stat label={t('home.income')} value={formatMoney(sum.income, currency, lang)} color={colors.success} />
          <Stat label={t('home.expenses')} value={formatMoney(sum.expense, currency, lang)} color={colors.danger} />
        </View>
        <View style={styles.divider} />
        <View style={styles.statsRow}>
          <Stat label={t('home.owedToYou')} value={formatMoney(sum.owedToYou, currency, lang)} color={colors.gold} />
          <Stat label={t('home.youOwe')} value={formatMoney(sum.youOwe, currency, lang)} color={colors.textMuted} />
        </View>
        <T variant="caption" color={colors.textFaint}>
          {t('home.otherCurrencies', { currency })}
        </T>
      </Card>
      ) : null}

      <SectionHeader
        title={t('home.upcoming')}
        action={upcoming.length ? t('common.seeAll') : undefined}
        onAction={() => nav.navigate('Tabs', { screen: 'Events' } as never)}
      />
      {upcoming.length === 0 ? (
        <T color={colors.textMuted}>{t('home.noUpcoming')}</T>
      ) : (
        upcoming.map((e) => <EventRow key={e.id} event={e} onPress={() => nav.navigate('EventForm', { id: e.id })} />)
      )}
    </Screen>
  );
}

function QuickAction({
  icon,
  label,
  onPress,
  color = colors.gold,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  color?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={() => {
        tap();
        onPress();
      }}
      style={({ pressed }) => [styles.quick, pressed && { opacity: 0.8 }]}
    >
      <View style={[styles.quickIcon, { backgroundColor: color + '22' }]}>
        <Ionicons name={icon} size={22} color={color} />
      </View>
      <T variant="caption" color={colors.text} numberOfLines={1}>
        {label}
      </T>
    </Pressable>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={{ flex: 1, gap: 2 }}>
      <T variant="caption">{label}</T>
      <T variant="bodyLg" color={color} numberOfLines={1}>
        {value}
      </T>
    </View>
  );
}

const styles = themed(() =>
  StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  briefing: { backgroundColor: colors.surfaceAlt, borderColor: colors.gold + '55' },
  rowCenter: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  quickRow: { flexDirection: 'row', gap: space.md },
  licence: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    padding: space.md,
    borderRadius: radius.md,
    backgroundColor: colors.goldSoft,
    borderWidth: 1,
    borderColor: colors.gold + '55',
  },
  voice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: colors.gold,
    borderRadius: radius.lg,
    padding: space.md,
  },
  voiceMic: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.onGold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quick: {
    flex: 1,
    alignItems: 'center',
    gap: space.sm,
    paddingVertical: space.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  quickIcon: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  statsRow: { flexDirection: 'row', gap: space.md },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
  }),
);
