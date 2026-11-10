import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useLayoutEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { Banner, Button, Card, Field, Screen, T } from '../components/ui';
import { currentUserEmail, isEmail, sendCode, signOut, verifyCode } from '../cloud/auth';
import { isCloudConfigured } from '../cloud/config';
import { syncNow, type SyncResult } from '../cloud/sync';
import { confirmAction } from '../lib/confirm';
import { formatDate, toISODate } from '../lib/format';
import type { Language } from '../lib/types';
import type { RootProps } from '../navigation/types';
import { useAppStore } from '../store/useAppStore';
import { emptyCloud } from '../store/migrate';
import { colors, space, themed } from '../theme/tokens';

export function syncErrorText(t: TFunction, r: SyncResult): string | null {
  if (r.ok) return null;
  switch (r.error) {
    case 'network':
      return t('account.errors.network');
    case 'payment_data':
      return t('account.errors.payment');
    case 'not_configured':
      return t('account.notConfigured');
    case 'removed':
      return t('team.removed');
    default:
      return t('account.errors.generic', { msg: r.error });
  }
}

export default function AccountScreen({ navigation }: RootProps<'Account'>) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language as Language;
  const cloud = useAppStore((s) => s.cloud);
  const setCloud = useAppStore((s) => s.setCloud);
  const [email, setEmail] = useState(cloud.email ?? '');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  useLayoutEffect(() => {
    navigation.setOptions({ title: t('account.title') });
  }, [navigation, t]);

  // If the session expired, reflect it.
  useEffect(() => {
    if (!isCloudConfigured()) return;
    currentUserEmail().then((e) => {
      if (!e && useAppStore.getState().cloud.email) setCloud({ email: null });
    });
  }, [setCloud]);

  const runSync = async () => {
    setBusy(true);
    setError(null);
    const r = await syncNow();
    setBusy(false);
    if (r.ok) setInfo(t('account.synced'));
    else setError(syncErrorText(t, r));
  };

  const onSend = async () => {
    if (!isEmail(email)) return setError(t('account.errors.email'));
    setBusy(true);
    setError(null);
    const r = await sendCode(email);
    setBusy(false);
    if (r.ok) setStep('code');
    else setError(/fetch|network/i.test(r.error) ? t('account.errors.network') : t('account.errors.generic', { msg: r.error }));
  };

  const onVerify = async () => {
    setBusy(true);
    setError(null);
    const r = await verifyCode(email, code);
    if (!r.ok) {
      setBusy(false);
      return setError(t('account.errors.code'));
    }
    setCloud({ email: email.trim().toLowerCase() });
    await runSync();
  };

  const onSignOut = async () => {
    const ok = await confirmAction({
      title: t('account.signOut'),
      message: t('account.signOutBody'),
      confirmLabel: t('account.signOut'),
      cancelLabel: t('common.cancel'),
    });
    if (!ok) return;
    await signOut();
    // keep local data; forget cloud identity so a different account starts clean
    setCloud({ ...emptyCloud });
    setStep('email');
    setCode('');
  };

  if (!isCloudConfigured()) {
    return (
      <Screen edges={['bottom']}>
        <Banner icon="cloud-offline" text={t('account.notConfigured')} />
      </Screen>
    );
  }

  const lastSync = cloud.lastSyncAt
    ? `${formatDate(toISODate(new Date(cloud.lastSyncAt)), lang)}, ${new Date(cloud.lastSyncAt).toTimeString().slice(0, 5)}`
    : t('account.never');

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen edges={['bottom']}>
        {cloud.email ? (
          <>
            <Card style={styles.center}>
              <View style={styles.badge}>
                <Ionicons name="cloud-done" size={32} color={colors.success} />
              </View>
              <T variant="bodyLg">{t('account.signedInAs', { email: cloud.email })}</T>
              <T variant="caption">{t('account.lastSync', { time: lastSync })}</T>
            </Card>
            {error ? <Banner tone="danger" icon="alert-circle" text={error} /> : null}
            {info && !error ? <Banner icon="checkmark-circle" text={info} /> : null}
            <Button label={t('account.syncNow')} icon="sync" onPress={runSync} loading={busy} />
            <Button label={t('account.signOut')} icon="log-out" variant="secondary" onPress={onSignOut} />
          </>
        ) : (
          <>
            <Card style={styles.center}>
              <View style={[styles.badge, { backgroundColor: colors.goldSoft }]}>
                <Ionicons name="cloud-upload" size={32} color={colors.gold} />
              </View>
              <T variant="title" style={{ textAlign: 'center' }}>
                {t('account.signedOutTitle')}
              </T>
              <T color={colors.textMuted} style={{ textAlign: 'center' }}>
                {t('account.signedOutBody')}
              </T>
            </Card>
            {step === 'email' ? (
              <>
                <Field
                  label={t('account.email')}
                  value={email}
                  onChangeText={setEmail}
                  placeholder={t('account.emailPlaceholder')}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                  maxLength={120}
                />
                {error ? <Banner tone="danger" icon="alert-circle" text={error} /> : null}
                <Button label={t('account.sendCode')} icon="mail" onPress={onSend} loading={busy} disabled={!email.trim()} />
              </>
            ) : (
              <>
                <T color={colors.textMuted}>{t('account.codeSent', { email: email.trim() })}</T>
                <Field
                  label={t('account.code')}
                  value={code}
                  onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))}
                  keyboardType="number-pad"
                  autoComplete="one-time-code"
                  textContentType="oneTimeCode"
                  maxLength={6}
                  autoFocus
                />
                {error ? <Banner tone="danger" icon="alert-circle" text={error} /> : null}
                <Button label={t('account.verify')} icon="log-in" onPress={onVerify} loading={busy} disabled={code.length !== 6} />
                <Button
                  label={t('account.changeEmail')}
                  variant="ghost"
                  onPress={() => {
                    setStep('email');
                    setCode('');
                    setError(null);
                  }}
                />
              </>
            )}
          </>
        )}
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = themed(() =>
  StyleSheet.create({
  center: { alignItems: 'center', gap: space.sm, paddingVertical: space.xl },
  badge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.successSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  }),
);
