import { Ionicons } from '@expo/vector-icons';
import React, { useLayoutEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button, Card, Chips, Field, Screen, T, tap } from '../../components/ui';
import { riderHtml } from '../../docs/html';
import { defaultRiderSections, RIDER_TITLES } from '../../docs/riderDefaults';
import { sharePdf } from '../../docs/share';
import { confirmAction, notify } from '../../lib/confirm';
import { newId } from '../../lib/id';
import { detectSensitiveIn } from '../../lib/sensitive';
import { LANGUAGES, type Language, type RiderSection } from '../../lib/types';
import type { RootProps } from '../../navigation/types';
import { useAppStore } from '../../store/useAppStore';
import { colors, font, radius, space } from '../../theme/tokens';

export default function RiderScreen({ route, navigation }: RootProps<'Rider'>) {
  const { t, i18n } = useTranslation();
  const kind = route.params.kind;
  const existing = useAppStore((s) => s.riders.find((r) => r.kind === kind));
  const profile = useAppStore((s) => s.profile);
  const saveRider = useAppStore((s) => s.saveRider);
  const deleteRider = useAppStore((s) => s.deleteRider);

  const startLang = (existing?.language ?? i18n.language) as Language;
  const [language, setLanguage] = useState<Language>(startLang);
  const [sections, setSections] = useState<RiderSection[]>(existing?.sections ?? defaultRiderSections(kind, startLang));
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [dirty, setDirty] = useState(!existing);

  useLayoutEffect(() => {
    navigation.setOptions({ title: t(`riders.${kind}`) });
  }, [navigation, t, kind]);

  const update = (fn: (s: RiderSection[]) => RiderSection[]) => {
    setSections((cur) => fn(cur.map((x) => ({ ...x, items: [...x.items] }))));
    setDirty(true);
  };

  // Switching language on an untouched new rider swaps in the defaults of that language.
  const changeLanguage = (l: Language) => {
    setLanguage(l);
    if (!existing && !dirtyItems()) setSections(defaultRiderSections(kind, l));
  };
  const dirtyItems = () => JSON.stringify(sections) !== JSON.stringify(defaultRiderSections(kind, language));

  const persist = (): boolean => {
    const clean = sections
      .map((s) => ({ ...s, title: s.title.trim(), items: s.items.map((i) => i.trim()).filter(Boolean) }))
      .filter((s) => s.title || s.items.length);
    if (detectSensitiveIn([notes, ...clean.flatMap((s) => [s.title, ...s.items])])) {
      notify(t('security.blockedTitle'), t('security.blockedCard'));
      return false;
    }
    saveRider({ id: existing?.id, kind, title: RIDER_TITLES[language][kind], language, sections: clean, notes: notes.trim() });
    setSections(clean);
    setDirty(false);
    return true;
  };

  const pdf = async () => {
    if (!persist()) return;
    const tl = i18n.getFixedT(language);
    const html = riderHtml({
      title: RIDER_TITLES[language][kind],
      artist: profile?.stageName ?? '',
      sections,
      notes,
      lang: language,
      contact: profile?.stageName ? tl('riders.contact', { name: profile.stageName }) : undefined,
    });
    await sharePdf(html, RIDER_TITLES[language][kind]).catch(() => notify(t('riders.pdf'), t('voice.errors.other')));
  };

  const remove = async () => {
    const ok = await confirmAction({
      title: t('common.confirmDelete'),
      message: t('common.confirmDeleteBody'),
      confirmLabel: t('common.delete'),
      cancelLabel: t('common.cancel'),
      destructive: true,
    });
    if (ok && existing) {
      deleteRider(existing.id);
      navigation.goBack();
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen edges={['bottom']}>
        <View style={{ gap: space.sm }}>
          <T variant="caption">{t('riders.language')}</T>
          <Chips value={language} onChange={changeLanguage} options={LANGUAGES.map((l) => ({ value: l, label: t(`languages.${l}`) }))} />
        </View>

        {sections.map((sec, si) => (
          <Card key={sec.key} style={{ gap: space.sm }}>
            <View style={styles.head}>
              <TextInput
                value={sec.title}
                onChangeText={(v) => update((all) => ((all[si].title = v), all))}
                placeholder={t('riders.sectionPlaceholder')}
                placeholderTextColor={colors.textFaint}
                style={styles.sectionTitle}
                maxLength={60}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('riders.removeSection')}
                hitSlop={10}
                onPress={() => update((all) => all.filter((_, i) => i !== si))}
              >
                <Ionicons name="trash-outline" size={20} color={colors.textFaint} />
              </Pressable>
            </View>
            {sec.items.map((item, ii) => (
              <View key={`${sec.key}-${ii}`} style={styles.itemRow}>
                <View style={styles.bullet} />
                <TextInput
                  value={item}
                  onChangeText={(v) => update((all) => ((all[si].items[ii] = v), all))}
                  placeholder={t('riders.itemPlaceholder')}
                  placeholderTextColor={colors.textFaint}
                  style={styles.item}
                  multiline
                  maxLength={200}
                />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('common.delete')}
                  hitSlop={10}
                  onPress={() => update((all) => ((all[si].items = all[si].items.filter((_, i) => i !== ii)), all))}
                >
                  <Ionicons name="close" size={18} color={colors.textFaint} />
                </Pressable>
              </View>
            ))}
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                tap();
                update((all) => (all[si].items.push(''), all));
              }}
              style={styles.addLine}
            >
              <Ionicons name="add" size={18} color={colors.gold} />
              <T variant="caption" color={colors.gold}>
                {t('riders.addItem')}
              </T>
            </Pressable>
          </Card>
        ))}

        <Button
          label={t('riders.addSection')}
          icon="add"
          variant="secondary"
          onPress={() => update((all) => [...all, { key: newId(), title: '', items: [''] }])}
        />
        <Field
          voice
          label={t('riders.notes')}
          optional
          optionalLabel={t('common.optional')}
          value={notes}
          onChangeText={(v) => {
            setNotes(v);
            setDirty(true);
          }}
          multiline
          maxLength={2000}
        />

        <Button label={t('riders.pdf')} icon="share-outline" onPress={pdf} />
        <Button
          label={t('common.save')}
          icon="checkmark"
          variant={dirty ? 'primary' : 'secondary'}
          onPress={() => {
            if (persist()) navigation.goBack();
          }}
        />
        {existing ? <Button label={t('common.delete')} icon="trash" variant="danger" onPress={remove} /> : null}
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  sectionTitle: { flex: 1, color: colors.gold, fontSize: font.bodyLg, fontWeight: '700', paddingVertical: 4 },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  bullet: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.violet },
  item: {
    flex: 1,
    color: colors.text,
    fontSize: font.body,
    minHeight: 44,
    paddingVertical: 8,
    paddingHorizontal: space.sm,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceAlt,
  },
  addLine: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 40 },
});
