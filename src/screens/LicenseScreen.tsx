import { Ionicons } from '@expo/vector-icons';
import React, { useLayoutEffect, useState } from 'react';
import { KeyboardAvoidingView, Linking, Platform, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { DemoCloudOff } from '../demo/DemoCloudOff';
import { Banner, Button, Card, Field, Screen, T } from '../components/ui';
import { isCloudConfigured, SELLER_CONTACT_URL } from '../cloud/config';
import { redeemLicense } from '../cloud/license';
import { formatLicenseCode } from '../license/license';
import { useLicense } from '../license/useLicense';
import { formatDate, toISODate } from '../lib/format';
import type { Language } from '../lib/types';
import type { RootProps } from '../navigation/types';
import { useAppStore } from '../store/useAppStore';
import { useRole } from '../team/useRole';
import { colors, space, themed } from '../theme/tokens';

export default function LicenseScreen({ navigation }: RootProps<'License'>) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language as Language;
  const { state } = useLicense();
  const signedIn = useAppStore((s) => !!s.cloud.email);
  const activatedAt = useAppStore((s) => s.cloud.license?.activatedAt ?? null);
  const { role, inTeam } = useRole();
  const isOwner = !inTeam || role === 'owner';
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useLayoutEffect(() => {
    navigation.setOptions({ title: t('license.title') });
  }, [navigation, t]);

  const activate = async () => {
    setBusy(true);
    setError(null);
    const r = await redeemLicense(code);
    setBusy(false);
    if (r.ok) {
      setDone(true);
      setCode('');
    } else {
      setError(t(`license.errors.${r.error}`, { defaultValue: '' }) || t('license.errors.generic', { msg: r.error }));
    }
  };

  const head = (() => {
    switch (state.kind) {
      case 'active':
        return { icon: 'shield-checkmark' as const, color: colors.success, title: t('license.activeTitle'), body: t('license.activeBody') };
      case 'trial':
        return {
          icon: 'hourglass' as const,
          color: colors.gold,
          title: state.daysLeft > 1 ? t('license.trialDays', { count: state.daysLeft }) : t('license.trialHours', { count: state.hoursLeft }),
          body: t('license.trialBody'),
        };
      case 'expired':
        return { icon: 'lock-closed' as const, color: colors.warning, title: t('license.expiredTitle'), body: t('license.expiredBody') };
      case 'suspended':
        return { icon: 'pause-circle' as const, color: colors.danger, title: t('license.suspendedTitle'), body: t('license.suspendedBody') };
      default:
        return { icon: 'infinite' as const, color: colors.violet, title: t('license.title'), body: t('license.unlimited') };
    }
  })();

  const showActivation = isCloudConfigured() && state.kind !== 'active' && state.kind !== 'unlimited';

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen edges={['bottom']}>
        <DemoCloudOff />
        <Card style={styles.head}>
          <View style={[styles.badge, { backgroundColor: head.color + '22' }]}>
            <Ionicons name={head.icon} size={34} color={head.color} />
          </View>
          <T variant="title" style={{ textAlign: 'center' }}>
            {head.title}
          </T>
          <T color={colors.textMuted} style={{ textAlign: 'center' }}>
            {head.body}
          </T>
          {state.kind === 'active' && activatedAt ? (
            <T variant="caption">{t('license.activatedOn', { date: formatDate(toISODate(new Date(activatedAt)), lang) })}</T>
          ) : null}
        </Card>

        {done ? <Banner icon="checkmark-circle" text={t('license.activated')} /> : null}

        {showActivation ? (
          !isOwner ? (
            <Banner icon="person" text={t('license.ownerOnly')} />
          ) : !signedIn ? (
            <>
              <Banner icon="log-in" text={t('license.signInFirst')} />
              <Button label={t('account.verify')} icon="log-in" onPress={() => navigation.navigate('Account')} />
            </>
          ) : (
            <Card style={{ gap: space.md }}>
              <Field
                label={t('license.codeLabel')}
                value={code}
                onChangeText={(v) => setCode(formatLicenseCode(v).slice(0, 14))}
                placeholder="ABCD-EFGH-2345"
                autoCapitalize="characters"
                autoCorrect={false}
                maxLength={14}
              />
              {error ? <Banner tone="danger" icon="alert-circle" text={error} /> : null}
              <Button
                label={t('license.activate')}
                icon="key"
                onPress={activate}
                loading={busy}
                disabled={code.replace(/[^A-Z0-9]/gi, '').length !== 12}
              />
            </Card>
          )
        ) : null}

        {showActivation ? (
          <>
            <T variant="caption" style={{ textAlign: 'center' }}>
              {t('license.howToBuy')}
            </T>
            {SELLER_CONTACT_URL ? (
              <Button
                label={t('license.contactSeller')}
                icon="chatbubble-ellipses"
                variant="secondary"
                onPress={() => Linking.openURL(SELLER_CONTACT_URL).catch(() => {})}
              />
            ) : null}
          </>
        ) : null}
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = themed(() =>
  StyleSheet.create({
  head: { alignItems: 'center', gap: space.sm, paddingVertical: space.xl },
  badge: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center' },
  }),
);
