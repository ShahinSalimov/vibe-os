import { Ionicons } from '@expo/vector-icons';
import React, { useLayoutEffect, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ContactActions } from '../components/booking';
import { Button, Chips, EmptyState, Field, IconButton, Screen, T, tap, type IconName } from '../components/ui';
import { isEmail } from '../cloud/auth';
import { confirmAction, notify } from '../lib/confirm';
import { detectSensitiveIn, validPhone } from '../lib/sensitive';
import { CONTACT_KINDS, type ContactKind } from '../lib/types';
import type { RootProps } from '../navigation/types';
import { useAppStore } from '../store/useAppStore';
import { colors, radius, space } from '../theme/tokens';

const KIND_ICONS: Record<ContactKind, IconName> = {
  organizer: 'briefcase',
  venue: 'business',
  sponsor: 'star',
  team: 'people',
  media: 'camera',
  other: 'person',
};

export function ContactsScreen({ navigation }: RootProps<'Contacts'>) {
  const { t } = useTranslation();
  const contacts = useAppStore((s) => s.contacts);
  const [query, setQuery] = useState('');

  useLayoutEffect(() => {
    navigation.setOptions({
      title: t('contacts.title'),
      headerRight: () => (
        <IconButton icon="add" label={t('contacts.new')} color={colors.gold} onPress={() => navigation.navigate('ContactForm')} />
      ),
    });
  }, [navigation, t]);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return contacts
      .filter((c) => !q || c.name.toLowerCase().includes(q) || c.phone.includes(q))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [contacts, query]);

  return (
    <Screen edges={['bottom']}>
      {contacts.length === 0 ? (
        <EmptyState
          icon="people"
          title={t('contacts.empty')}
          body={t('contacts.emptyBody')}
          action={t('contacts.new')}
          onAction={() => navigation.navigate('ContactForm')}
        />
      ) : (
        <>
          {contacts.length > 6 ? (
            <Field label={t('common.search')} value={query} onChangeText={setQuery} autoCapitalize="none" />
          ) : null}
          <View style={{ gap: space.sm }}>
            {list.map((c) => (
              <Pressable
                key={c.id}
                accessibilityRole="button"
                onPress={() => {
                  tap();
                  navigation.navigate('ContactForm', { id: c.id });
                }}
                style={({ pressed }) => [styles.row, pressed && { opacity: 0.8 }]}
              >
                <View style={styles.icon}>
                  <Ionicons name={KIND_ICONS[c.kind]} size={20} color={colors.violet} />
                </View>
                <View style={{ flex: 1 }}>
                  <T variant="bodyLg" numberOfLines={1}>
                    {c.name}
                  </T>
                  <T variant="caption" numberOfLines={1}>
                    {[t(`contacts.kinds.${c.kind}`), c.phone || c.email].filter(Boolean).join(' · ')}
                  </T>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
              </Pressable>
            ))}
          </View>
        </>
      )}
    </Screen>
  );
}

export function ContactFormScreen({ route, navigation }: RootProps<'ContactForm'>) {
  const { t } = useTranslation();
  const id = route.params?.id;
  const existing = useAppStore((s) => (id ? s.contacts.find((c) => c.id === id) : undefined));
  const saveContact = useAppStore((s) => s.saveContact);
  const deleteContact = useAppStore((s) => s.deleteContact);
  const [name, setName] = useState(existing?.name ?? '');
  const [kind, setKind] = useState<ContactKind>(existing?.kind ?? 'organizer');
  const [phone, setPhone] = useState(existing?.phone ?? '');
  const [email, setEmail] = useState(existing?.email ?? '');
  const [note, setNote] = useState(existing?.note ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});

  useLayoutEffect(() => {
    navigation.setOptions({ title: existing ? t('contacts.edit') : t('contacts.new') });
  }, [navigation, existing, t]);

  const save = () => {
    const next: Record<string, string> = {};
    if (!name.trim()) next.name = t('contacts.errors.name');
    if (!validPhone(phone)) next.phone = t('events.errors.phone');
    if (email.trim() && !isEmail(email)) next.email = t('bookings.errors.email');
    setErrors(next);
    if (Object.keys(next).length) return;
    const sensitive = detectSensitiveIn([name, email, note]);
    if (sensitive) {
      notify(t('security.blockedTitle'), sensitive === 'card' ? t('security.blockedCard') : t('security.blockedIban'));
      return;
    }
    saveContact({ id, name: name.trim(), kind, phone: phone.trim(), email: email.trim(), note: note.trim() });
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
      deleteContact(id);
      navigation.goBack();
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen edges={['bottom']}>
        {existing ? <ContactActions phone={existing.phone} email={existing.email} /> : null}
        <Field label={t('contacts.fields.name')} value={name} onChangeText={setName} error={errors.name} maxLength={100} />
        <View style={{ gap: space.sm }}>
          <T variant="caption">{t('contacts.fields.kind')}</T>
          <Chips
            value={kind}
            onChange={setKind}
            options={CONTACT_KINDS.map((k) => ({ value: k, label: t(`contacts.kinds.${k}`), icon: KIND_ICONS[k] }))}
          />
        </View>
        <Field
          label={t('contacts.fields.phone')}
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          maxLength={20}
          error={errors.phone}
        />
        <Field
          label={t('contacts.fields.email')}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          maxLength={120}
          error={errors.email}
        />
        <Field
          voice
          label={t('contacts.fields.note')}
          optional
          optionalLabel={t('common.optional')}
          value={note}
          onChangeText={setNote}
          multiline
          maxLength={500}
        />
        <Button label={t('common.save')} icon="checkmark" onPress={save} />
        {existing ? <Button label={t('common.delete')} icon="trash" variant="danger" onPress={remove} /> : null}
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: space.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.violetSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
