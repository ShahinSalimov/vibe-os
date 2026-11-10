import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { T, tap } from '../components/ui';
import { DEMO_ONLY, SELLER_CONTACT_URL } from '../cloud/config';
import { confirmAction, notify } from '../lib/confirm';
import { useAppStore } from '../store/useAppStore';
import { colors, radius, space, themed } from '../theme/tokens';

/** Shown while the sample data is loaded: one tap to leave the demo and start for real. */
export function DemoBanner() {
  const { t } = useTranslation();
  const demo = useAppStore((s) => !!s.settings.demo);
  const resetAll = useAppStore((s) => s.resetAll);
  const theme = useAppStore((s) => s.settings.theme);
  const updateSettings = useAppStore((s) => s.updateSettings);
  if (!demo) return null;
  const exit = async () => {
    if (DEMO_ONLY) {
      const contact = SELLER_CONTACT_URL.replace(/^https?:\/\//, '');
      notify(t('demo.fullTitle'), contact ? `${t('demo.fullBody')}\n\n${t('demo.contactLabel', { contact })}` : t('demo.fullBody'));
      return;
    }
    const ok = await confirmAction({
      title: t('demo.exitTitle'),
      message: t('demo.exitBody'),
      confirmLabel: t('demo.start'),
      cancelLabel: t('common.cancel'),
    });
    if (!ok) return;
    resetAll();
    if (theme) updateSettings({ theme });
  };
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => {
        tap();
        exit();
      }}
      accessibilityLabel={t('demo.start')}
      style={({ pressed }) => [styles.box, pressed && { opacity: 0.85 }]}
    >
      <Ionicons name="play-circle" size={20} color={colors.violet} />
      <View style={{ flex: 1 }}>
        <T variant="bodyLg">{t('demo.banner')}</T>
        <T variant="caption">{t('demo.bannerBody')}</T>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.violet} />
    </Pressable>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    box: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.sm,
      padding: space.md,
      borderRadius: radius.md,
      backgroundColor: colors.violetSoft,
      borderWidth: 1,
      borderColor: colors.violet + '55',
    },
  }),
);
