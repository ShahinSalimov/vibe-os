import React, { useLayoutEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useRole } from '../team/useRole';
import { DateField } from '../components/DateField';
import { STATUS_COLORS } from '../components/rows';
import { Banner, Button, Chips, Field, Screen, Segmented, T } from '../components/ui';
import { confirmAction, notify } from '../lib/confirm';
import { deriveStatus } from '../lib/finance';
import { currencySymbol, formatMoney, parseAmount, toISODate } from '../lib/format';
import { detectSensitiveIn } from '../lib/sensitive';
import { CURRENCIES, TX_STATUSES, type Currency, type Language, type TxKind, type TxStatus } from '../lib/types';
import type { RootProps } from '../navigation/types';
import { useAppStore } from '../store/useAppStore';
import { colors, space } from '../theme/tokens';

export default function RecordFormScreen({ route, navigation }: RootProps<'RecordForm'>) {
  const { t, i18n } = useTranslation();
  const ro = !useRole().write('money');
  const lang = i18n.language as Language;
  const id = route.params?.id;
  const records = useAppStore((s) => s.records);
  const events = useAppStore((s) => s.events);
  const defaultCurrency = useAppStore((s) => s.settings.currency);
  const saveRecord = useAppStore((s) => s.saveRecord);
  const deleteRecord = useAppStore((s) => s.deleteRecord);
  const existing = id ? records.find((r) => r.id === id) : undefined;
  const draft = !existing ? route.params?.draft : undefined;
  const linkedEvent = existing?.eventId ? events.find((e) => e.id === existing.eventId) : undefined;

  const [kind, setKind] = useState<TxKind>(existing?.kind ?? route.params?.kind ?? 'income');
  const [counterparty, setCounterparty] = useState(existing?.counterparty ?? draft?.counterparty ?? '');
  const [amount, setAmount] = useState(existing ? String(existing.amount) : draft?.amount ? String(draft.amount) : '');
  const [paid, setPaid] = useState(existing?.paidAmount ? String(existing.paidAmount) : '');
  const [currency, setCurrency] = useState<Currency>(existing?.currency ?? draft?.currency ?? defaultCurrency);
  const [date, setDate] = useState(existing?.date ?? draft?.date ?? toISODate(new Date()));
  const [status, setStatus] = useState<TxStatus>(existing?.status ?? 'paid');
  const [category, setCategory] = useState(existing?.category ?? '');
  const [note, setNote] = useState(existing?.note ?? (draft ? draft.raw : ''));
  const [errors, setErrors] = useState<Record<string, string>>({});

  useLayoutEffect(() => {
    navigation.setOptions({
      title: existing ? t('money.edit') : kind === 'income' ? t('money.newIncome') : t('money.newExpense'),
    });
  }, [navigation, existing, kind, t]);

  const amountNum = parseAmount(amount);
  const paidNum = status === 'paid' ? amountNum ?? 0 : parseAmount(paid) ?? 0;

  const save = () => {
    const next: Record<string, string> = {};
    if (!counterparty.trim()) next.counterparty = t('money.errors.counterparty');
    if (amountNum === null || amountNum <= 0) next.amount = t('money.errors.amount');
    if (status !== 'paid' && paid && parseAmount(paid) === null) next.paid = t('money.errors.amount');
    if (amountNum !== null && paidNum > amountNum) next.paid = t('money.errors.paid');
    setErrors(next);
    if (Object.keys(next).length || amountNum === null) return;

    const sensitive = detectSensitiveIn([counterparty, category, note]);
    if (sensitive) {
      notify(t('security.blockedTitle'), sensitive === 'card' ? t('security.blockedCard') : t('security.blockedIban'));
      return;
    }

    saveRecord({
      id,
      kind,
      counterparty: counterparty.trim(),
      amount: amountNum,
      paidAmount: paidNum,
      currency,
      date,
      status: deriveStatus(amountNum, paidNum, status),
      category: category.trim(),
      note: note.trim(),
      eventId: existing?.eventId,
    });
    navigation.goBack();
  };

  const remove = async () => {
    const ok = await confirmAction({
      title: t('common.confirmDelete'),
      message: t('common.confirmDeleteBody'),
      confirmLabel: t('common.delete'),
      cancelLabel: t('common.cancel'),
      destructive: true,
    });
    if (ok && id) {
      deleteRecord(id);
      navigation.goBack();
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen edges={['bottom']} readOnly={ro}>
        {ro ? <Banner icon="eye" text={t('readOnly')} /> : null}
        {draft ? <Banner icon="mic" text={t('voice.review')} /> : <Banner text={t('money.recordOnly')} />}
        <Segmented
          value={kind}
          onChange={setKind}
          options={[
            { value: 'income', label: t('money.income') },
            { value: 'expense', label: t('money.expense') },
          ]}
        />
        {linkedEvent ? (
          <T variant="caption" color={colors.violet}>
            {t(`events.types.${linkedEvent.type}`)} · {linkedEvent.title}
          </T>
        ) : null}

        <Field
          voice
          label={kind === 'income' ? t('money.fields.from') : t('money.fields.to')}
          value={counterparty}
          onChangeText={setCounterparty}
          placeholder={kind === 'income' ? t('money.fields.fromPlaceholder') : t('money.fields.toPlaceholder')}
          error={errors.counterparty}
          maxLength={100}
        />

        <Field
          label={`${t('money.fields.amount')} (${currencySymbol(currency)})`}
          value={amount}
          onChangeText={setAmount}
          keyboardType="decimal-pad"
          placeholder="0"
          error={errors.amount}
        />
        <Chips
          wrap={false}
          value={currency}
          onChange={setCurrency}
          options={CURRENCIES.map((c) => ({ value: c, label: `${currencySymbol(c)} ${c}` }))}
        />

        <View style={{ gap: space.sm }}>
          <T variant="caption">{t('money.fields.status')}</T>
          <View style={styles.statusWrap}>
            {TX_STATUSES.map((s) => (
              <Button
                key={s}
                label={t(`money.status.${s}`)}
                variant="secondary"
                onPress={() => setStatus(s)}
                style={[
                  styles.statusBtn,
                  s === status && { backgroundColor: STATUS_COLORS[s].bg, borderColor: STATUS_COLORS[s].fg },
                ]}
              />
            ))}
          </View>
        </View>

        {status === 'partial' || status === 'overdue' ? (
          <Field
            label={`${t('money.fields.paidAmount')} (${currencySymbol(currency)})`}
            value={paid}
            onChangeText={setPaid}
            keyboardType="decimal-pad"
            placeholder="0"
            error={errors.paid}
          />
        ) : null}
        {amountNum && paidNum < amountNum && status !== 'paid' ? (
          <T color={colors.warning}>{t('money.remaining', { amount: formatMoney(amountNum - paidNum, currency, lang) })}</T>
        ) : null}

        <DateField label={t('money.fields.date')} value={date} onChange={setDate} />
        <Field
          label={t('money.fields.category')}
          optional
          optionalLabel={t('common.optional')}
          value={category}
          onChangeText={setCategory}
          placeholder={t('money.fields.categoryPlaceholder')}
          maxLength={60}
        />
        <Field
          voice
          label={t('money.fields.note')}
          optional
          optionalLabel={t('common.optional')}
          value={note}
          onChangeText={setNote}
          multiline
          maxLength={500}
        />

        {ro ? null : (<Button label={t('common.save')} icon="checkmark" onPress={save} />)}
        {existing && !ro ? <Button label={t('common.delete')} icon="trash" variant="danger" onPress={remove} /> : null}
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  statusWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  statusBtn: { minHeight: 44, paddingHorizontal: space.md, flexGrow: 1 },
});
