import { Ionicons } from '@expo/vector-icons';
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import * as DocumentPicker from 'expo-document-picker';
import React, { useEffect, useLayoutEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useRole } from '../../team/useRole';
import { Banner, Button, Card, Chips, Field, Screen, SectionHeader, T, tap } from '../../components/ui';
import { confirmAction, notify } from '../../lib/confirm';
import { detectSensitiveIn } from '../../lib/sensitive';
import { ASSET_KINDS, SONG_STAGES, type AssetKind, type SongAsset, type SongStage } from '../../lib/types';
import type { RootProps } from '../../navigation/types';
import { useAppStore } from '../../store/useAppStore';
import { keepAudioFile, removeAudioFile } from '../../studio/files';
import { formatDuration, parseDuration } from '../../studio/format';
import { colors, radius, space } from '../../theme/tokens';
import { StageProgress } from './StudioScreen';

export default function SongScreen({ route, navigation }: RootProps<'Song'>) {
  const { t } = useTranslation();
  const ro = !useRole().write('studio');
  const [id, setId] = useState(route.params?.id);
  const existing = useAppStore((s) => (id ? s.songs.find((x) => x.id === id) : undefined));
  const saveSong = useAppStore((s) => s.saveSong);
  const deleteSong = useAppStore((s) => s.deleteSong);

  const [title, setTitle] = useState(existing?.title ?? '');
  const [stage, setStage] = useState<SongStage>(existing?.stage ?? 'idea');
  const [musicalKey, setKey] = useState(existing?.musicalKey ?? '');
  const [bpm, setBpm] = useState(existing?.bpm ? String(existing.bpm) : '');
  const [duration, setDuration] = useState(existing?.durationSec ? formatDuration(existing.durationSec) : '');
  const [authors, setAuthors] = useState(existing?.authors ?? '');
  const [lyrics, setLyrics] = useState(existing?.lyrics ?? '');
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});

  useLayoutEffect(() => {
    navigation.setOptions({ title: existing ? t('studio.editSong') : t('studio.newSong') });
  }, [navigation, existing, t]);

  const save = (stay = false) => {
    const next: Record<string, string> = {};
    if (!title.trim()) next.title = t('studio.errors.title');
    const bpmNum = bpm.trim() ? Number(bpm) : null;
    if (bpmNum !== null && (!Number.isInteger(bpmNum) || bpmNum < 20 || bpmNum > 300)) next.bpm = t('studio.errors.bpm');
    const dur = parseDuration(duration);
    if (dur === undefined || (dur !== null && (dur < 1 || dur > 3600))) next.duration = t('studio.errors.duration');
    setErrors(next);
    if (Object.keys(next).length) return null;
    const sensitive = detectSensitiveIn([title, authors, lyrics, notes]);
    if (sensitive) {
      notify(t('security.blockedTitle'), sensitive === 'card' ? t('security.blockedCard') : t('security.blockedIban'));
      return null;
    }
    const savedId = saveSong({
      id,
      title: title.trim(),
      stage,
      musicalKey: musicalKey.trim(),
      bpm: bpmNum,
      durationSec: dur ?? null,
      lyrics: lyrics.trim(),
      authors: authors.trim(),
      notes: notes.trim(),
      releaseDate: existing?.releaseDate ?? '',
    });
    if (stay) setId(savedId);
    else navigation.goBack();
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
      const files = deleteSong(id);
      await Promise.all(files.map(removeAudioFile));
      navigation.goBack();
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen edges={['bottom']} readOnly={ro}>
        {ro ? <Banner icon="eye" text={t('readOnly')} /> : null}
        <Field
          voice
          label={t('studio.fields.title')}
          value={title}
          onChangeText={setTitle}
          error={errors.title}
          maxLength={120}
        />

        <View style={{ gap: space.sm }}>
          <T variant="caption">{t('studio.fields.stage')}</T>
          <StageProgress stage={stage} />
          <Chips
            value={stage}
            onChange={setStage}
            options={SONG_STAGES.map((s) => ({ value: s, label: t(`studio.stages.${s}`) }))}
          />
        </View>

        <View style={styles.row3}>
          <View style={{ flex: 1 }}>
            <Field
              label={t('studio.fields.key')}
              value={musicalKey}
              onChangeText={setKey}
              placeholder={t('studio.fields.keyPlaceholder')}
              autoCapitalize="none"
              maxLength={12}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Field
              label={t('studio.fields.bpm')}
              value={bpm}
              onChangeText={(v) => setBpm(v.replace(/\D/g, ''))}
              keyboardType="number-pad"
              maxLength={3}
              error={errors.bpm}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Field
              label={t('studio.fields.duration')}
              value={duration}
              onChangeText={setDuration}
              placeholder={t('studio.fields.durationPlaceholder')}
              keyboardType="numbers-and-punctuation"
              maxLength={5}
              error={errors.duration}
            />
          </View>
        </View>

        <Field
          label={t('studio.fields.authors')}
          value={authors}
          onChangeText={setAuthors}
          placeholder={t('studio.fields.authorsPlaceholder')}
          maxLength={200}
        />

        <AudioSection songId={id} onNeedSave={() => save(true)} />

        <Field
          voice
          label={t('studio.fields.lyrics')}
          optional
          optionalLabel={t('common.optional')}
          value={lyrics}
          onChangeText={setLyrics}
          multiline
          maxLength={10000}
        />
        <Field
          voice
          label={t('studio.fields.notes')}
          optional
          optionalLabel={t('common.optional')}
          value={notes}
          onChangeText={setNotes}
          multiline
          maxLength={1000}
        />

        {ro ? null : (<Button label={t('common.save')} icon="checkmark" onPress={() => save(false)} />)}
        {existing && !ro ? <Button label={t('common.delete')} icon="trash" variant="danger" onPress={remove} /> : null}
      </Screen>
    </KeyboardAvoidingView>
  );
}

// ---------------------------------------------------------------------------
// Audio: ideas recorded in the app + demos/finals imported from files.
// One shared player; files stay on this device.
// ---------------------------------------------------------------------------

function AudioSection({ songId, onNeedSave }: { songId?: string; onNeedSave: () => string | null }) {
  const { t } = useTranslation();
  const assets = useAppStore((s) => s.assets);
  const saveAsset = useAppStore((s) => s.saveAsset);
  const deleteAsset = useAppStore((s) => s.deleteAsset);
  const list = assets.filter((a) => a.songId === songId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const player = useAudioPlayer(null);
  const status = useAudioPlayerStatus(player);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // iPhone: play through the speaker even when the ring/silent switch is on
  useEffect(() => {
    setAudioModeAsync({ playsInSilentMode: true }).catch(() => {});
  }, []);

  // learn the duration of imported files the first time they play
  useEffect(() => {
    const a = list.find((x) => x.id === currentId);
    if (a && a.durationSec == null && status.duration > 0) {
      saveAsset({ ...a, durationSec: Math.round(status.duration) });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status.duration, currentId]);

  const ensureSong = (): string | null => songId ?? onNeedSave();

  const toggle = (a: SongAsset) => {
    setError(null);
    try {
      if (currentId === a.id) {
        if (status.playing) player.pause();
        else player.play();
        return;
      }
      player.replace({ uri: a.uri });
      setCurrentId(a.id);
      player.play();
    } catch {
      setError(t('studio.audio.failed'));
    }
  };

  const addFile = async () => {
    const sid = ensureSong();
    if (!sid) return;
    const res = await DocumentPicker.getDocumentAsync({ type: 'audio/*', copyToCacheDirectory: true, multiple: false });
    if (res.canceled || !res.assets?.[0]) return;
    const f = res.assets[0];
    try {
      const uri = await keepAudioFile(f.uri, f.name);
      saveAsset({
        songId: sid,
        kind: 'demo',
        label: f.name.replace(/\.[a-z0-9]{2,5}$/i, ''),
        uri,
        durationSec: null,
      });
    } catch {
      setError(t('studio.audio.failed'));
    }
  };

  const changeKind = (a: SongAsset, kind: AssetKind) => saveAsset({ ...a, kind });

  const remove = async (a: SongAsset) => {
    const ok = await confirmAction({
      title: t('common.confirmDelete'),
      message: t('common.confirmDeleteBody'),
      confirmLabel: t('common.delete'),
      cancelLabel: t('common.cancel'),
      destructive: true,
    });
    if (!ok) return;
    if (currentId === a.id) {
      player.pause();
      setCurrentId(null);
    }
    await removeAudioFile(deleteAsset(a.id));
  };

  return (
    <View style={{ gap: space.sm }}>
      <SectionHeader title={t('studio.audio.title')} />
      <View style={styles.row2}>
        <Button
          label={t('studio.audio.record')}
          icon="mic"
          onPress={() => {
            if (ensureSong()) setRecording(true);
          }}
          style={{ flex: 1 }}
        />
        <Button label={t('studio.audio.addFile')} icon="document-attach" variant="secondary" onPress={addFile} style={{ flex: 1 }} />
      </View>
      {!songId ? <T variant="caption">{t('studio.audio.saveFirst')}</T> : null}
      {error ? <Banner tone="danger" icon="alert-circle" text={error} /> : null}

      {songId && list.length === 0 ? <T variant="caption">{t('studio.audio.empty')}</T> : null}
      {list.map((a) => {
        const active = currentId === a.id;
        const playing = active && status.playing;
        return (
          <Card key={a.id} style={styles.assetCard}>
            <View style={styles.assetHead}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={playing ? t('studio.audio.pause') : t('studio.audio.play')}
                onPress={() => {
                  tap();
                  toggle(a);
                }}
                style={styles.play}
              >
                <Ionicons name={playing ? 'pause' : 'play'} size={22} color={colors.onGold} />
              </Pressable>
              <View style={{ flex: 1 }}>
                <T variant="bodyLg" numberOfLines={1}>
                  {a.label}
                </T>
                <T variant="caption">
                  {active && status.duration > 0
                    ? `${formatDuration(status.currentTime)} / ${formatDuration(status.duration)}`
                    : formatDuration(a.durationSec)}
                </T>
              </View>
              <Pressable accessibilityRole="button" accessibilityLabel={t('common.delete')} onPress={() => remove(a)} hitSlop={10}>
                <Ionicons name="trash-outline" size={20} color={colors.textFaint} />
              </Pressable>
            </View>
            {active && status.duration > 0 ? (
              <View style={styles.bar}>
                <View style={[styles.barFill, { width: `${Math.min(100, (status.currentTime / status.duration) * 100)}%` }]} />
              </View>
            ) : null}
            <Chips
              wrap={false}
              value={a.kind}
              onChange={(k) => changeKind(a, k)}
              options={ASSET_KINDS.map((k) => ({ value: k, label: t(`studio.audio.kinds.${k}`) }))}
            />
          </Card>
        );
      })}
      {list.length ? (
        <T variant="caption" color={colors.textFaint}>
          {t('studio.audio.deviceOnly')}
        </T>
      ) : null}

      <RecorderSheet
        visible={recording}
        onClose={() => setRecording(false)}
        onSaved={(uri, sec) => {
          setRecording(false);
          const sid = songId;
          if (!sid) return;
          const n = list.filter((x) => x.kind === 'idea').length + 1;
          saveAsset({ songId: sid, kind: 'idea', label: `${t('studio.audio.kinds.idea')} ${n}`, uri, durationSec: sec });
        }}
      />
    </View>
  );
}

function RecorderSheet({
  visible,
  onClose,
  onSaved,
}: {
  visible: boolean;
  onClose: () => void;
  onSaved: (uri: string, seconds: number) => void;
}) {
  const { t } = useTranslation();
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const state = useAudioRecorderState(recorder, 250);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    (async () => {
      setError(null);
      const perm = await requestRecordingPermissionsAsync().catch(() => null);
      if (!perm?.granted) {
        if (!cancelled) setError(t('studio.audio.permission'));
        return;
      }
      try {
        await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
        await recorder.prepareToRecordAsync();
        if (!cancelled) recorder.record();
      } catch {
        if (!cancelled) setError(t('studio.audio.failed'));
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const stop = async (keep: boolean) => {
    setBusy(true);
    const seconds = Math.round((state.durationMillis ?? 0) / 1000);
    try {
      if (recorder.isRecording) await recorder.stop();
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }).catch(() => {});
      if (keep && recorder.uri) {
        const uri = await keepAudioFile(recorder.uri, 'idea.m4a');
        onSaved(uri, Math.max(1, seconds));
      } else onClose();
    } catch {
      setError(t('studio.audio.failed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => stop(false)}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <T variant="label" color={colors.danger}>
            {state.isRecording ? `● ${t('studio.audio.recording')}` : t('studio.audio.record')}
          </T>
          <T variant="display">{formatDuration((state.durationMillis ?? 0) / 1000)}</T>
          {error ? <Banner tone="danger" icon="alert-circle" text={error} /> : null}
          <View style={styles.row2}>
            <Button label={t('common.cancel')} variant="secondary" onPress={() => stop(false)} style={{ flex: 1 }} />
            <Button
              label={t('studio.audio.stopSave')}
              icon="stop"
              onPress={() => stop(true)}
              disabled={!state.isRecording}
              loading={busy}
              style={{ flex: 1 }}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  row2: { flexDirection: 'row', gap: space.md },
  row3: { flexDirection: 'row', gap: space.sm },
  assetCard: { gap: space.sm, padding: space.md },
  assetHead: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  play: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bar: { height: 4, borderRadius: 2, backgroundColor: colors.border, overflow: 'hidden' },
  barFill: { height: 4, backgroundColor: colors.gold },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg * 1.5,
    borderTopRightRadius: radius.lg * 1.5,
    padding: space.xl,
    paddingBottom: space.xxl,
    alignItems: 'center',
    gap: space.lg,
  },
});
