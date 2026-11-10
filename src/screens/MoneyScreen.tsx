import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useRole } from '../team/useRole';
import { RecordRow } from '../components/rows';
import { Banner, Button, Card, EmptyState, Screen, Segmented, SectionHeader, T } from '../components/ui';
import { balancesByCounterparty } from '../lib/finance';
import { formatMoney } from '../lib/format';
import type { Language, TxKind } from '../lib/types';
import type { RootStackParamList } from '../navigation/types';
import { useAppStore } from '../store/useAppStore';
import { colors, space } from '../theme/tokens';

export default function MoneyScreen() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language as Language;
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const records = useAppStore((s) => s.records);
  const canAdd = useRole().write('money');
  const [filter, setFilter] = useState<'all' | TxKind>('all');

  const list = useMemo(
    () =>
      records
        .filter((r) => filter === 'all' || r.kind === filter)
        .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)),
    [records, filter],
  );
  const balances = useMemo(() => balancesByCounterparty(records).slice(0, 6), [records]);

  return (
    <Screen>
      <T variant="h1">{t('money.title')}</T>
      <Banner text={t('money.recordOnly')} />
      {canAdd ? (
      <View style={styles.actions}>
        <Button
          label={t('money.income')}
          icon="arrow-down"
          variant="secondary"
          style={{ flex: 1 }}
          onPress={() => nav.navigate('RecordForm', { kind: 'income' })}
        />
        <Button
          label={t('money.expense')}
          icon="arrow-up"
          variant="secondary"
          style={{ flex: 1 }}
          onPress={() => nav.navigate('RecordForm', { kind: 'expense' })}
        />
      </View>
      ) : null}

      {records.length === 0 ? (
        <EmptyState icon="wallet" title={t('money.empty')} body={t('money.emptyBody')} />
      ) : (
        <>
          <SectionHeader title={t('money.balances')} />
          <Card style={{ gap: space.sm }}>
            {balances.length === 0 ? (
              <T color={colors.textMuted}>{t('money.noBalances')}</T>
            ) : (
              balances.map((b) => (
                <View key={b.name + b.currency} style={styles.balanceRow}>
                  <T variant="bodyLg" numberOfLines={1} style={{ flex: 1 }}>
                    {b.name}
                  </T>
                  <View style={{ alignItems: 'flex-end' }}>
                    {b.owedToYou > 0 ? (
                      <T color={colors.success}>
                        {t('money.owesYou')} {formatMoney(b.owedToYou, b.currency, lang)}
                      </T>
                    ) : null}
                    {b.youOwe > 0 ? (
                      <T color={colors.danger}>
                        {t('money.youOweThem')} {formatMoney(b.youOwe, b.currency, lang)}
                      </T>
                    ) : null}
                  </View>
                </View>
              ))
            )}
          </Card>

          <Segmented
            value={filter}
            onChange={setFilter}
            options={[
              { value: 'all', label: t('money.all') },
              { value: 'income', label: t('money.income') },
              { value: 'expense', label: t('money.expense') },
            ]}
          />
          <View style={{ gap: space.sm }}>
            {list.map((r) => (
              <RecordRow key={r.id} record={r} onPress={() => nav.navigate('RecordForm', { id: r.id })} />
            ))}
          </View>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', gap: space.md },
  balanceRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 36 },
});
