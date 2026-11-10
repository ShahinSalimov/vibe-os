import { Ionicons } from '@expo/vector-icons';
import * as LocalAuthentication from 'expo-local-authentication';
import React, { useCallback, useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Avatar } from '../components/Avatar';
import { Button, T } from '../components/ui';
import { useAppStore } from '../store/useAppStore';
import { colors, space } from '../theme/tokens';

export default function LockScreen({ onUnlock }: { onUnlock: () => void }) {
  const { t } = useTranslation();
  const profile = useAppStore((s) => s.profile);

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
      {profile ? (
        <View>
          <Avatar name={profile.stageName} uri={profile.photoUri} size={96} />
          <View style={styles.lockBadge}>
            <Ionicons name="lock-closed" size={16} color={colors.onGold} />
          </View>
        </View>
      ) : (
        <View style={styles.icon}>
          <Ionicons name="lock-closed" size={36} color={colors.onGold} />
        </View>
      )}
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
  lockBadge: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.gold,
    borderWidth: 3,
    borderColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
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
