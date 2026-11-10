import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Clipboard from 'expo-clipboard';
import React, { useMemo, useState } from 'react';
import { Share, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { BookingRow } from '../components/booking';
import { Button, Card, EmptyState, IconButton, Screen, Segmented, T } from '../components/ui';
import { bookingLink, isCloudConfigured } from '../cloud/config';
import type { RootStackParamList } from '../navigation/types';
import { useAppStore } from '../store/useAppStore';
import { colors, space } from '../theme/tokens';

type Filter = 'active' | 'confirmed' | 'declined';

export default function BookingsScreen() {
  const { t } = useTranslation();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const bookings = useAppStore((s) => s.bookings);
  const slug = useAppStore((s) => s.cloud.slug);
  const signedIn = useAppStore((s) => !!s.cloud.email);
  const stageName = useAppStore((s) => s.profile?.stageName ?? '');
  const [filter, setFilter] = useState<Filter>('active');
  const [copied, setCopied] = useState(false);

  const link = bookingLink(slug);
  const counts = useMemo(
    () => ({
      active: bookings.filter((b) => b.status === 'new' || b.status === 'negotiating').length,
      confirmed: bookings.filter((b) => b.status === 'confirmed').length,
      declined: bookings.filter((b) => b.status === 'declined').length,
    }),
    [bookings],
  );

  const list = useMemo(() => {
    const match = (s: string) =>
      filter === 'active' ? s === 'new' || s === 'negotiating' : s === filter;
    return bookings
      .filter((b) => match(b.status))
      .sort((a, b) => {
        // new first, then by event date
        if (a.status !== b.status) return a.status === 'new' ? -1 : b.status === 'new' ? 1 : 0;
        return a.date.localeCompare(b.date);
      });
  }, [bookings, filter]);

  const copy = async () => {
    if (!link) return;
    await Clipboard.setStringAsync(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  const share = () => link && Share.share({ message: t('bookings.shareMessage', { name: stageName, link }) });

  return (
    <Screen>
      <View style={styles.header}>
        <T variant="h1">{t('bookings.title')}</T>
        <IconButton icon="add" label={t('bookings.new')} color={colors.gold} onPress={() => nav.navigate('BookingForm')} />
      </View>

      {/* Booking link card */}
      <Card style={styles.linkCard}>
        <View style={styles.rowCenter}>
          <Ionicons name="link" size={18} color={colors.gold} />
          <T variant="label" color={colors.gold}>
            {t('bookings.linkTitle')}
          </T>
        </View>
        {link ? (
          <>
            <T variant="bodyLg" numberOfLines={1} selectable>
              {link.replace(/^https?:\/\//, '')}
            </T>
            <T variant="caption">{t('bookings.linkBody')}</T>
            <View style={styles.rowCenter}>
              <Button
                label={copied ? t('bookings.copied') : t('bookings.copy')}
                icon={copied ? 'checkmark' : 'copy'}
                variant="secondary"
                onPress={copy}
                style={{ flex: 1 }}
              />
              <Button label={t('bookings.share')} icon="share-social" onPress={share} style={{ flex: 1 }} />
            </View>
          </>
        ) : !isCloudConfigured() ? (
          <T variant="caption">{t('bookings.linkNotReady')}</T>
        ) : (
          <>
            <T variant="caption">{signedIn ? t('bookings.linkNotReady') : t('bookings.linkSignIn')}</T>
            {!signedIn ? (
              <Button label={t('account.verify')} icon="log-in" variant="secondary" onPress={() => nav.navigate('Account')} />
            ) : null}
          </>
        )}
      </Card>

      {bookings.length === 0 ? (
        <EmptyState
          icon="mail-unread"
          title={t('bookings.empty')}
          body={t('bookings.emptyBody')}
          action={t('bookings.new')}
          onAction={() => nav.navigate('BookingForm')}
        />
      ) : (
        <>
          <Segmented
            value={filter}
            onChange={setFilter}
            options={[
              { value: 'active', label: `${t('bookings.filters.active')} · ${counts.active}` },
              { value: 'confirmed', label: `${t('bookings.filters.confirmed')} · ${counts.confirmed}` },
              { value: 'declined', label: `${t('bookings.filters.declined')} · ${counts.declined}` },
            ]}
          />
          <View style={{ gap: space.sm }}>
            {list.map((b) => (
              <BookingRow key={b.id} booking={b} onPress={() => nav.navigate('BookingDetail', { id: b.id })} />
            ))}
          </View>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  linkCard: { backgroundColor: colors.surfaceAlt, borderColor: colors.gold + '55' },
  rowCenter: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
});
