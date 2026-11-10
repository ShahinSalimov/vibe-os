import * as ImagePicker from 'expo-image-picker';
import React, { useLayoutEffect, useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { OptionalDateField } from '../../components/DateField';
import { Banner, Button, Chips, Field, Screen } from '../../components/ui';
import { confirmAction } from '../../lib/confirm';
import { PERSONAL_DOC_KINDS, type PersonalDocKind } from '../../lib/types';
import type { RootProps } from '../../navigation/types';
import { useAppStore } from '../../store/useAppStore';
import { keepFile, removeFile } from '../../studio/files';
import { colors, radius, space } from '../../theme/tokens';
import { DOC_ICONS } from './DocumentsScreen';

/** Passport / visa reminder. Device-only. No document number field on purpose. */
export default function PersonalDocScreen({ route, navigation }: RootProps<'PersonalDoc'>) {
  const { t } = useTranslation();
  const id = route.params?.id;
  const existing = useAppStore((s) => (id ? s.docs.find((d) => d.id === id) : undefined));
  const saveDoc = useAppStore((s) => s.saveDoc);
  const deleteDoc = useAppStore((s) => s.deleteDoc);

  const [kind, setKind] = useState<PersonalDocKind>(existing?.kind ?? 'passport');
  const [title, setTitle] = useState(existing?.title ?? '');
  const [country, setCountry] = useState(existing?.country ?? '');
  const [expiry, setExpiry] = useState<string>(existing?.expiry ?? '');
  const [note, setNote] = useState(existing?.note ?? '');
  const [fileUri, setFileUri] = useState(existing?.fileUri);
  const [error, setError] = useState<string | null>(null);

  useLayoutEffect(() => {
    navigation.setOptions({ title: existing ? t('personal.edit') : t('personal.new') });
  }, [navigation, existing, t]);

  const addPhoto = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (res.canceled || !res.assets?.[0]) return;
    const uri = await keepFile(res.assets[0].uri, res.assets[0].fileName ?? 'doc.jpg', 'docs');
    if (fileUri) await removeFile(fileUri);
    setFileUri(uri);
  };

  const save = () => {
    const name = title.trim() || t(`personal.kinds.${kind}`);
    if (!name) return setError(t('personal.errors.title'));
    saveDoc({ id, kind, title: name, country: country.trim(), expiry: expiry as '' | string, note: note.trim(), fileUri });
    navigation.goBack();
  };

  const remove = async () => {
    const ok = await confirmAction({
      title: t('common.confirmDelete'),
      message: t('common.confirmDeleteBody'),
      confirmLabel: t('common.delete'),
      cancelLabel: t('common.cancel'),
      destructive: true,
    });
    if (ok && id) {
      await removeFile(deleteDoc(id));
      navigation.goBack();
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen edges={['bottom']}>
        <Banner icon="lock-closed" text={t('personal.privacy')} />
        <Chips
          value={kind}
          onChange={setKind}
          options={PERSONAL_DOC_KINDS.map((k) => ({ value: k, label: t(`personal.kinds.${k}`), icon: DOC_ICONS[k] }))}
        />
        <Field
          label={t('personal.fields.title')}
          value={title}
          onChangeText={setTitle}
          placeholder={t(`personal.kinds.${kind}`)}
          error={error ?? undefined}
          maxLength={80}
        />
        <Field label={t('personal.fields.country')} optional optionalLabel={t('common.optional')} value={country} onChangeText={setCountry} maxLength={60} />
        <OptionalDateField label={t('personal.fields.expiry')} value={expiry} onChange={setExpiry} addLabel={t('personal.addExpiry')} />
        <Field
          voice
          label={t('personal.fields.note')}
          optional
          optionalLabel={t('common.optional')}
          value={note}
          onChangeText={setNote}
          multiline
          maxLength={500}
        />
        {fileUri ? <Image source={{ uri: fileUri }} style={styles.photo} resizeMode="cover" /> : null}
        <Button label={t('personal.addPhoto')} icon="camera" variant="secondary" onPress={addPhoto} />
        <View style={{ height: space.sm }} />
        <Button label={t('common.save')} icon="checkmark" onPress={save} />
        {existing ? <Button label={t('common.delete')} icon="trash" variant="danger" onPress={remove} /> : null}
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  photo: { width: '100%', height: 200, borderRadius: radius.md, backgroundColor: colors.surfaceAlt },
});
