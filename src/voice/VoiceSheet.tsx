import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Modal, Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button, T, tap } from '../components/ui';
import type { Language } from '../lib/types';
import { colors, radius, space } from '../theme/tokens';
import { useSpeech, type SpeechError } from './useSpeech';

/**
 * Full-screen listening sheet. mode "command": shows examples of whole sentences
 * ("15 Dec wedding in Baku, 3000 manat"); mode "dictate": plain text for a field.
 */
export function VoiceSheet({
  visible,
  mode,
  onClose,
  onResult,
}: {
  visible: boolean;
  mode: 'command' | 'dictate';
  onClose: () => void;
  onResult: (text: string) => void;
}) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language as Language;
  const sp = useSpeech(lang);
  const pulse = useRef(new Animated.Value(0)).current;

  // auto-start when opened
  useEffect(() => {
    if (visible) sp.start();
    else sp.cancel();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // auto-finish on final result
  useEffect(() => {
    if (visible && sp.final && sp.transcript.trim()) {
      const text = sp.transcript.trim();
      onResult(text);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sp.final]);

  useEffect(() => {
    if (!sp.listening) {
      pulse.stopAnimation();
      pulse.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.timing(pulse, { toValue: 1, duration: 1200, easing: Easing.out(Easing.quad), useNativeDriver: true }),
    );
    loop.start();
    return () => loop.stop();
  }, [sp.listening, pulse]);

  const errorText = (e: SpeechError) => t(`voice.errors.${e === 'no-speech' ? 'noSpeech' : e}`, { lang: t(`languages.${lang}`) });
  const examples = t('voice.examples', { returnObjects: true }) as string[];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <T variant="label" color={colors.gold}>
            {sp.listening ? t('voice.listening') : t('voice.title')}
          </T>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={sp.listening ? t('voice.stop') : t('voice.tapToSpeak')}
            onPress={() => {
              tap();
              if (sp.listening) sp.stop();
              else sp.start();
            }}
            style={styles.micWrap}
          >
            <Animated.View
              style={[
                styles.pulse,
                {
                  opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] }),
                  transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.8] }) }],
                },
              ]}
            />
            <View style={[styles.mic, !sp.listening && { backgroundColor: colors.surfaceAlt }]}>
              <Ionicons name={sp.listening ? 'mic' : 'mic-outline'} size={44} color={sp.listening ? colors.onGold : colors.gold} />
            </View>
          </Pressable>

          {sp.transcript ? (
            <T variant="title" style={styles.transcript}>
              “{sp.transcript}”
            </T>
          ) : sp.error ? (
            <T color={colors.danger} style={{ textAlign: 'center' }}>
              {errorText(sp.error)}
            </T>
          ) : mode === 'command' ? (
            <View style={{ gap: space.xs, alignSelf: 'stretch' }}>
              <T variant="caption" style={{ textAlign: 'center' }}>
                {t('voice.hint')}
              </T>
              {examples.map((ex) => (
                <T key={ex} color={colors.textMuted} style={{ textAlign: 'center' }}>
                  “{ex}”
                </T>
              ))}
            </View>
          ) : (
            <T variant="caption" style={{ textAlign: 'center' }}>
              {t('voice.dictateHint')}
            </T>
          )}

          <View style={styles.buttons}>
            <Button label={t('common.cancel')} variant="secondary" onPress={onClose} style={{ flex: 1 }} />
            {sp.transcript && !sp.listening ? (
              <Button label={t('voice.use')} icon="checkmark" onPress={() => onResult(sp.transcript.trim())} style={{ flex: 1 }} />
            ) : sp.listening ? (
              <Button label={t('voice.stop')} icon="stop" onPress={sp.stop} style={{ flex: 1 }} />
            ) : (
              <Button label={t('voice.again')} icon="mic" onPress={sp.start} style={{ flex: 1 }} />
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg * 1.5,
    borderTopRightRadius: radius.lg * 1.5,
    padding: space.xl,
    paddingBottom: space.xxl,
    alignItems: 'center',
    gap: space.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  micWrap: { width: 140, height: 140, alignItems: 'center', justifyContent: 'center' },
  pulse: { position: 'absolute', width: 100, height: 100, borderRadius: 50, backgroundColor: colors.gold },
  mic: { width: 100, height: 100, borderRadius: 50, backgroundColor: colors.gold, alignItems: 'center', justifyContent: 'center' },
  transcript: { textAlign: 'center' },
  buttons: { flexDirection: 'row', gap: space.md, alignSelf: 'stretch' },
});
