import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import * as LocalAuthentication from 'expo-local-authentication';
import React from 'react';
import { Platform, StyleSheet, Switch, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button, Card, Chips, Screen, SectionHeader, T, type IconName } from '../components/ui';
import { confirmAction, notify } from '../lib/confirm';
import { currencySymbol } from '../lib/format';
import { CURRENCIES, LANGUAGES, type Language } from '../lib/types';
import { useAppStore } from '../store/useAppStore';
import { colors, space } from '../theme/tokens';

const NEXT_MODULES: { key: string; icon: IconName }[] = [
  { key: 'moduleBooking', icon: 'link' },
  { key: 'moduleContracts', icon: 'document-text' },
  { key: 'moduleTeam', icon: 'people' },
  { key: 'moduleRider', icon: 'list' },
  { key: 'moduleAI', icon: 'sparkles' },
];

export default function MoreScreen() {
  const { t, i18n } = useTranslation();
  const profile = useAppStore((s) => s.profile);
  const settings = useAppStore((s) => s.settings);
  const updateSettings = useAppStore((s) => s.updateSettings);
  const resetAll = useAppStore((s) => s.resetAll);

  const setLanguage = (l: Language) => {
    updateSettings({ language: l });
    i18n.changeLanguage(l);
  };

  const toggleLock = async (on: boolean) => {
    if (!on) return updateSettings({ appLock: false });
    if (Platform.OS === 'web') return notify(t('more.appLock'), t('more.appLockUnavailable'));
    const level = await LocalAuthentication.getEnrolledLevelAsync();
    if (level === LocalAuthentication.SecurityLevel.NONE) {
      return notify(t('more.appLock'), t('more.appLockUnavailable'));
    }
    const res = await LocalAuthentication.authenticateAsync({ promptMessage: t('lock.prompt') });
    if (res.success) updateSettings({ appLock: true });
  };

  const reset = async () => {
    const ok = await confirmAction({
      title: t('more.resetConfirm'),
      message: t('more.resetBody'),
      confirmLabel: t('common.delete'),
      cancelLabel: t('common.cancel'),
      destructive: true,
    });
    if (ok) resetAll();
  };

  return (
    <Screen>
      <T variant="h1">{t('more.title')}</T>

      <Card style={styles.profile}>
        <View style={styles.avatar}>
          <T variant="h1" color={colors.onGold}>
            {(profile?.stageName ?? '?').charAt(0).toUpperCase()}
          </T>
        </View>
        <View style={{ flex: 1 }}>
          <T variant="title" numberOfLines={1}>
            {profile?.stageName}
          </T>
          <T variant="caption">
            {[profile ? t(`roles.${profile.role}`) : '', profile?.genre].filter(Boolean).join(' · ')}
          </T>
        </View>
      </Card>

      <SectionHeader title={t('more.language')} />
      <Chips
        value={settings.language}
        onChange={setLanguage}
        options={LANGUAGES.map((l) => ({ value: l, label: t(`languages.${l}`) }))}
      />

      <SectionHeader title={t('more.currency')} />
      <Chips
        value={settings.currency}
        onChange={(c) => updateSettings({ currency: c })}
        options={CURRENCIES.map((c) => ({ value: c, label: `${currencySymbol(c)} ${c}` }))}
      />

      <Card>
        <View style={styles.switchRow}>
          <Ionicons name="finger-print" size={24} color={colors.gold} />
          <View style={{ flex: 1 }}>
            <T variant="bodyLg">{t('more.appLock')}</T>
            <T variant="caption">{t('more.appLockBody')}</T>
          </View>
          <Switch
            value={settings.appLock}
            onValueChange={toggleLock}
            trackColor={{ true: colors.gold, false: colors.border }}
            thumbColor={colors.text}
          />
        </View>
      </Card>

      <Card style={{ backgroundColor: colors.violetSoft, borderColor: 'transparent' }}>
        <View style={styles.switchRow}>
          <Ionicons name="shield-checkmark" size={24} color={colors.violet} />
          <View style={{ flex: 1 }}>
            <T variant="bodyLg">{t('more.privacyTitle')}</T>
            <T variant="caption" color={colors.text}>
              {t('more.privacyBody')}
            </T>
          </View>
        </View>
      </Card>

      <SectionHeader title={t('more.modules')} />
      <Card style={{ gap: 0, paddingVertical: space.sm }}>
        {NEXT_MODULES.map((m) => (
          <View key={m.key} style={styles.moduleRow}>
            <Ionicons name={m.icon} size={20} color={colors.textMuted} />
            <T style={{ flex: 1 }}>{t(`more.${m.key}`)}</T>
            <T variant="caption" color={colors.textFaint}>
              {t('common.comingSoon')}
            </T>
          </View>
        ))}
      </Card>

      <Button label={t('more.resetTitle')} icon="trash" variant="danger" onPress={reset} />
      <T variant="caption" style={{ textAlign: 'center' }} color={colors.textFaint}>
        VIBE OS · {t('more.version', { v: Constants.expoConfig?.version ?? '1.0.0' })}
      </T>
    </Screen>
  );
}

const styles = StyleSheet.create({
  profile: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  moduleRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 48 },
});
