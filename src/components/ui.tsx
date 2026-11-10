import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { colors, font, radius, space, TAP } from '../theme/tokens';

export type IconName = React.ComponentProps<typeof Ionicons>['name'];

export function tap() {
  if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
}

// ---------- Layout ----------

export function Screen({
  children,
  scroll = true,
  edges = ['top'],
  contentStyle,
}: {
  children: React.ReactNode;
  scroll?: boolean;
  edges?: Edge[];
  contentStyle?: StyleProp<ViewStyle>;
}) {
  return (
    <SafeAreaView style={styles.screen} edges={edges}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={[styles.screenContent, contentStyle]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.screenContent, { flex: 1 }, contentStyle]}>{children}</View>
      )}
    </SafeAreaView>
  );
}

export function T({
  children,
  variant = 'body',
  color,
  style,
  numberOfLines,
  selectable,
}: {
  children: React.ReactNode;
  selectable?: boolean;
  variant?: 'display' | 'h1' | 'title' | 'bodyLg' | 'body' | 'caption' | 'label';
  color?: string;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
}) {
  return (
    <Text numberOfLines={numberOfLines} selectable={selectable} style={[textStyles[variant], color ? { color } : null, style]}>
      {children}
    </Text>
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function SectionHeader({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <View style={styles.sectionHeader}>
      <T variant="label">{title}</T>
      {action && onAction ? (
        <Pressable onPress={onAction} hitSlop={12} accessibilityRole="button">
          <T variant="caption" color={colors.gold}>
            {action}
          </T>
        </Pressable>
      ) : null}
    </View>
  );
}

// ---------- Buttons ----------

export function Button({
  label,
  onPress,
  variant = 'primary',
  icon,
  disabled,
  loading,
  style,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  icon?: IconName;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const v = buttonVariants[variant];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled || loading}
      onPress={() => {
        tap();
        onPress();
      }}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: v.bg, borderColor: v.border },
        (pressed || disabled) && { opacity: disabled ? 0.4 : 0.85 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={v.fg} />
      ) : (
        <>
          {icon ? <Ionicons name={icon} size={20} color={v.fg} /> : null}
          <Text style={[styles.buttonText, { color: v.fg }]}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

const buttonVariants = {
  primary: { bg: colors.gold, fg: colors.onGold, border: colors.gold },
  secondary: { bg: colors.surfaceAlt, fg: colors.text, border: colors.border },
  ghost: { bg: 'transparent', fg: colors.textMuted, border: 'transparent' },
  danger: { bg: colors.dangerSoft, fg: colors.danger, border: 'transparent' },
};

export function IconButton({
  icon,
  onPress,
  label,
  color = colors.text,
}: {
  icon: IconName;
  onPress: () => void;
  label: string;
  color?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={() => {
        tap();
        onPress();
      }}
      hitSlop={8}
      style={({ pressed }) => [styles.iconButton, pressed && { opacity: 0.7 }]}
    >
      <Ionicons name={icon} size={22} color={color} />
    </Pressable>
  );
}

// ---------- Inputs ----------

export function Field({
  label,
  error,
  hint,
  optional,
  optionalLabel,
  ...input
}: TextInputProps & { label: string; error?: string; hint?: string; optional?: boolean; optionalLabel?: string }) {
  return (
    <View style={styles.field}>
      <T variant="caption" color={colors.textMuted}>
        {label}
        {optional && optionalLabel ? <T variant="caption" color={colors.textFaint}>{`  ·  ${optionalLabel}`}</T> : null}
      </T>
      <TextInput
        placeholderTextColor={colors.textFaint}
        selectionColor={colors.gold}
        {...input}
        style={[styles.input, input.multiline && styles.inputMultiline, error ? { borderColor: colors.danger } : null]}
      />
      {error ? (
        <T variant="caption" color={colors.danger}>
          {error}
        </T>
      ) : hint ? (
        <T variant="caption" color={colors.textFaint}>
          {hint}
        </T>
      ) : null}
    </View>
  );
}

export function Chips<V extends string>({
  options,
  value,
  onChange,
  wrap = true,
}: {
  options: { value: V; label: string; icon?: IconName }[];
  value: V;
  onChange: (v: V) => void;
  wrap?: boolean;
}) {
  const content = options.map((o) => {
    const active = o.value === value;
    return (
      <Pressable
        key={o.value}
        accessibilityRole="radio"
        accessibilityState={{ selected: active }}
        onPress={() => {
          tap();
          onChange(o.value);
        }}
        style={[styles.chip, active && styles.chipActive]}
      >
        {o.icon ? <Ionicons name={o.icon} size={18} color={active ? colors.onGold : colors.textMuted} /> : null}
        <Text style={[styles.chipText, active && { color: colors.onGold }]}>{o.label}</Text>
      </Pressable>
    );
  });
  if (wrap) return <View style={styles.chipsWrap}>{content}</View>;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
      {content}
    </ScrollView>
  );
}

export function Segmented<V extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: V; label: string }[];
  value: V;
  onChange: (v: V) => void;
}) {
  return (
    <View style={styles.segmented}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() => {
              tap();
              onChange(o.value);
            }}
            style={[styles.segment, active && styles.segmentActive]}
          >
            <Text style={[styles.segmentText, active && { color: colors.text }]} numberOfLines={1}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// ---------- Feedback ----------

export function Banner({
  icon = 'shield-checkmark',
  text,
  tone = 'info',
}: {
  icon?: IconName;
  text: string;
  tone?: 'info' | 'warning' | 'danger';
}) {
  const c = tone === 'danger' ? colors.danger : tone === 'warning' ? colors.warning : colors.violet;
  const bg = tone === 'danger' ? colors.dangerSoft : tone === 'warning' ? colors.goldSoft : colors.violetSoft;
  return (
    <View style={[styles.banner, { backgroundColor: bg }]}>
      <Ionicons name={icon} size={18} color={c} />
      <T variant="caption" color={colors.text} style={{ flex: 1 }}>
        {text}
      </T>
    </View>
  );
}

export function EmptyState({
  icon,
  title,
  body,
  action,
  onAction,
}: {
  icon: IconName;
  title: string;
  body: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Ionicons name={icon} size={32} color={colors.gold} />
      </View>
      <T variant="title" style={{ textAlign: 'center' }}>
        {title}
      </T>
      <T color={colors.textMuted} style={{ textAlign: 'center' }}>
        {body}
      </T>
      {action && onAction ? <Button label={action} icon="add" onPress={onAction} style={{ alignSelf: 'stretch' }} /> : null}
    </View>
  );
}

// ---------- Styles ----------

const textStyles = StyleSheet.create({
  display: { fontSize: font.display, fontWeight: '800', color: colors.text, letterSpacing: -0.5 },
  h1: { fontSize: font.h1, fontWeight: '800', color: colors.text, letterSpacing: -0.3 },
  title: { fontSize: font.title, fontWeight: '700', color: colors.text },
  bodyLg: { fontSize: font.bodyLg, fontWeight: '600', color: colors.text },
  body: { fontSize: font.body, color: colors.text, lineHeight: 22 },
  caption: { fontSize: font.caption, color: colors.textMuted, lineHeight: 18 },
  label: {
    fontSize: font.caption,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
});

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  screenContent: { padding: space.lg, gap: space.lg, paddingBottom: space.xxl * 2 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: space.lg,
    gap: space.md,
  },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: space.sm },
  button: {
    minHeight: TAP,
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: space.xl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
  },
  buttonText: { fontSize: font.body, fontWeight: '700' },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceAlt,
  },
  field: { gap: space.xs + 2 },
  input: {
    minHeight: TAP,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: space.lg,
    color: colors.text,
    fontSize: font.body,
  },
  inputMultiline: { minHeight: 96, paddingTop: space.md, textAlignVertical: 'top' },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 44,
    paddingHorizontal: space.lg,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: { backgroundColor: colors.gold, borderColor: colors.gold },
  chipText: { color: colors.text, fontSize: font.body, fontWeight: '600' },
  segmented: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  segment: { flex: 1, minHeight: 40, alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm },
  segmentActive: { backgroundColor: colors.surfaceAlt },
  segmentText: { color: colors.textMuted, fontWeight: '600', fontSize: font.body },
  banner: {
    flexDirection: 'row',
    gap: space.sm,
    alignItems: 'center',
    padding: space.md,
    borderRadius: radius.md,
  },
  empty: { alignItems: 'center', gap: space.md, paddingVertical: space.xxl, paddingHorizontal: space.lg },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.goldSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.sm,
  },
});
