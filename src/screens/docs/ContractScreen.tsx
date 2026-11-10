import * as ImagePicker from 'expo-image-picker';
import React, { useLayoutEffect, useMemo, useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ReadOnlyBanner } from '../../license/ReadOnlyBanner';
import { useRole } from '../../team/useRole';
import { OptionalDateField } from '../../components/DateField';
import { Banner, Button, Chips, Field, Screen, SectionHeader, T } from '../../components/ui';
import { contractTitle, renderContract } from '../../docs/contractTemplates';
import { contractHtml } from '../../docs/html';
import { sharePdf } from '../../docs/share';
import { confirmAction, notify } from '../../lib/confirm';
import { currencySymbol, formatDate, formatMoney, parseAmount, toISODate } from '../../lib/format';
import { detectSensitiveIn } from '../../lib/sensitive';
import {
  CONTRACT_STATUSES,
  CONTRACT_TEMPLATES,
  CURRENCIES,
  LANGUAGES,
  type ContractStatus,
  type ContractTemplate,
  type Currency,
  type EventType,
  type Language,
} from '../../lib/types';
import i18n from '../../i18n';
import type { RootProps } from '../../navigation/types';
import { useAppStore } from '../../store/useAppStore';
import { keepFile, removeFile } from '../../studio/files';
import { colors, radius, space, themed } from '../../theme/tokens';

const TEMPLATE_FOR_EVENT: Partial<Record<EventType, ContractTemplate>> = { wedding: 'wedding', corporate: 'corporate' };

export default function ContractScreen({ route, navigation }: RootProps<'Contract'>) {
  const { t, i18n: inst } = useTranslation();
  const ro = !useRole().write('contracts');
  const uiLang = inst.language as Language;
  // Holds the id after the first save, so later saves update instead of creating duplicates.
  const [id, setId] = useState(route.params?.id);
  const existing = useAppStore((s) => (id ? s.contracts.find((c) => c.id === id) : undefined));
  const events = useAppStore((s) => s.events);
  const profile = useAppStore((s) => s.profile);
  const defaultCurrency = useAppStore((s) => s.settings.currency);
  const saveContract = useAppStore((s) => s.saveContract);
  const deleteContract = useAppStore((s) => s.deleteContract);

  const initialEvent = events.find((e) => e.id === (existing?.eventId ?? route.params?.eventId));
  const [eventId, setEventId] = useState(initialEvent?.id ?? '');
  const [template, setTemplate] = useState<ContractTemplate>(
    existing?.template ?? (initialEvent ? TEMPLATE_FOR_EVENT[initialEvent.type] ?? 'performance' : 'performance'),
  );
  const [language, setLanguage] = useState<Language>(existing?.language ?? uiLang);
  const [counterparty, setCounterparty] = useState(existing?.counterparty ?? initialEvent?.organizer ?? '');
  const [amount, setAmount] = useState(existing?.amount ? String(existing.amount) : initialEvent?.fee ? String(initialEvent.fee) : '');
  const [currency, setCurrency] = useState<Currency>(existing?.currency ?? initialEvent?.currency ?? defaultCurrency);
  const [status, setStatus] = useState<ContractStatus>(existing?.status ?? 'draft');
  const [deadline, setDeadline] = useState<string>(existing?.deadline ?? '');
  const [title, setTitle] = useState(existing?.title ?? '');
  const [body, setBody] = useState(existing?.body ?? '');
  const [signedFileUri, setSignedFileUri] = useState(existing?.signedFileUri);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useLayoutEffect(() => {
    navigation.setOptions({ title: existing ? t('contracts.edit') : t('contracts.new') });
  }, [navigation, existing, t]);

  const ev = events.find((e) => e.id === eventId);
  const today = toISODate(new Date());
  const upcoming = useMemo(
    () => events.filter((e) => e.date >= today || e.id === eventId).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 12),
    [events, today, eventId],
  );

  /** Builds the text in the CONTRACT language (may differ from the app language). */
  const generate = () => {
    const tl = i18n.getFixedT(language);
    const amt = parseAmount(amount) ?? 0;
    const adv = ev?.advance ?? 0;
    const money = (n: number) => (n > 0 ? formatMoney(n, currency, language) : '');
    const text = renderContract(template, language, {
      artist: profile?.stageName ?? '',
      organizer: counterparty,
      eventType: ev ? tl(`events.types.${ev.type}`) : '',
      date: ev ? formatDate(ev.date, language) : '',
      time: ev?.time ?? '',
      venue: ev?.venue ?? '',
      city: ev?.city ?? '',
      fee: money(amt),
      advance: money(adv),
      balance: money(Math.max(0, amt - adv)),
      today: formatDate(today, language),
    });
    setBody(text);
    if (!title.trim()) {
      setTitle([contractTitle(template, language), counterparty].filter(Boolean).join(' · ').slice(0, 150));
    }
  };

  const fillFromTemplate = async () => {
    if (body.trim()) {
      const ok = await confirmAction({
        title: t('contracts.fillConfirm'),
        message: t('contracts.fillConfirmBody'),
        confirmLabel: t('contracts.fill'),
        cancelLabel: t('common.cancel'),
      });
      if (!ok) return;
    }
    generate();
  };

  const persist = (): string | null => {
    const next: Record<string, string> = {};
    if (!title.trim()) next.title = t('contracts.errors.title');
    if (amount && parseAmount(amount) === null) next.amount = t('contracts.errors.amount');
    setErrors(next);
    if (Object.keys(next).length) return null;
    const sensitive = detectSensitiveIn([title, counterparty, body]);
    if (sensitive) {
      notify(t('security.blockedTitle'), sensitive === 'card' ? t('security.blockedCard') : t('security.blockedIban'));
      return null;
    }
    const savedId = saveContract({
      id,
      title: title.trim(),
      template,
      language,
      eventId: eventId || undefined,
      counterparty: counterparty.trim(),
      amount: parseAmount(amount) ?? 0,
      currency,
      status,
      deadline: deadline as '' | string,
      body,
      signedFileUri,
    });
    setId(savedId);
    return savedId;
  };

  const pdf = async () => {
    if (!body.trim()) return;
    if (persist()) await sharePdf(contractHtml(body, language), title).catch(() => notify(t('contracts.pdf'), t('voice.errors.other')));
  };

  const addSigned = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (res.canceled || !res.assets?.[0]) return;
    const uri = await keepFile(res.assets[0].uri, res.assets[0].fileName ?? 'signed.jpg', 'contracts');
    if (signedFileUri) await removeFile(signedFileUri);
    setSignedFileUri(uri);
    if (status !== 'signed') setStatus('signed');
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
      await removeFile(deleteContract(id));
      navigation.goBack();
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen edges={['bottom']} readOnly={ro}>
        {ro ? <ReadOnlyBanner /> : null}
        <Banner icon="information-circle" tone="warning" text={t('contracts.disclaimer')} />

        <View style={{ gap: space.sm }}>
          <T variant="caption">{t('contracts.fields.template')}</T>
          <Chips value={template} onChange={setTemplate} options={CONTRACT_TEMPLATES.map((x) => ({ value: x, label: t(`contracts.templates.${x}`) }))} />
        </View>
        <View style={{ gap: space.sm }}>
          <T variant="caption">{t('contracts.fields.language')}</T>
          <Chips value={language} onChange={setLanguage} options={LANGUAGES.map((l) => ({ value: l, label: t(`languages.${l}`) }))} />
        </View>
        {upcoming.length ? (
          <View style={{ gap: space.sm }}>
            <T variant="caption">{t('contracts.fields.event')}</T>
            <Chips
              wrap={false}
              value={eventId}
              onChange={(v) => {
                setEventId(v);
                const e = events.find((x) => x.id === v);
                if (e && !counterparty) setCounterparty(e.organizer);
                if (e && !amount && e.fee) setAmount(String(e.fee));
              }}
              options={[
                { value: '', label: t('contracts.noEvent') },
                ...upcoming.map((e) => ({ value: e.id, label: `${formatDate(e.date, uiLang, false)} · ${e.title}` })),
              ]}
            />
          </View>
        ) : null}

        <Field label={t('contracts.fields.counterparty')} value={counterparty} onChangeText={setCounterparty} maxLength={100} />
        <View style={styles.row2}>
          <View style={{ flex: 1 }}>
            <Field
              label={`${t('contracts.fields.amount')} (${currencySymbol(currency)})`}
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
              error={errors.amount}
            />
          </View>
          <View style={{ flex: 1 }}>
            <OptionalDateField
              label={t('contracts.fields.deadline')}
              value={deadline}
              onChange={setDeadline}
              addLabel={t('contracts.addDeadline')}
            />
          </View>
        </View>
        <Chips wrap={false} value={currency} onChange={setCurrency} options={CURRENCIES.map((c) => ({ value: c, label: `${currencySymbol(c)} ${c}` }))} />

        <Button label={t('contracts.fill')} icon="sparkles" variant="secondary" onPress={fillFromTemplate} />
        <Field label={t('contracts.fields.title')} value={title} onChangeText={setTitle} error={errors.title} maxLength={150} />
        <Field
          voice
          label={t('contracts.fields.body')}
          value={body}
          onChangeText={setBody}
          multiline
          maxLength={30000}
          style={{ minHeight: 260 }}
        />

        <View style={{ gap: space.sm }}>
          <T variant="caption">{t('money.fields.status')}</T>
          <Chips value={status} onChange={setStatus} options={CONTRACT_STATUSES.map((s) => ({ value: s, label: t(`contracts.status.${s}`) }))} />
        </View>

        <SectionHeader title={t('contracts.signedCopy')} />
        {signedFileUri ? <Image source={{ uri: signedFileUri }} style={styles.scan} resizeMode="cover" /> : null}
        <Button
          label={signedFileUri ? t('contracts.replaceSigned') : t('contracts.addSigned')}
          icon="camera"
          variant="secondary"
          onPress={addSigned}
        />
        {signedFileUri ? (
          <T variant="caption" color={colors.textFaint}>
            {t('contracts.deviceOnly')}
          </T>
        ) : null}

        <Button label={t('contracts.pdf')} icon="share-outline" onPress={pdf} disabled={!body.trim()} />
        {ro ? null : (<Button
          label={t('common.save')}
          icon="checkmark"
          variant="secondary"
          onPress={() => {
            if (persist()) navigation.goBack();
          }}
        />)}
        {existing && !ro ? <Button label={t('common.delete')} icon="trash" variant="danger" onPress={remove} /> : null}
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = themed(() =>
  StyleSheet.create({
  row2: { flexDirection: 'row', gap: space.md, alignItems: 'flex-start' },
  scan: { width: '100%', height: 220, borderRadius: radius.md, backgroundColor: colors.surfaceAlt },
  }),
);
