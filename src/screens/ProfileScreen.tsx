import React, { useLayoutEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { EditableAvatar } from '../components/Avatar';
import { Button, Chips, Field, Screen, T, type IconName } from '../components/ui';
import { notify } from '../lib/confirm';
import { detectSensitiveIn } from '../lib/sensitive';
import { ARTIST_ROLES, type ArtistRole } from '../lib/types';
import type { RootProps } from '../navigation/types';
import { useAppStore } from '../store/useAppStore';
import { colors, space, themed } from '../theme/tokens';

const ROLE_ICONS: Record<ArtistRole, IconName> = {
  singer: 'mic',
  musician: 'musical-notes',
  dj: 'disc',
  producer: 'options',
  band: 'people',
  manager: 'briefcase',
};

/** The artist's own profile: photo, stage name, role, genre. */
export default function ProfileScreen({ navigation }: RootProps<'Profile'>) {
  const { t } = useTranslation();
  const profile = useAppStore((s) => s.profile);
  const updateProfile = useAppStore((s) => s.updateProfile);
  const email = useAppStore((s) => s.cloud.email);
  const [stageName, setStageName] = useState(profile?.stageName ?? '');
  const [role, setRole] = useState<ArtistRole>(profile?.role ?? 'singer');
  const [genre, setGenre] = useState(profile?.genre ?? '');
  const [error, setError] = useState<string | null>(null);

  useLayoutEffect(() => {
    navigation.setOptions({ title: t('profile.title') });
  }, [navigation, t]);

  const save = () => {
    if (!stageName.trim()) return setError(t('onboarding.nameTitle'));
    if (detectSensitiveIn([stageName, genre])) return notify(t('security.blockedTitle'), t('security.blockedCard'));
    updateProfile({ stageName: stageName.trim(), role, genre: genre.trim() });
    navigation.goBack();
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen edges={['bottom']}>
        <View style={styles.photo}>
          {/* the photo is saved immediately when picked */}
          <EditableAvatar
            name={stageName || profile?.stageName}
            uri={profile?.photoUri}
            size={112}
            onChange={(photoUri) => updateProfile({ photoUri })}
          />
          <T variant="caption">{profile?.photoUri ? t('profile.changePhoto') : t('profile.addPhoto')}</T>
          {email ? (
            <T variant="caption" color={colors.textFaint}>
              {email}
            </T>
          ) : null}
        </View>
        <Field
          label={t('onboarding.nameTitle')}
          value={stageName}
          onChangeText={(v) => {
            setStageName(v);
            setError(null);
          }}
          error={error ?? undefined}
          hint={t('onboarding.nameHint')}
          maxLength={60}
        />
        <View style={{ gap: space.sm }}>
          <T variant="caption">{t('onboarding.roleTitle')}</T>
          <Chips value={role} onChange={setRole} options={ARTIST_ROLES.map((r) => ({ value: r, label: t(`roles.${r}`), icon: ROLE_ICONS[r] }))} />
        </View>
        <Field
          label={t('onboarding.genreLabel')}
          optional
          optionalLabel={t('common.optional')}
          value={genre}
          onChangeText={setGenre}
          placeholder={t('onboarding.genrePlaceholder')}
          maxLength={60}
        />
        <Button label={t('common.save')} icon="checkmark" onPress={save} />
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    photo: { alignItems: 'center', gap: space.sm, paddingVertical: space.md },
  }),
);
