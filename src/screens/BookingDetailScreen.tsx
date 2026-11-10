import { Ionicons } from '@expo/vector-icons';
import React, { useLayoutEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useRole } from '../team/useRole';
import { ContactActions, StatusPill } from '../components/booking';
import { EVENT_ICONS } from '../components/rows';
import { Button, Card, IconButton, Screen, T, type IconName } from '../components/ui';
import { confirmAction } from '../lib/confirm';
import { formatDate, formatMoney } from '../lib/format';
import type { Language } from '../lib/types';
import type { RootProps } from '../navigation/types';
import { useAppStore } from '../store/useAppStore';
import { colors, space, themed } from '../theme/tokens';

export default function BookingDetailScreen({ route, navigation }: RootProps<'BookingDetail'>) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language as Language;
  const b = useAppStore((s) => s.bookings.find((x) => x.id === route.params.id));
  const events = useAppStore((s) => s.events);
  const setStatus = useAppStore((s) => s.setBookingStatus);
  const confirmBooking = useAppStore((s) => s.confirmBooking);
  const deleteBooking = useAppStore((s) => s.deleteBooking);
  const canEdit = useRole().write('bookings');

  useLayoutEffect(() => {
    navigation.setOptions({
      title: t('bookings.edit'),
      headerRight: () =>
        b && canEdit ? (
          <IconButton
            icon="create-outline"
            label={t('common.edit')}
            onPress={() => navigation.navigate('BookingForm', { id: b.id })}
          />
        ) : null,
    });
  }, [navigation, t, b, canEdit]);

  if (!b) return <Screen edges={['bottom']}>{null}</Screen>;

  const conflict = events.find((e) => e.date === b.date && e.id !== b.eventId);
  const linkedEvent = b.eventId ? events.find((e) => e.id === b.eventId) : undefined;

  const confirm = () => {
    const title = t('bookings.eventTitle', { type: t(`events.types.${b.eventType}`), name: b.organizerName });
    const eventId = confirmBooking(b.id, title);
    if (eventId) navigation.replace('EventForm', { id: eventId });
  };

  const remove = async () => {
    const ok = await confirmAction({
      title: t('common.confirmDelete'),
      message: t('common.confirmDeleteBody'),
      confirmLabel: t('common.delete'),
      cancelLabel: t('common.cancel'),
      destructive: true,
    });
    if (ok) {
      deleteBooking(b.id);
      navigation.goBack();
    }
  };

  const rows: { icon: IconName; label: string; value: string }[] = [
    { icon: EVENT_ICONS[b.eventType], label: t('bookings.fields.type'), value: t(`events.types.${b.eventType}`) },
    { icon: 'calendar', label: t('bookings.fields.date'), value: formatDate(b.date, lang) },
    { icon: 'location', label: t('bookings.fields.city'), value: [b.venue, b.city].filter(Boolean).join(', ') },
    { icon: 'people', label: t('bookings.fields.guests'), value: b.guests ? t('bookings.guests', { count: b.guests }) : '' },
    { icon: 'cash', label: t('bookings.fields.budget'), value: b.budget ? formatMoney(b.budget, b.currency, lang) : '' },
    { icon: 'call', label: t('bookings.fields.phone'), value: b.phone },
    { icon: 'mail', label: t('bookings.fields.email'), value: b.email },
  ].filter((r) => r.value) as { icon: IconName; label: string; value: string }[];

  return (
    <Screen edges={['bottom']}>
      <View style={styles.head}>
        <View style={{ flex: 1 }}>
          <T variant="h1">{b.organizerName}</T>
          <T variant="caption">{b.source === 'link' ? t('bookings.viaLink') : t('bookings.manual')}</T>
        </View>
        <StatusPill status={b.status} />
      </View>

      <ContactActions phone={b.phone} email={b.email} />

      <Card style={{ gap: space.md }}>
        {rows.map((r) => (
          <View key={r.label} style={styles.infoRow}>
            <Ionicons name={r.icon} size={20} color={colors.violet} />
            <View style={{ flex: 1 }}>
              <T variant="caption">{r.label}</T>
              <T variant="bodyLg" selectable>
                {r.value}
              </T>
            </View>
          </View>
        ))}
      </Card>

      {b.message ? (
        <Card>
          <T variant="caption">{t('bookings.fields.message')}</T>
          <T selectable>{b.message}</T>
        </Card>
      ) : null}

      {conflict && b.status !== 'confirmed' ? (
        <View style={styles.warn}>
          <Ionicons name="warning" size={18} color={colors.warning} />
          <T variant="caption" color={colors.text} style={{ flex: 1 }}>
            {t('events.conflict', { title: conflict.title })}
          </T>
        </View>
      ) : null}

      {b.status === 'confirmed' && linkedEvent ? (
        <Button label={t('bookings.openEvent')} icon="calendar" onPress={() => navigation.navigate('EventForm', { id: linkedEvent.id })} />
      ) : null}
      {canEdit && (b.status === 'new' || b.status === 'negotiating') ? (
        <>
          <Button label={t('bookings.confirm')} icon="checkmark-circle" onPress={confirm} />
          {b.status === 'new' ? (
            <Button
              label={t('bookings.negotiate')}
              icon="chatbubbles"
              variant="secondary"
              onPress={() => setStatus(b.id, 'negotiating')}
            />
          ) : null}
          <Button label={t('bookings.decline')} icon="close-circle" variant="secondary" onPress={() => setStatus(b.id, 'declined')} />
        </>
      ) : null}
      {canEdit && b.status === 'declined' ? (
        <Button label={t('bookings.reopen')} icon="refresh" variant="secondary" onPress={() => setStatus(b.id, 'new')} />
      ) : null}
      {canEdit ? <Button label={t('common.delete')} icon="trash" variant="danger" onPress={remove} /> : null}
    </Screen>
  );
}

const styles = themed(() =>
  StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  warn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    padding: space.md,
    borderRadius: 14,
    backgroundColor: colors.goldSoft,
  },
  }),
);
