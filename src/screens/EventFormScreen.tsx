import { Ionicons } from '@expo/vector-icons';
import React, { useLayoutEffect, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { DateField } from '../components/DateField';
import { EVENT_ICONS } from '../components/rows';
import { Banner, Button, Card, Chips, Field, Screen, T, tap } from '../components/ui';
import { confirmAction, notify } from '../lib/confirm';
import { deriveStatus } from '../lib/finance';
import { currencySymbol, formatMoney, isValidTime, parseAmount, toISODate } from '../lib/format';
import { detectSensitiveIn, validPhone } from '../lib/sensitive';
import { CURRENCIES, EVENT_TYPES, type Currency, type EventType, type Language } from '../lib/types';
import type { RootProps } from '../navigation/types';
import { useAppStore } from '../store/useAppStore';
import { colors, radius, space } from '../theme/tokens';

export default function EventFormScreen({ route, navigation }: RootProps<'EventForm'>) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language as Language;
  const id = route.params?.id;
  const events = useAppStore((s) => s.events);
  const records = useAppStore((s) => s.records);
  const defaultCurrency = useAppStore((s) => s.settings.currency);
  const saveEvent = useAppStore((s) => s.saveEvent);
  const deleteEvent = useAppStore((s) => s.deleteEvent);
  const saveRecord = useAppStore((s) => s.saveRecord);

  const existing = id ? events.find((e) => e.id === id) : undefined;
  const linkedIncome = id ? records.find((r) => r.eventId === id && r.kind === 'income') : undefined;

  const [title, setTitle] = useState(existing?.title ?? '');
  const [type, setType] = useState<EventType>(existing?.type ?? 'wedding');
  const [date, setDate] = useState(existing?.date ?? toISODate(new Date()));
  const [time, setTime] = useState(existing?.time ?? '');
  const [venue, setVenue] = useState(existing?.venue ?? '');
  const [city, setCity] = useState(existing?.city ?? '');
  const [organizer, setOrganizer] = useState(existing?.organizer ?? '');
  const [organizerPhone, setOrganizerPhone] = useState(existing?.organizerPhone ?? '');
  const [fee, setFee] = useState(existing?.fee ? String(existing.fee) : '');
  const [advance, setAdvance] = useState(existing?.advance ? String(existing.advance) : '');
  const [currency, setCurrency] = useState<Currency>(existing?.currency ?? defaultCurrency);
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [addToMoney, setAddToMoney] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useLayoutEffect(() => {
    navigation.setOptions({ title: existing ? t('events.edit') : t('events.new') });
  }, [navigation, existing, t]);

  const markedDates = useMemo(() => new Set(events.filter((e) => e.id !== id).map((e) => e.date)), [events, id]);
  const conflict = events.find((e) => e.date === date && e.id !== id);

  const feeNum = parseAmount(fee) ?? 0;
  const advNum = parseAmount(advance) ?? 0;

  const save = () => {
    const next: Record<string, string> = {};
    if (!title.trim()) next.title = t('events.errors.title');
    if (!isValidTime(time.trim())) next.time = t('events.errors.time');
    if (!validPhone(organizerPhone)) next.organizerPhone = t('events.errors.phone');
    if (fee && parseAmount(fee) === null) next.fee = t('money.errors.amount');
    if (advance && parseAmount(advance) === null) next.advance = t('money.errors.amount');
    if (advNum > feeNum && feeNum > 0) next.advance = t('events.errors.advance');
    setErrors(next);
    if (Object.keys(next).length) return;

    const sensitive = detectSensitiveIn([title, venue, city, organizer, notes]);
    if (sensitive) {
      notify(t('security.blockedTitle'), sensitive === 'card' ? t('security.blockedCard') : t('security.blockedIban'));
      return;
    }

    const eventId = saveEvent({
      id,
      title: title.trim(),
      type,
      date,
      time: time.trim(),
      venue: venue.trim(),
      city: city.trim(),
      organizer: organizer.trim(),
      organizerPhone: organizerPhone.trim(),
      fee: feeNum,
      advance: advNum,
      currency,
      notes: notes.trim(),
    });

    // Keep the linked income record in sync (record-only, no payment).
    if (feeNum > 0 && (linkedIncome || addToMoney)) {
      saveRecord({
        id: linkedIncome?.id,
        kind: 'income',
        counterparty: organizer.trim() || title.trim(),
        amount: feeNum,
        paidAmount: advNum,
        currency,
        date,
        status: deriveStatus(feeNum, advNum, linkedIncome?.status === 'overdue' ? 'overdue' : 'planned'),
        category: t(`events.types.${type}`),
        note: linkedIncome?.note ?? '',
        eventId,
      });
    }
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
      deleteEvent(id);
      navigation.goBack();
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen edges={['bottom']}>
        <Field
          label={t('events.fields.title')}
          value={title}
          onChangeText={setTitle}
          placeholder={t('events.fields.titlePlaceholder')}
          error={errors.title}
          maxLength={100}
        />

        <View style={{ gap: space.sm }}>
          <T variant="caption">{t('events.fields.type')}</T>
          <View style={styles.typeGrid}>
            {EVENT_TYPES.map((ty) => {
              const active = ty === type;
              return (
                <Pressable
                  key={ty}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}
                  onPress={() => {
                    tap();
                    setType(ty);
                  }}
                  style={[styles.typeCell, active && styles.typeCellActive]}
                >
                  <Ionicons name={EVENT_ICONS[ty]} size={22} color={active ? colors.onGold : colors.violet} />
                  <T variant="caption" color={active ? colors.onGold : colors.text} numberOfLines={1}>
                    {t(`events.types.${ty}`)}
                  </T>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.row2}>
          <View style={{ flex: 3 }}>
            <DateField label={t('events.fields.date')} value={date} onChange={setDate} markedDates={markedDates} />
          </View>
          <View style={{ flex: 2 }}>
            <Field
              label={t('events.fields.time')}
              value={time}
              onChangeText={setTime}
              placeholder={t('events.fields.timePlaceholder')}
              keyboardType="numbers-and-punctuation"
              maxLength={5}
              error={errors.time}
            />
          </View>
        </View>
        {conflict ? <Banner tone="warning" icon="warning" text={t('events.conflict', { title: conflict.title })} /> : null}

        <View style={styles.row2}>
          <View style={{ flex: 1 }}>
            <Field label={t('events.fields.venue')} value={venue} onChangeText={setVenue} maxLength={100} />
          </View>
          <View style={{ flex: 1 }}>
            <Field label={t('events.fields.city')} value={city} onChangeText={setCity} maxLength={60} />
          </View>
        </View>

        <Field label={t('events.fields.organizer')} value={organizer} onChangeText={setOrganizer} maxLength={100} />
        <Field
          label={t('events.fields.organizerPhone')}
          value={organizerPhone}
          onChangeText={setOrganizerPhone}
          keyboardType="phone-pad"
          maxLength={20}
          error={errors.organizerPhone}
        />

        <Card>
          <View style={styles.row2}>
            <View style={{ flex: 1 }}>
              <Field
                label={`${t('events.fields.fee')} (${currencySymbol(currency)})`}
                value={fee}
                onChangeText={setFee}
                keyboardType="decimal-pad"
                placeholder="0"
                error={errors.fee}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Field
                label={`${t('events.fields.advance')} (${currencySymbol(currency)})`}
                value={advance}
                onChangeText={setAdvance}
                keyboardType="decimal-pad"
                placeholder="0"
                error={errors.advance}
              />
            </View>
          </View>
          <Chips
            wrap={false}
            value={currency}
            onChange={setCurrency}
            options={CURRENCIES.map((c) => ({ value: c, label: `${currencySymbol(c)} ${c}` }))}
          />
          {feeNum > 0 && advNum <= feeNum ? (
            <T color={feeNum - advNum > 0 ? colors.warning : colors.success}>
              {feeNum - advNum > 0
                ? `${t('events.balanceDue')}: ${formatMoney(feeNum - advNum, currency, lang)}`
                : t('events.fullyPaid')}
            </T>
          ) : null}
          {feeNum > 0 && !linkedIncome ? (
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: addToMoney }}
              onPress={() => {
                tap();
                setAddToMoney((v) => !v);
              }}
              style={styles.check}
            >
              <Ionicons name={addToMoney ? 'checkbox' : 'square-outline'} size={24} color={colors.gold} />
              <T style={{ flex: 1 }}>{t('events.createIncome')}</T>
            </Pressable>
          ) : null}
        </Card>

        <Field
          label={t('events.fields.notes')}
          optional
          optionalLabel={t('common.optional')}
          value={notes}
          onChangeText={setNotes}
          multiline
          maxLength={1000}
        />

        <Button label={t('common.save')} icon="checkmark" onPress={save} />
        {existing ? <Button label={t('common.delete')} icon="trash" variant="danger" onPress={remove} /> : null}
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  row2: { flexDirection: 'row', gap: space.md },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  typeCell: {
    width: '31.5%',
    minHeight: 72,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 4,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  typeCellActive: { backgroundColor: colors.gold, borderColor: colors.gold },
  check: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 44 },
});
