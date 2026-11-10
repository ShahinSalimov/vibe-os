import { Ionicons } from '@expo/vector-icons';
import React, { useLayoutEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useRole } from '../../team/useRole';
import { EmptyState, Field, IconButton, Screen, Segmented, T, tap } from '../../components/ui';
import { SONG_STAGES, type SongStage } from '../../lib/types';
import type { RootProps } from '../../navigation/types';
import { useAppStore } from '../../store/useAppStore';
import { formatDuration, setlistTotals } from '../../studio/format';
import { colors, radius, space, themed } from '../../theme/tokens';

export const STAGE_COLORS: Record<SongStage, string> = themed(() => ({
  idea: colors.textMuted,
  writing: colors.violet,
  demo: colors.violet,
  arrangement: colors.gold,
  recording: colors.gold,
  mixing: colors.warning,
  mastering: colors.warning,
  released: colors.success,
}));

export function StageProgress({ stage }: { stage: SongStage }) {
  const idx = SONG_STAGES.indexOf(stage);
  return (
    <View style={styles.progress}>
      {SONG_STAGES.map((s, i) => (
        <View key={s} style={[styles.progressStep, i <= idx && { backgroundColor: STAGE_COLORS[stage] }]} />
      ))}
    </View>
  );
}

export default function StudioScreen({ route, navigation }: RootProps<'Studio'>) {
  const { t } = useTranslation();
  const songs = useAppStore((s) => s.songs);
  const setlists = useAppStore((s) => s.setlists);
  const assets = useAppStore((s) => s.assets);
  const events = useAppStore((s) => s.events);
  const canAdd = useRole().write('studio');
  const [tab, setTab] = useState<'songs' | 'setlists'>(route.params?.tab ?? 'songs');
  const [query, setQuery] = useState('');

  useLayoutEffect(() => {
    navigation.setOptions({
      title: t('studio.title'),
      headerRight: () =>
        !canAdd ? null : (
        <IconButton
          icon="add"
          color={colors.gold}
          label={tab === 'songs' ? t('studio.newSong') : t('studio.newSetlist')}
          onPress={() => (tab === 'songs' ? navigation.navigate('Song') : navigation.navigate('Setlist'))}
        />
      ),
    });
  }, [navigation, t, tab, canAdd]);

  const songList = useMemo(() => {
    const q = query.trim().toLowerCase();
    return songs
      .filter((s) => !q || s.title.toLowerCase().includes(q) || s.authors.toLowerCase().includes(q))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }, [songs, query]);

  const audioCount = useMemo(() => {
    const m = new Map<string, number>();
    for (const a of assets) m.set(a.songId, (m.get(a.songId) ?? 0) + 1);
    return m;
  }, [assets]);

  return (
    <Screen edges={['bottom']}>
      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { value: 'songs', label: `${t('studio.songs')} · ${songs.length}` },
          { value: 'setlists', label: `${t('studio.setlists')} · ${setlists.length}` },
        ]}
      />

      {tab === 'songs' ? (
        songs.length === 0 ? (
          <EmptyState
            icon="musical-notes"
            title={t('studio.emptySongs')}
            body={t('studio.emptySongsBody')}
            action={t('studio.newSong')}
            onAction={() => navigation.navigate('Song')}
          />
        ) : (
          <>
            {songs.length > 6 ? <Field label={t('common.search')} value={query} onChangeText={setQuery} /> : null}
            <View style={{ gap: space.sm }}>
              {songList.map((s) => (
                <Pressable
                  key={s.id}
                  accessibilityRole="button"
                  onPress={() => {
                    tap();
                    navigation.navigate('Song', { id: s.id });
                  }}
                  style={({ pressed }) => [styles.row, pressed && { opacity: 0.8 }]}
                >
                  <View style={styles.icon}>
                    <Ionicons name="musical-note" size={22} color={STAGE_COLORS[s.stage]} />
                  </View>
                  <View style={{ flex: 1, gap: 4 }}>
                    <T variant="bodyLg" numberOfLines={1}>
                      {s.title}
                    </T>
                    <T variant="caption" numberOfLines={1}>
                      {[
                        t(`studio.stages.${s.stage}`),
                        s.musicalKey,
                        s.bpm ? `${s.bpm} BPM` : '',
                        s.durationSec ? formatDuration(s.durationSec) : '',
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </T>
                    <StageProgress stage={s.stage} />
                  </View>
                  {audioCount.get(s.id) ? (
                    <View style={styles.badge}>
                      <Ionicons name="mic" size={12} color={colors.gold} />
                      <T variant="caption" color={colors.gold}>
                        {audioCount.get(s.id)}
                      </T>
                    </View>
                  ) : null}
                </Pressable>
              ))}
            </View>
          </>
        )
      ) : setlists.length === 0 ? (
        <EmptyState
          icon="list"
          title={t('studio.emptySetlists')}
          body={songs.length ? t('studio.emptySetlistsBody') : t('studio.needSongs')}
          action={songs.length ? t('studio.newSetlist') : t('studio.newSong')}
          onAction={() => (songs.length ? navigation.navigate('Setlist') : navigation.navigate('Song'))}
        />
      ) : (
        <View style={{ gap: space.sm }}>
          {[...setlists]
            .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
            .map((l) => {
              const tot = setlistTotals(l, songs);
              const ev = l.eventId ? events.find((e) => e.id === l.eventId) : undefined;
              return (
                <Pressable
                  key={l.id}
                  accessibilityRole="button"
                  onPress={() => {
                    tap();
                    navigation.navigate('Setlist', { id: l.id });
                  }}
                  style={({ pressed }) => [styles.row, pressed && { opacity: 0.8 }]}
                >
                  <View style={styles.icon}>
                    <Ionicons name="list" size={22} color={colors.violet} />
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <T variant="bodyLg" numberOfLines={1}>
                      {l.title}
                    </T>
                    <T variant="caption" numberOfLines={1}>
                      {[t('studio.setlist.songs', { count: tot.count }), tot.seconds ? formatDuration(tot.seconds) : '', ev?.title]
                        .filter(Boolean)
                        .join(' · ')}
                    </T>
                  </View>
                  <IconButton
                    icon="easel"
                    label={t('studio.setlist.stageMode')}
                    color={colors.gold}
                    onPress={() => navigation.navigate('StageMode', { id: l.id })}
                  />
                </Pressable>
              );
            })}
        </View>
      )}
    </Screen>
  );
}

const styles = themed(() =>
  StyleSheet.create({
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
    width: 48,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progress: { flexDirection: 'row', gap: 3 },
  progressStep: { flex: 1, height: 4, borderRadius: 2, backgroundColor: colors.border },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: space.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
    backgroundColor: colors.goldSoft,
  },
  }),
);
