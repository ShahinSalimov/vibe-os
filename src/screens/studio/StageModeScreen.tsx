import { Ionicons } from '@expo/vector-icons';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { T, tap } from '../../components/ui';
import type { RootProps } from '../../navigation/types';
import { useAppStore } from '../../store/useAppStore';
import { formatDuration } from '../../studio/format';
import { colors, space } from '../../theme/tokens';

/** Full-screen, high-contrast setlist for the stage. Screen stays awake. */
export default function StageModeScreen({ route, navigation }: RootProps<'StageMode'>) {
  // Keep the screen on while on stage. Errors are ignored (e.g. leaving before the lock is granted).
  useEffect(() => {
    const tag = 'vibe-stage-mode';
    activateKeepAwakeAsync(tag).catch(() => {});
    return () => {
      Promise.resolve()
        .then(() => deactivateKeepAwake(tag))
        .catch(() => {});
    };
  }, []);
  const { t } = useTranslation();
  const list = useAppStore((s) => s.setlists.find((x) => x.id === route.params.id));
  const songs = useAppStore((s) => s.songs);
  const items = (list?.songIds ?? []).map((id) => songs.find((s) => s.id === id)).filter(Boolean) as typeof songs;
  const [i, setI] = useState(0);
  const cur = items[i];
  const next = items[i + 1];

  const go = (d: number) => {
    tap();
    setI((x) => Math.min(items.length - 1, Math.max(0, x + d)));
  };

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom', 'left', 'right']}>
      <View style={styles.top}>
        <T variant="label" color={colors.textMuted}>
          {list?.title}
        </T>
        <Pressable accessibilityRole="button" accessibilityLabel={t('studio.stage.exit')} onPress={() => navigation.goBack()} hitSlop={12} style={styles.exit}>
          <Ionicons name="close" size={26} color={colors.text} />
        </Pressable>
      </View>

      {!cur ? (
        <View style={styles.center}>
          <T variant="title">{t('studio.stage.empty')}</T>
        </View>
      ) : (
        <>
          <ScrollView contentContainerStyle={styles.main}>
            <T variant="label" color={colors.gold}>
              {t('studio.stage.position', { n: i + 1, total: items.length })}
            </T>
            <T style={styles.title}>{cur.title}</T>
            <View style={styles.meta}>
              {cur.musicalKey ? <Meta label={cur.musicalKey} /> : null}
              {cur.bpm ? <Meta label={`${cur.bpm} BPM`} /> : null}
              {cur.durationSec ? <Meta label={formatDuration(cur.durationSec)} /> : null}
            </View>
            {cur.lyrics ? <T style={styles.lyrics}>{cur.lyrics}</T> : null}
          </ScrollView>

          <View style={styles.bottom}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('studio.stage.prev')}
              disabled={i === 0}
              onPress={() => go(-1)}
              style={[styles.nav, i === 0 && { opacity: 0.3 }]}
            >
              <Ionicons name="chevron-back" size={36} color={colors.text} />
            </Pressable>
            <View style={{ flex: 1 }}>
              {next ? (
                <>
                  <T variant="caption">{t('studio.stage.next')}</T>
                  <T variant="title" numberOfLines={1}>
                    {next.title}
                  </T>
                </>
              ) : null}
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('studio.stage.next')}
              disabled={!next}
              onPress={() => go(1)}
              style={[styles.nav, styles.navNext, !next && { opacity: 0.3 }]}
            >
              <Ionicons name="chevron-forward" size={36} color={colors.onGold} />
            </Pressable>
          </View>
        </>
      )}
    </SafeAreaView>
  );
}

function Meta({ label }: { label: string }) {
  return (
    <View style={styles.metaPill}>
      <T variant="title" color={colors.text}>
        {label}
      </T>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.lg, paddingTop: space.sm },
  exit: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  main: { padding: space.lg, gap: space.lg },
  title: { fontSize: 44, lineHeight: 50, fontWeight: '800', color: colors.text },
  meta: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  metaPill: { paddingHorizontal: space.lg, paddingVertical: space.sm, borderRadius: 14, backgroundColor: colors.surfaceAlt },
  lyrics: { fontSize: 24, lineHeight: 34, color: colors.text },
  bottom: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  nav: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceAlt },
  navNext: { backgroundColor: colors.gold },
});
