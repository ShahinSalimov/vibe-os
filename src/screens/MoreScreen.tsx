import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import * as LocalAuthentication from 'expo-local-authentication';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React from 'react';
import { Pressable } from 'react-native';
import type { RootStackParamList } from '../navigation/types';
import { Platform, StyleSheet, Switch, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { EditableAvatar } from '../components/Avatar';
import { Button, Card, Chips, Screen, SectionHeader, T, type IconName } from '../components/ui';
import { confirmAction, notify } from '../lib/confirm';
import { currencySymbol } from '../lib/format';
import { CURRENCIES, LANGUAGES, type Language } from '../lib/types';
import { requestReminderPermission } from '../notify/scheduler';
import { useAppStore } from '../store/useAppStore';
import { colors, space } from '../theme/tokens';

const NEXT_MODULES: { key: string; icon: IconName }[] = [
  { key: 'moduleTeam', icon: 'people' },
  { key: 'moduleRider', icon: 'list' },
  { key: 'moduleAI', icon: 'sparkles' },
];

export default function MoreScreen() {
  const { t, i18n } = useTranslation();
  const profile = useAppStore((s) => s.profile);
  const settings = useAppStore((s) => s.settings);
  const updateSettings = useAppStore((s) => s.updateSettings);
  const updateProfile = useAppStore((s) => s.updateProfile);
  const resetAll = useAppStore((s) => s.resetAll);
  const cloudEmail = useAppStore((s) => s.cloud.email);
  const contactsCount = useAppStore((s) => s.contacts.length);
  const songsCount = useAppStore((s) => s.songs.length);
  const membersCount = useAppStore((s) => s.members.length);
  const openTasks = useAppStore((s) => s.tasks.filter((x) => !x.done).length);
  const docsCount = useAppStore((s) => s.contracts.length + s.docs.length);
  const reminders = useAppStore((s) => s.reminders);
  const setReminders = useAppStore((s) => s.setReminders);

  const toggleReminders = async (on: boolean) => {
    if (!on) return setReminders(false);
    if (Platform.OS === 'web') return notify(t('more.reminders'), t('more.remindersDenied'));
    const ok = await requestReminderPermission();
    if (ok) setReminders(true);
    else notify(t('more.reminders'), t('more.remindersDenied'));
  };
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

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
        <EditableAvatar
          name={profile?.stageName}
          uri={profile?.photoUri}
          size={64}
          onChange={(photoUri) => updateProfile({ photoUri })}
        />
        <View style={{ flex: 1 }}>
          <T variant="title" numberOfLines={1}>
            {profile?.stageName}
          </T>
          <T variant="caption">
            {[profile ? t(`roles.${profile.role}`) : '', profile?.genre].filter(Boolean).join(' · ')}
          </T>
        </View>
      </Card>

      <Card style={{ gap: 0, paddingVertical: space.xs }}>
        <NavRow
          icon="musical-notes"
          iconColor={colors.gold}
          label={t('more.studio')}
          value={songsCount ? String(songsCount) : ''}
          onPress={() => nav.navigate('Studio')}
        />
        <NavRow
          icon="people-circle"
          label={t('more.team')}
          value={membersCount > 1 ? String(membersCount) : ''}
          onPress={() => nav.navigate('Team')}
        />
        <NavRow
          icon="checkbox"
          label={t('more.tasks')}
          value={openTasks ? String(openTasks) : ''}
          onPress={() => nav.navigate('Tasks')}
        />
        <NavRow
          icon="document-text"
          label={t('more.documents')}
          value={docsCount ? String(docsCount) : ''}
          onPress={() => nav.navigate('Documents')}
        />
        <NavRow
          icon={cloudEmail ? 'cloud-done' : 'cloud-upload'}
          iconColor={cloudEmail ? colors.success : colors.gold}
          label={t('more.account')}
          value={cloudEmail ?? ''}
          onPress={() => nav.navigate('Account')}
        />
        <NavRow icon="people" label={t('more.contacts')} value={contactsCount ? String(contactsCount) : ''} onPress={() => nav.navigate('Contacts')} />
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
          <Ionicons name="notifications" size={24} color={colors.gold} />
          <View style={{ flex: 1 }}>
            <T variant="bodyLg">{t('more.reminders')}</T>
            <T variant="caption">{t('more.remindersBody')}</T>
          </View>
          <Switch
            value={reminders}
            onValueChange={toggleReminders}
            trackColor={{ true: colors.gold, false: colors.border }}
            thumbColor={colors.text}
          />
        </View>
      </Card>

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

function NavRow({
  icon,
  label,
  value,
  onPress,
  iconColor = colors.violet,
}: {
  icon: IconName;
  label: string;
  value: string;
  onPress: () => void;
  iconColor?: string;
}) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.navRow, pressed && { opacity: 0.7 }]}>
      <Ionicons name={icon} size={22} color={iconColor} />
      <T variant="bodyLg" style={{ flex: 1 }}>
        {label}
      </T>
      <T variant="caption" numberOfLines={1} style={{ maxWidth: 160 }}>
        {value}
      </T>
      <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  navRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 56 },
  profile: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  moduleRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 48 },
});
