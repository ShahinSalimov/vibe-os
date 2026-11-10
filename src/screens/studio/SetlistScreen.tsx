import { Ionicons } from '@expo/vector-icons';
import React, { useLayoutEffect, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ReadOnlyBanner } from '../../license/ReadOnlyBanner';
import { useRole } from '../../team/useRole';
import { Banner, Button, Card, Chips, Field, Screen, SectionHeader, T, tap } from '../../components/ui';
import { confirmAction, notify } from '../../lib/confirm';
import { formatDate, toISODate } from '../../lib/format';
import { detectSensitiveIn } from '../../lib/sensitive';
import type { Language } from '../../lib/types';
import type { RootProps } from '../../navigation/types';
import { useAppStore } from '../../store/useAppStore';
import { formatDuration, moveItem, setlistTotals } from '../../studio/format';
import { colors, radius, space, themed } from '../../theme/tokens';

export default function SetlistScreen({ route, navigation }: RootProps<'Setlist'>) {
  const { t, i18n } = useTranslation();
  const ro = !useRole().write('studio');
  const lang = i18n.language as Language;
  // Holds the id after the first save, so later saves update instead of creating duplicates.
  const [id, setId] = useState(route.params?.id);
  const existing = useAppStore((s) => (id ? s.setlists.find((x) => x.id === id) : undefined));
  const songs = useAppStore((s) => s.songs);
  const events = useAppStore((s) => s.events);
  const saveSetlist = useAppStore((s) => s.saveSetlist);
  const deleteSetlist = useAppStore((s) => s.deleteSetlist);

  const [title, setTitle] = useState(existing?.title ?? '');
  const [eventId, setEventId] = useState<string>(existing?.eventId ?? route.params?.eventId ?? '');
  const [songIds, setSongIds] = useState<string[]>(existing?.songIds ?? []);
  const [error, setError] = useState<string | null>(null);

  useLayoutEffect(() => {
    navigation.setOptions({ title: existing ? t('studio.editSetlist') : t('studio.newSetlist') });
  }, [navigation, existing, t]);

  const byId = useMemo(() => new Map(songs.map((s) => [s.id, s])), [songs]);
  const chosen = songIds.filter((x) => byId.has(x));
  const available = songs.filter((s) => !songIds.includes(s.id)).sort((a, b) => a.title.localeCompare(b.title));
  const totals = setlistTotals({ id: '', title: '', songIds: chosen, createdAt: '', updatedAt: '' }, songs);

  const today = toISODate(new Date());
  const upcoming = events
    .filter((e) => e.date >= today || e.id === eventId)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 12);

  const persist = (): string | null => {
    if (!title.trim()) {
      setError(t('studio.errors.setlistTitle'));
      return null;
    }
    if (detectSensitiveIn([title])) {
      notify(t('security.blockedTitle'), t('security.blockedCard'));
      return null;
    }
    const savedId = saveSetlist({ id, title: title.trim(), eventId: eventId || undefined, songIds: chosen });
    setId(savedId);
    return savedId;
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
      deleteSetlist(id);
      navigation.goBack();
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen edges={['bottom']} readOnly={ro}>
        {ro ? <ReadOnlyBanner /> : null}
        <Field
          label={t('studio.setlist.title')}
          value={title}
          onChangeText={(v) => {
            setTitle(v);
            setError(null);
          }}
          placeholder={t('studio.setlist.titlePlaceholder')}
          error={error ?? undefined}
          maxLength={100}
        />

        {upcoming.length ? (
          <View style={{ gap: space.sm }}>
            <T variant="caption">{t('studio.setlist.event')}</T>
            <Chips
              wrap={false}
              value={eventId}
              onChange={setEventId}
              options={[
                { value: '', label: t('studio.setlist.noEvent') },
                ...upcoming.map((e) => ({ value: e.id, label: `${formatDate(e.date, lang, false)} · ${e.title}` })),
              ]}
            />
          </View>
        ) : null}

        <Card style={styles.totals}>
          <T variant="bodyLg">{t('studio.setlist.songs', { count: totals.count })}</T>
          <T variant="bodyLg" color={colors.gold}>
            {t('studio.setlist.total', { time: formatDuration(totals.seconds) })}
          </T>
          {totals.unknown ? (
            <T variant="caption" style={{ width: '100%' }}>
              {t('studio.setlist.unknown', { count: totals.unknown })}
            </T>
          ) : null}
        </Card>

        <View style={{ gap: space.xs }}>
          {chosen.map((sid, i) => {
            const s = byId.get(sid)!;
            return (
              <View key={sid} style={styles.item}>
                <T variant="title" color={colors.gold} style={styles.num}>
                  {i + 1}
                </T>
                <View style={{ flex: 1 }}>
                  <T variant="bodyLg" numberOfLines={1}>
                    {s.title}
                  </T>
                  <T variant="caption">
                    {[s.musicalKey, s.bpm ? `${s.bpm} BPM` : '', s.durationSec ? formatDuration(s.durationSec) : '']
                      .filter(Boolean)
                      .join(' · ')}
                  </T>
                </View>
                <SmallIcon icon="chevron-up" label={t('studio.setlist.moveUp')} disabled={i === 0} onPress={() => setSongIds(moveItem(chosen, i, i - 1))} />
                <SmallIcon
                  icon="chevron-down"
                  label={t('studio.setlist.moveDown')}
                  disabled={i === chosen.length - 1}
                  onPress={() => setSongIds(moveItem(chosen, i, i + 1))}
                />
                <SmallIcon icon="close" label={t('studio.setlist.remove')} onPress={() => setSongIds(chosen.filter((x) => x !== sid))} />
              </View>
            );
          })}
        </View>

        <SectionHeader title={t('studio.setlist.addSongs')} />
        {songs.length === 0 ? (
          <T variant="caption">{t('studio.needSongs')}</T>
        ) : available.length === 0 ? (
          <T variant="caption">{t('studio.setlist.allAdded')}</T>
        ) : (
          <View style={styles.addWrap}>
            {available.map((s) => (
              <Pressable
                key={s.id}
                accessibilityRole="button"
                onPress={() => {
                  tap();
                  setSongIds([...chosen, s.id]);
                }}
                style={({ pressed }) => [styles.addChip, pressed && { opacity: 0.7 }]}
              >
                <Ionicons name="add" size={18} color={colors.gold} />
                <T>{s.title}</T>
              </Pressable>
            ))}
          </View>
        )}

        {ro ? null : (<Button
          label={t('common.save')}
          icon="checkmark"
          onPress={() => {
            if (persist()) navigation.goBack();
          }}
        />)}
        {chosen.length ? (
          <Button
            label={t('studio.setlist.stageMode')}
            icon="easel"
            variant="secondary"
            onPress={() => {
              const sid = persist();
              if (sid) navigation.navigate('StageMode', { id: sid });
            }}
          />
        ) : null}
        {existing && !ro ? <Button label={t('common.delete')} icon="trash" variant="danger" onPress={remove} /> : null}
      </Screen>
    </KeyboardAvoidingView>
  );
}

function SmallIcon({
  icon,
  label,
  onPress,
  disabled,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={() => {
        tap();
        onPress();
      }}
      hitSlop={6}
      style={[styles.small, disabled && { opacity: 0.3 }]}
    >
      <Ionicons name={icon} size={20} color={colors.text} />
    </Pressable>
  );
}

const styles = themed(() =>
  StyleSheet.create({
  totals: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center' },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: space.sm,
    paddingLeft: space.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  num: { width: 28, textAlign: 'center' },
  small: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceAlt,
  },
  addWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  addChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 44,
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  }),
);
