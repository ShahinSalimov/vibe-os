import { Ionicons } from '@expo/vector-icons';
import * as LocalAuthentication from 'expo-local-authentication';
import React, { useCallback, useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button, T } from '../components/ui';
import { colors, space } from '../theme/tokens';

export default function LockScreen({ onUnlock }: { onUnlock: () => void }) {
  const { t } = useTranslation();

  const unlock = useCallback(async () => {
    const res = await LocalAuthentication.authenticateAsync({
      promptMessage: t('lock.prompt'),
      disableDeviceFallback: false, // device PIN allowed as fallback
    });
    if (res.success) onUnlock();
  }, [onUnlock, t]);

  useEffect(() => {
    unlock();
  }, [unlock]);

  return (
    <View style={styles.root}>
      <View style={styles.icon}>
        <Ionicons name="lock-closed" size={36} color={colors.onGold} />
      </View>
      <T variant="title">{t('lock.title')}</T>
      <Button label={t('lock.unlock')} icon="finger-print" onPress={unlock} style={{ alignSelf: 'stretch' }} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFill,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.lg,
    padding: space.xxl,
  },
  icon: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
