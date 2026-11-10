import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useMemo, useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { EventRow } from '../components/rows';
import { EmptyState, IconButton, Screen, Segmented, T } from '../components/ui';
import { toISODate } from '../lib/format';
import type { RootStackParamList } from '../navigation/types';
import { useAppStore } from '../store/useAppStore';
import { colors, space } from '../theme/tokens';

export default function EventsScreen() {
  const { t } = useTranslation();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const events = useAppStore((s) => s.events);
  const [tab, setTab] = useState<'upcoming' | 'past'>('upcoming');
  const today = toISODate(new Date());

  const list = useMemo(() => {
    const filtered = events.filter((e) => (tab === 'upcoming' ? e.date >= today : e.date < today));
    return filtered.sort((a, b) => {
      const c = (a.date + a.time).localeCompare(b.date + b.time);
      return tab === 'upcoming' ? c : -c;
    });
  }, [events, tab, today]);

  return (
    <Screen>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <T variant="h1">{t('events.title')}</T>
        <IconButton icon="add" label={t('events.new')} color={colors.gold} onPress={() => nav.navigate('EventForm')} />
      </View>
      {events.length === 0 ? (
        <EmptyState
          icon="calendar"
          title={t('events.empty')}
          body={t('events.emptyBody')}
          action={t('events.new')}
          onAction={() => nav.navigate('EventForm')}
        />
      ) : (
        <>
          <Segmented
            value={tab}
            onChange={setTab}
            options={[
              { value: 'upcoming', label: t('events.upcoming') },
              { value: 'past', label: t('events.past') },
            ]}
          />
          <View style={{ gap: space.sm }}>
            {list.map((e) => (
              <EventRow key={e.id} event={e} onPress={() => nav.navigate('EventForm', { id: e.id })} />
            ))}
          </View>
        </>
      )}
    </Screen>
  );
}
