import { Ionicons } from '@expo/vector-icons';
import React, { useLayoutEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { DateField } from '../components/DateField';
import { EVENT_ICONS } from '../components/rows';
import { Button, Chips, Field, Screen, T, tap } from '../components/ui';
import { isEmail } from '../cloud/auth';
import { notify } from '../lib/confirm';
import { currencySymbol, parseAmount, toISODate } from '../lib/format';
import { detectSensitiveIn, validPhone } from '../lib/sensitive';
import { CURRENCIES, EVENT_TYPES, type Currency, type EventType, type Language } from '../lib/types';
import type { RootProps } from '../navigation/types';
import { useAppStore } from '../store/useAppStore';
import { colors, radius, space, themed } from '../theme/tokens';

/** Manual booking request (from a phone call / WhatsApp). Link requests arrive via the cloud. */
export default function BookingFormScreen({ route, navigation }: RootProps<'BookingForm'>) {
  const { t, i18n } = useTranslation();
  const id = route.params?.id;
  const existing = useAppStore((s) => (id ? s.bookings.find((b) => b.id === id) : undefined));
  const defaultCurrency = useAppStore((s) => s.settings.currency);
  const saveBooking = useAppStore((s) => s.saveBooking);

  const [organizerName, setOrganizerName] = useState(existing?.organizerName ?? '');
  const [phone, setPhone] = useState(existing?.phone ?? '');
  const [email, setEmail] = useState(existing?.email ?? '');
  const [eventType, setEventType] = useState<EventType>(existing?.eventType ?? 'wedding');
  const [date, setDate] = useState(existing?.date ?? toISODate(new Date()));
  const [city, setCity] = useState(existing?.city ?? '');
  const [venue, setVenue] = useState(existing?.venue ?? '');
  const [guests, setGuests] = useState(existing?.guests ? String(existing.guests) : '');
  const [budget, setBudget] = useState(existing?.budget ? String(existing.budget) : '');
  const [currency, setCurrency] = useState<Currency>(existing?.currency ?? defaultCurrency);
  const [message, setMessage] = useState(existing?.message ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});

  useLayoutEffect(() => {
    navigation.setOptions({ title: existing ? t('bookings.edit') : t('bookings.new') });
  }, [navigation, existing, t]);

  const save = () => {
    const next: Record<string, string> = {};
    if (!organizerName.trim()) next.organizerName = t('bookings.errors.name');
    if (!phone.trim() && !email.trim()) next.phone = t('bookings.errors.contact');
    if (!validPhone(phone)) next.phone = t('events.errors.phone');
    if (email.trim() && !isEmail(email)) next.email = t('bookings.errors.email');
    if (budget && parseAmount(budget) === null) next.budget = t('bookings.errors.budget');
    setErrors(next);
    if (Object.keys(next).length) return;

    const sensitive = detectSensitiveIn([organizerName, email, city, venue, message]);
    if (sensitive) {
      notify(t('security.blockedTitle'), sensitive === 'card' ? t('security.blockedCard') : t('security.blockedIban'));
      return;
    }
    const guestsNum = parseInt(guests, 10);
    const id2 = saveBooking({
      id,
      source: existing?.source ?? 'manual',
      organizerName: organizerName.trim(),
      phone: phone.trim(),
      email: email.trim(),
      eventType,
      date,
      city: city.trim(),
      venue: venue.trim(),
      guests: Number.isFinite(guestsNum) && guestsNum > 0 ? guestsNum : null,
      budget: budget ? parseAmount(budget) : null,
      currency,
      message: message.trim(),
      language: existing?.language ?? (i18n.language as Language),
      status: existing?.status ?? 'new',
      eventId: existing?.eventId,
    });
    if (existing) navigation.goBack();
    else navigation.replace('BookingDetail', { id: id2 });
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen edges={['bottom']}>
        <Field
          label={t('bookings.fields.organizer')}
          value={organizerName}
          onChangeText={setOrganizerName}
          error={errors.organizerName}
          maxLength={100}
        />
        <View style={styles.row2}>
          <View style={{ flex: 1 }}>
            <Field
              label={t('bookings.fields.phone')}
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              maxLength={20}
              error={errors.phone}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Field
              label={t('bookings.fields.email')}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              maxLength={120}
              error={errors.email}
            />
          </View>
        </View>

        <View style={{ gap: space.sm }}>
          <T variant="caption">{t('bookings.fields.type')}</T>
          <View style={styles.typeGrid}>
            {EVENT_TYPES.map((ty) => {
              const active = ty === eventType;
              return (
                <Pressable
                  key={ty}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}
                  onPress={() => {
                    tap();
                    setEventType(ty);
                  }}
                  style={[styles.typeCell, active && styles.typeCellActive]}
                >
                  <Ionicons name={EVENT_ICONS[ty]} size={20} color={active ? colors.onGold : colors.violet} />
                  <T variant="caption" color={active ? colors.onGold : colors.text} numberOfLines={1}>
                    {t(`events.types.${ty}`)}
                  </T>
                </Pressable>
              );
            })}
          </View>
        </View>

        <DateField label={t('bookings.fields.date')} value={date} onChange={setDate} />
        <View style={styles.row2}>
          <View style={{ flex: 1 }}>
            <Field label={t('bookings.fields.city')} value={city} onChangeText={setCity} maxLength={60} />
          </View>
          <View style={{ flex: 1 }}>
            <Field label={t('bookings.fields.venue')} value={venue} onChangeText={setVenue} maxLength={100} />
          </View>
        </View>
        <View style={styles.row2}>
          <View style={{ flex: 1 }}>
            <Field
              label={t('bookings.fields.guests')}
              value={guests}
              onChangeText={(v) => setGuests(v.replace(/\D/g, ''))}
              keyboardType="number-pad"
              maxLength={6}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Field
              label={`${t('bookings.fields.budget')} (${currencySymbol(currency)})`}
              value={budget}
              onChangeText={setBudget}
              keyboardType="decimal-pad"
              error={errors.budget}
            />
          </View>
        </View>
        <Chips
          wrap={false}
          value={currency}
          onChange={setCurrency}
          options={CURRENCIES.map((c) => ({ value: c, label: `${currencySymbol(c)} ${c}` }))}
        />
        <Field
          voice
          label={t('bookings.fields.message')}
          optional
          optionalLabel={t('common.optional')}
          value={message}
          onChangeText={setMessage}
          multiline
          maxLength={1000}
        />
        <Button label={t('common.save')} icon="checkmark" onPress={save} />
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = themed(() =>
  StyleSheet.create({
  row2: { flexDirection: 'row', gap: space.md },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  typeCell: {
    width: '31.5%',
    minHeight: 64,
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
  }),
);
