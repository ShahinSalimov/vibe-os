import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors, radius, space, THEME_IDS, THEMES, themed, type ThemeId } from '../theme/tokens';
import { T, tap } from './ui';

/** Theme cards with a mini preview drawn in each theme's own colours. */
export function ThemePicker({ value, onChange }: { value: ThemeId; onChange: (t: ThemeId) => void }) {
  const { t } = useTranslation();
  return (
    <View style={styles.grid}>
      {THEME_IDS.map((id) => {
        const p = THEMES[id];
        const active = id === value;
        return (
          <Pressable
            key={id}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            accessibilityLabel={t(`themes.${id}.name`)}
            onPress={() => {
              tap();
              onChange(id);
            }}
            style={[styles.card, active && { borderColor: colors.gold, borderWidth: 2 }]}
          >
            {/* preview: background, a card, the accent button */}
            <View style={[styles.preview, { backgroundColor: p.bg }]}>
              <View style={[styles.previewCard, { backgroundColor: p.surface, borderColor: p.border }]}>
                <View style={[styles.line, { backgroundColor: p.text, width: '70%' }]} />
                <View style={[styles.line, { backgroundColor: p.textMuted, width: '45%' }]} />
              </View>
              <View style={styles.previewRow}>
                <View style={[styles.pill, { backgroundColor: p.gold }]} />
                <View style={[styles.dot, { backgroundColor: p.violet }]} />
              </View>
              {active ? (
                <View style={[styles.check, { backgroundColor: p.gold }]}>
                  <Ionicons name="checkmark" size={14} color={p.onGold} />
                </View>
              ) : null}
            </View>
            <View style={{ padding: space.sm, gap: 2 }}>
              <T variant="bodyLg" numberOfLines={1}>
                {t(`themes.${id}.name`)}
              </T>
              <T variant="caption" numberOfLines={2}>
                {t(`themes.${id}.desc`)}
              </T>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
    card: {
      width: '47.5%',
      borderRadius: radius.lg,
      overflow: 'hidden',
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    preview: { height: 92, padding: space.sm, gap: 6, justifyContent: 'center' },
    previewCard: { borderRadius: 8, borderWidth: 1, padding: 8, gap: 5 },
    line: { height: 5, borderRadius: 3 },
    previewRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    pill: { height: 14, width: 44, borderRadius: 7 },
    dot: { height: 14, width: 14, borderRadius: 7 },
    check: {
      position: 'absolute',
      top: 8,
      right: 8,
      width: 22,
      height: 22,
      borderRadius: 11,
      alignItems: 'center',
      justifyContent: 'center',
    },
  }),
);
