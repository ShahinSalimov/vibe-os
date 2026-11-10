import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { keepFile, removeFile } from '../studio/files';
import { colors } from '../theme/tokens';
import { tap } from './ui';

/** Profile photo, or the first letter of the stage name on a gold circle. */
export function Avatar({ name, uri, size = 48 }: { name?: string; uri?: string; size?: number }) {
  const r = { width: size, height: size, borderRadius: size / 2 };
  if (uri) return <Image source={{ uri }} style={[r, styles.img]} accessibilityIgnoresInvertColors />;
  return (
    <View style={[r, styles.letter]}>
      <Text style={{ color: colors.onGold, fontSize: size * 0.42, fontWeight: '800' }}>
        {(name ?? '?').trim().charAt(0).toUpperCase() || '?'}
      </Text>
    </View>
  );
}

/** Square photo picker. Returns the stored URI, or undefined if cancelled. */
export async function pickProfilePhoto(previous?: string): Promise<string | undefined> {
  const res = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.7,
  });
  if (res.canceled || !res.assets?.[0]) return undefined;
  const uri = await keepFile(res.assets[0].uri, res.assets[0].fileName ?? 'photo.jpg', 'profile');
  if (previous && previous !== uri) await removeFile(previous);
  return uri;
}

/** Avatar with a small camera badge; tapping opens the photo picker. */
export function EditableAvatar({
  name,
  uri,
  size = 88,
  onChange,
}: {
  name?: string;
  uri?: string;
  size?: number;
  onChange: (uri: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('profile.photo')}
      onPress={async () => {
        tap();
        const next = await pickProfilePhoto(uri).catch(() => undefined);
        if (next) onChange(next);
      }}
      style={{ width: size, height: size }}
    >
      <Avatar name={name} uri={uri} size={size} />
      <View style={styles.badge}>
        <Ionicons name="camera" size={16} color={colors.onGold} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  img: { backgroundColor: colors.surfaceAlt },
  letter: { backgroundColor: colors.gold, alignItems: 'center', justifyContent: 'center' },
  badge: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.gold,
    borderWidth: 2,
    borderColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
