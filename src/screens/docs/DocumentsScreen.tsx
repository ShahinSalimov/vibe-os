import { Ionicons } from '@expo/vector-icons';
import React, { useLayoutEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useRole } from '../../team/useRole';
import { Banner, Button, Card, EmptyState, IconButton, Screen, Segmented, T, tap, type IconName } from '../../components/ui';
import { formatDate, formatMoney, toISODate } from '../../lib/format';
import type { ContractStatus, Language, PersonalDocKind, RiderKind } from '../../lib/types';
import type { RootProps } from '../../navigation/types';
import { daysUntil } from '../../notify/plan';
import { useAppStore } from '../../store/useAppStore';
import { colors, radius, space } from '../../theme/tokens';

export const CONTRACT_STATUS_COLORS: Record<ContractStatus, { fg: string; bg: string }> = {
  draft: { fg: colors.textMuted, bg: colors.surfaceAlt },
  sent: { fg: colors.violet, bg: colors.violetSoft },
  signed: { fg: colors.success, bg: colors.successSoft },
  cancelled: { fg: colors.textFaint, bg: colors.surfaceAlt },
};

export const DOC_ICONS: Record<PersonalDocKind, IconName> = {
  passport: 'globe',
  visa: 'airplane',
  id: 'id-card',
  license: 'car',
  other: 'document',
};

type Tab = 'contracts' | 'riders' | 'personal';

export default function DocumentsScreen({ route, navigation }: RootProps<'Documents'>) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language as Language;
  const { read, write } = useRole();
  const [tab, setTab] = useState<Tab>(route.params?.tab ?? (read('contracts') ? 'contracts' : 'riders'));
  const contracts = useAppStore((s) => s.contracts);
  const riders = useAppStore((s) => s.riders);
  const docs = useAppStore((s) => s.docs);
  const events = useAppStore((s) => s.events);
  const today = toISODate(new Date());

  useLayoutEffect(() => {
    navigation.setOptions({
      title: t('docs.title'),
      headerRight: () =>
        tab === 'riders' || (tab === 'contracts' && !write('contracts')) ? null : (
          <IconButton
            icon="add"
            color={colors.gold}
            label={tab === 'contracts' ? t('contracts.new') : t('personal.new')}
            onPress={() => (tab === 'contracts' ? navigation.navigate('Contract') : navigation.navigate('PersonalDoc'))}
          />
        ),
    });
  }, [navigation, t, tab, write]);

  return (
    <Screen edges={['bottom']}>
      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          ...(read('contracts') ? [{ value: 'contracts' as const, label: t('docs.contracts') }] : []),
          { value: 'riders' as const, label: t('docs.riders') },
          { value: 'personal' as const, label: t('docs.personal') },
        ]}
      />

      {tab === 'contracts' ? (
        contracts.length === 0 ? (
          <EmptyState
            icon="document-text"
            title={t('contracts.empty')}
            body={t('contracts.emptyBody')}
            action={t('contracts.new')}
            onAction={() => navigation.navigate('Contract')}
          />
        ) : (
          <View style={{ gap: space.sm }}>
            {[...contracts]
              .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
              .map((c) => {
                const ev = c.eventId ? events.find((e) => e.id === c.eventId) : undefined;
                const sc = CONTRACT_STATUS_COLORS[c.status];
                const open = c.status === 'draft' || c.status === 'sent';
                const left = c.deadline ? daysUntil(c.deadline, today) : null;
                return (
                  <Row key={c.id} icon="document-text" onPress={() => navigation.navigate('Contract', { id: c.id })}>
                    <View style={styles.line}>
                      <T variant="bodyLg" numberOfLines={1} style={{ flex: 1 }}>
                        {c.title}
                      </T>
                      <Pill text={t(`contracts.status.${c.status}`)} fg={sc.fg} bg={sc.bg} />
                    </View>
                    <T variant="caption" numberOfLines={1}>
                      {[c.counterparty, c.amount ? formatMoney(c.amount, c.currency, lang) : '', ev ? formatDate(ev.date, lang) : '']
                        .filter(Boolean)
                        .join(' · ')}
                    </T>
                    {open && left !== null ? (
                      <T variant="caption" color={left < 0 ? colors.danger : left <= 3 ? colors.warning : colors.textMuted}>
                        {left < 0 ? t('contracts.overdue') : left === 0 ? t('contracts.deadlineToday') : t('contracts.deadlineIn', { count: left })}
                      </T>
                    ) : null}
                  </Row>
                );
              })}
          </View>
        )
      ) : tab === 'riders' ? (
        <View style={{ gap: space.md }}>
          {(['technical', 'hospitality'] as RiderKind[]).map((kind) => {
            const r = riders.find((x) => x.kind === kind);
            const count = r ? r.sections.reduce((n, s) => n + s.items.filter((i) => i.trim()).length, 0) : 0;
            return (
              <Card key={kind} style={{ gap: space.sm }}>
                <View style={styles.line}>
                  <Ionicons name={kind === 'technical' ? 'construct' : 'cafe'} size={22} color={colors.gold} />
                  <T variant="bodyLg" style={{ flex: 1 }}>
                    {t(`riders.${kind}`)}
                  </T>
                  {r ? <T variant="caption">{count}</T> : null}
                </View>
                {!r ? <T variant="caption">{t('riders.createBody')}</T> : null}
                <Button
                  label={r ? t('common.edit') : t('riders.create')}
                  icon={r ? 'create-outline' : 'add'}
                  variant={r ? 'secondary' : 'primary'}
                  onPress={() => navigation.navigate('Rider', { kind })}
                />
              </Card>
            );
          })}
        </View>
      ) : (
        <>
          <Banner icon="lock-closed" text={t('personal.privacy')} />
          {docs.length === 0 ? (
            <EmptyState
              icon="globe"
              title={t('personal.empty')}
              body={t('personal.emptyBody')}
              action={t('personal.new')}
              onAction={() => navigation.navigate('PersonalDoc')}
            />
          ) : (
            <View style={{ gap: space.sm }}>
              {[...docs]
                .sort((a, b) => (a.expiry || '9999').localeCompare(b.expiry || '9999'))
                .map((d) => {
                  const left = d.expiry ? daysUntil(d.expiry, today) : null;
                  return (
                    <Row key={d.id} icon={DOC_ICONS[d.kind]} onPress={() => navigation.navigate('PersonalDoc', { id: d.id })}>
                      <T variant="bodyLg" numberOfLines={1}>
                        {d.title}
                      </T>
                      <T variant="caption" numberOfLines={1}>
                        {[t(`personal.kinds.${d.kind}`), d.country, d.expiry ? formatDate(d.expiry, lang) : t('personal.noExpiry')]
                          .filter(Boolean)
                          .join(' · ')}
                      </T>
                      {left !== null ? (
                        <T variant="caption" color={left < 0 ? colors.danger : left <= 60 ? colors.warning : colors.success}>
                          {left < 0 ? t('personal.expired') : t('personal.expiresIn', { count: left })}
                        </T>
                      ) : null}
                    </Row>
                  );
                })}
            </View>
          )}
        </>
      )}
    </Screen>
  );
}

function Row({ icon, onPress, children }: { icon: IconName; onPress: () => void; children: React.ReactNode }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => {
        tap();
        onPress();
      }}
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.8 }]}
    >
      <View style={styles.icon}>
        <Ionicons name={icon} size={22} color={colors.violet} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>{children}</View>
      <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
    </Pressable>
  );
}

function Pill({ text, fg, bg }: { text: string; fg: string; bg: string }) {
  return (
    <View style={[styles.pill, { backgroundColor: bg }]}>
      <T variant="caption" color={fg}>
        {text}
      </T>
    </View>
  );
}

const styles = StyleSheet.create({
  line: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
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
  icon: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.violetSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pill: { paddingHorizontal: space.sm, paddingVertical: 2, borderRadius: radius.pill },
});
