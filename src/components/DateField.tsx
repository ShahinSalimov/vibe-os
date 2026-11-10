import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { formatDate, MONTHS, parseISODate, toISODate, WEEKDAYS } from '../lib/format';
import type { ISODate, Language } from '../lib/types';
import { colors, font, radius, space, TAP } from '../theme/tokens';
import { Button, T, tap } from './ui';

/**
 * Cross-platform date picker (identical on iOS, Android and web), localized
 * month/weekday names, Monday-first. Optional dots mark days that already have events.
 */
export function DateField({
  label,
  value,
  onChange,
  markedDates,
}: {
  label: string;
  value: ISODate;
  onChange: (d: ISODate) => void;
  markedDates?: Set<ISODate>;
}) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language as Language;
  const [open, setOpen] = useState(false);
  const initial = parseISODate(value);
  const [cursor, setCursor] = useState({ y: initial.y, m: initial.m });
  const today = toISODate(new Date());

  const cells = useMemo(() => {
    const first = new Date(cursor.y, cursor.m, 1);
    const offset = (first.getDay() + 6) % 7; // Monday-first
    const days = new Date(cursor.y, cursor.m + 1, 0).getDate();
    const out: (ISODate | null)[] = Array(offset).fill(null);
    for (let d = 1; d <= days; d++) out.push(toISODate(new Date(cursor.y, cursor.m, d)));
    while (out.length % 7) out.push(null);
    return out;
  }, [cursor]);

  const shift = (delta: number) => {
    tap();
    setCursor((c) => {
      const d = new Date(c.y, c.m + delta, 1);
      return { y: d.getFullYear(), m: d.getMonth() };
    });
  };

  return (
    <View style={{ gap: space.xs + 2 }}>
      <T variant="caption" color={colors.textMuted}>
        {label}
      </T>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${formatDate(value, lang)}`}
        onPress={() => {
          const p = parseISODate(value);
          setCursor({ y: p.y, m: p.m });
          setOpen(true);
        }}
        style={styles.trigger}
      >
        <Ionicons name="calendar-outline" size={20} color={colors.gold} />
        <Text style={styles.triggerText}>{formatDate(value, lang)}</Text>
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <T variant="label">{t('calendar.pick')}</T>
            <View style={styles.header}>
              <Pressable onPress={() => shift(-1)} hitSlop={12} style={styles.nav} accessibilityLabel="previous month">
                <Ionicons name="chevron-back" size={22} color={colors.text} />
              </Pressable>
              <T variant="bodyLg">
                {MONTHS[lang].nom[cursor.m]} {cursor.y}
              </T>
              <Pressable onPress={() => shift(1)} hitSlop={12} style={styles.nav} accessibilityLabel="next month">
                <Ionicons name="chevron-forward" size={22} color={colors.text} />
              </Pressable>
            </View>
            <View style={styles.grid}>
              {WEEKDAYS[lang].map((w) => (
                <Text key={w} style={styles.weekday}>
                  {w}
                </Text>
              ))}
              {cells.map((d, i) => {
                if (!d) return <View key={`e${i}`} style={styles.cell} />;
                const selected = d === value;
                const isToday = d === today;
                return (
                  <Pressable
                    key={d}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    onPress={() => {
                      tap();
                      onChange(d);
                      setOpen(false);
                    }}
                    style={[styles.cell, selected && styles.cellSelected, !selected && isToday && styles.cellToday]}
                  >
                    <Text style={[styles.cellText, selected && { color: colors.onGold, fontWeight: '800' }]}>
                      {Number(d.slice(8))}
                    </Text>
                    {markedDates?.has(d) ? (
                      <View style={[styles.dot, selected && { backgroundColor: colors.onGold }]} />
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
            <Button
              label={t('common.today')}
              variant="secondary"
              onPress={() => {
                onChange(today);
                setOpen(false);
              }}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  trigger: {
    minHeight: TAP,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: space.lg,
  },
  triggerText: { color: colors.text, fontSize: font.body, fontWeight: '600' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: space.lg },
  sheet: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: space.lg,
    gap: space.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    maxWidth: 420,
    width: '100%',
    alignSelf: 'center',
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  nav: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  weekday: {
    width: `${100 / 7}%`,
    textAlign: 'center',
    color: colors.textFaint,
    fontSize: font.caption,
    fontWeight: '700',
    paddingVertical: space.xs,
  },
  cell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
  },
  cellSelected: { backgroundColor: colors.gold },
  cellToday: { borderWidth: 1, borderColor: colors.gold },
  cellText: { color: colors.text, fontSize: font.body },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.violet, position: 'absolute', bottom: 6 },
});
