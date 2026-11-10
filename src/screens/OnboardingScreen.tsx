import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { EditableAvatar } from '../components/Avatar';
import { ThemePicker } from '../components/ThemePicker';
import { DEMO_ONLY } from '../cloud/config';
import { Banner, Button, Chips, Field, Screen, T, tap, type IconName } from '../components/ui';
import { currencySymbol } from '../lib/format';
import {
  ARTIST_ROLES,
  CURRENCIES,
  LANGUAGES,
  type ArtistRole,
  type Currency,
  type Language,
} from '../lib/types';
import { useAppStore } from '../store/useAppStore';
import { colors, radius, space, themed } from '../theme/tokens';

const ROLE_ICONS: Record<ArtistRole, IconName> = {
  singer: 'mic',
  musician: 'musical-notes',
  dj: 'disc',
  producer: 'options',
  band: 'people',
  manager: 'briefcase',
};

const TOTAL = 4;

export default function OnboardingScreen() {
  const { t, i18n } = useTranslation();
  const completeOnboarding = useAppStore((s) => s.completeOnboarding);
  // Theme preview during onboarding: kept in the store so the whole screen re-renders in the new colours.
  const theme = useAppStore((s) => s.settings.theme ?? 'stage');
  const updateSettings = useAppStore((s) => s.updateSettings);
  const loadDemo = useAppStore((s) => s.loadDemo);
  const [step, setStep] = useState(0);
  const [language, setLanguage] = useState<Language>(i18n.language as Language);
  const [stageName, setStageName] = useState('');
  const [photoUri, setPhotoUri] = useState<string | undefined>();
  const [role, setRole] = useState<ArtistRole>('singer');
  const [genre, setGenre] = useState('');
  const [currency, setCurrency] = useState<Currency>(language === 'ru' ? 'RUB' : 'AZN');

  const chooseLanguage = (l: Language) => {
    tap();
    setLanguage(l);
    i18n.changeLanguage(l);
  };

  const finish = () => {
    completeOnboarding(
      { stageName: stageName.trim(), role, genre: genre.trim(), photoUri },
      { language, currency, appLock: false, theme },
    );
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen edges={['top', 'bottom']} contentStyle={{ flexGrow: 1 }}>
        {step === 0 ? (
          <View style={styles.welcome}>
            <Image source={require('../../assets/icon.png')} style={styles.logo} accessibilityIgnoresInvertColors />
            <T variant="display">VIBE OS</T>
            <T variant="title">{t('onboarding.welcomeTitle')}</T>
            <T color={colors.textMuted}>{t('onboarding.welcomeBody')}</T>

            <View style={{ gap: space.sm, marginTop: space.lg }}>
              <T variant="label">{t('onboarding.chooseLanguage')}</T>
              {LANGUAGES.map((l) => {
                const active = l === language;
                return (
                  <Pressable
                    key={l}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: active }}
                    onPress={() => chooseLanguage(l)}
                    style={[styles.langRow, active && styles.langRowActive]}
                  >
                    <T variant="bodyLg">{t(`languages.${l}`)}</T>
                    <Ionicons
                      name={active ? 'radio-button-on' : 'radio-button-off'}
                      size={22}
                      color={active ? colors.gold : colors.textFaint}
                    />
                  </Pressable>
                );
              })}
            </View>
            <View style={{ flex: 1 }} />
            {DEMO_ONLY ? null : <Button label={t('common.next')} icon="arrow-forward" onPress={() => setStep(1)} />}
            <Button
              label={t('demo.open')}
              icon="play-circle"
              variant={DEMO_ONLY ? 'primary' : 'secondary'}
              onPress={() => loadDemo(language, theme)}
            />
            <T variant="caption" style={{ textAlign: 'center' }}>
              {t('demo.openHint')}
            </T>
          </View>
        ) : (
          <View style={{ flex: 1, gap: space.lg }}>
            <View style={styles.progressRow}>
              {Array.from({ length: TOTAL }).map((_, i) => (
                <View key={i} style={[styles.progress, i < step && { backgroundColor: colors.gold }]} />
              ))}
            </View>
            <T variant="caption">{t('onboarding.step', { n: step, total: TOTAL })}</T>

            {step === 1 && (
              <>
                <T variant="h1">{t('onboarding.nameTitle')}</T>
                <View style={{ alignItems: 'center', gap: space.sm }}>
                  <EditableAvatar name={stageName || '?'} uri={photoUri} size={104} onChange={setPhotoUri} />
                  <T variant="caption">
                    {photoUri ? t('profile.changePhoto') : `${t('profile.addPhoto')} · ${t('common.optional')}`}
                  </T>
                </View>
                <Field
                  label={t('onboarding.nameTitle')}
                  value={stageName}
                  onChangeText={setStageName}
                  placeholder={t('onboarding.namePlaceholder')}
                  hint={t('onboarding.nameHint')}
                  autoFocus
                  maxLength={60}
                  returnKeyType="next"
                  onSubmitEditing={() => stageName.trim() && setStep(2)}
                />
              </>
            )}

            {step === 2 && (
              <>
                <T variant="h1">{t('onboarding.roleTitle')}</T>
                <Chips
                  value={role}
                  onChange={setRole}
                  options={ARTIST_ROLES.map((r) => ({ value: r, label: t(`roles.${r}`), icon: ROLE_ICONS[r] }))}
                />
                <Field
                  label={t('onboarding.genreLabel')}
                  optional
                  optionalLabel={t('common.optional')}
                  value={genre}
                  onChangeText={setGenre}
                  placeholder={t('onboarding.genrePlaceholder')}
                  maxLength={60}
                />
              </>
            )}

            {step === 3 && (
              <>
                <T variant="h1">{t('onboarding.currencyTitle')}</T>
                <T color={colors.textMuted}>{t('onboarding.currencyHint')}</T>
                <Chips
                  value={currency}
                  onChange={setCurrency}
                  options={CURRENCIES.map((c) => ({ value: c, label: `${currencySymbol(c)}  ${c}` }))}
                />
                <Banner text={t('onboarding.privacy')} />
              </>
            )}

            {step === 4 && (
              <>
                <T variant="h1">{t('onboarding.themeTitle')}</T>
                <T color={colors.textMuted}>{t('onboarding.themeHint')}</T>
                <ThemePicker value={theme} onChange={(id) => updateSettings({ theme: id })} />
              </>
            )}

            <View style={{ flex: 1 }} />
            <View style={styles.footer}>
              <Button
                label={t('common.back')}
                variant="secondary"
                onPress={() => setStep((s) => s - 1)}
                style={{ flex: 1 }}
              />
              {step < TOTAL ? (
                <Button
                  label={t('common.next')}
                  icon="arrow-forward"
                  disabled={step === 1 && !stageName.trim()}
                  onPress={() => setStep((s) => s + 1)}
                  style={{ flex: 2 }}
                />
              ) : (
                <Button label={t('onboarding.start')} icon="sparkles" onPress={finish} style={{ flex: 2 }} />
              )}
            </View>
          </View>
        )}
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = themed(() =>
  StyleSheet.create({
  welcome: { flex: 1, gap: space.md, paddingTop: space.xl },
  logo: {
    width: 76,
    height: 76,
    borderRadius: 20,
    marginBottom: space.sm,
  },
  langRow: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.lg,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  langRowActive: { borderColor: colors.gold, backgroundColor: colors.goldSoft },
  progressRow: { flexDirection: 'row', gap: space.sm, marginTop: space.sm },
  progress: { flex: 1, height: 4, borderRadius: 2, backgroundColor: colors.border },
  footer: { flexDirection: 'row', gap: space.md },
  }),
);
