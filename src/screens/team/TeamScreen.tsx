import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useLayoutEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, Share, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Banner, Button, Card, Chips, Field, Screen, SectionHeader, T, tap } from '../../components/ui';
import { isCloudConfigured } from '../../cloud/config';
import { changeRole, createInvite, formatInviteCode, joinTeam, loadMembers, removeMember } from '../../cloud/team';
import { confirmAction } from '../../lib/confirm';
import type { TeamMember } from '../../lib/types';
import type { RootProps } from '../../navigation/types';
import { useAppStore } from '../../store/useAppStore';
import { INVITE_ROLES, type MemberRole } from '../../team/permissions';
import { useRole } from '../../team/useRole';
import { colors, radius, space, themed } from '../../theme/tokens';

const ROLE_COLORS: Record<MemberRole, string> = themed(() => ({
  owner: colors.gold,
  manager: colors.violet,
  member: colors.success,
  accountant: colors.warning,
  viewer: colors.textMuted,
}));

export default function TeamScreen({ navigation }: RootProps<'Team'>) {
  const { t } = useTranslation();
  const signedIn = useAppStore((s) => !!s.cloud.email);
  const myId = useAppStore((s) => s.cloud.userId);
  const members = useAppStore((s) => s.members);
  const profileName = useAppStore((s) => s.profile?.stageName ?? '');
  const { role, inTeam } = useRole();
  const isOwner = inTeam && role === 'owner';

  const [inviteRole, setInviteRole] = useState<MemberRole>('member');
  const [code, setCode] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [joinCode, setJoinCode] = useState('');
  const [joinName, setJoinName] = useState(profileName);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  useLayoutEffect(() => {
    navigation.setOptions({ title: t('team.title') });
  }, [navigation, t]);

  useEffect(() => {
    if (inTeam) loadMembers().catch(() => {});
  }, [inTeam]);

  const errText = (e: string) =>
    t(`team.errors.${e}`, { defaultValue: '' }) || (e === 'network' ? t('account.errors.network') : t('team.errors.generic', { msg: e }));

  const makeCode = async () => {
    setBusy(true);
    setError(null);
    const r = await createInvite(inviteRole);
    setBusy(false);
    if (r.ok) setCode(r.value);
    else setError(errText(r.error));
  };

  const join = async () => {
    const ok = await confirmAction({
      title: t('team.joinWarnTitle'),
      message: t('team.joinWarn'),
      confirmLabel: t('team.joinBtn'),
      cancelLabel: t('common.cancel'),
    });
    if (!ok) return;
    setBusy(true);
    setError(null);
    const r = await joinTeam(joinCode, joinName.trim());
    setBusy(false);
    if (r.ok) {
      setJoinCode('');
      setInfo(t('team.joined'));
    } else setError(errText(r.error));
  };

  const onChangeRole = async (m: TeamMember, r: MemberRole) => {
    setError(null);
    const res = await changeRole(m.userId, r);
    if (!res.ok) setError(errText(res.error));
  };

  const onRemove = async (m: TeamMember) => {
    const ok = await confirmAction({
      title: t('team.removeConfirm', { name: m.displayName || m.email }),
      message: t('team.removeBody'),
      confirmLabel: t('team.remove'),
      cancelLabel: t('common.cancel'),
      destructive: true,
    });
    if (!ok) return;
    const res = await removeMember(m.userId);
    if (res.ok) setSelected(null);
    else setError(errText(res.error));
  };

  if (!isCloudConfigured() || !signedIn) {
    return (
      <Screen edges={['bottom']}>
        <Banner icon="people" text={isCloudConfigured() ? t('team.signInFirst') : t('account.notConfigured')} />
        {isCloudConfigured() ? (
          <Button label={t('account.verify')} icon="log-in" onPress={() => navigation.navigate('Account')} />
        ) : null}
      </Screen>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen edges={['bottom']}>
        {error ? <Banner tone="danger" icon="alert-circle" text={error} /> : null}
        {info ? <Banner icon="checkmark-circle" text={info} /> : null}

        {inTeam ? (
          <>
            <SectionHeader title={t('team.members')} />
            <View style={{ gap: space.sm }}>
              {members.map((m) => {
                const me = m.userId === myId;
                const open = selected === m.userId && isOwner && m.role !== 'owner';
                return (
                  <Card key={m.userId} style={{ gap: space.sm, padding: space.md }}>
                    <Pressable
                      accessibilityRole="button"
                      disabled={!isOwner || m.role === 'owner'}
                      onPress={() => {
                        tap();
                        setSelected(open ? null : m.userId);
                      }}
                      style={styles.member}
                    >
                      <View style={[styles.dot, { backgroundColor: ROLE_COLORS[m.role] }]}>
                        <T variant="bodyLg" color={colors.onGold}>
                          {(m.displayName || m.email || '?').charAt(0).toUpperCase()}
                        </T>
                      </View>
                      <View style={{ flex: 1 }}>
                        <T variant="bodyLg" numberOfLines={1}>
                          {m.displayName || m.email}
                          {me ? `  ·  ${t('team.you')}` : ''}
                        </T>
                        <T variant="caption" numberOfLines={1}>
                          {[t(`memberRoles.${m.role}`), m.displayName ? m.email : ''].filter(Boolean).join(' · ')}
                        </T>
                      </View>
                      {isOwner && m.role !== 'owner' ? (
                        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textFaint} />
                      ) : null}
                    </Pressable>
                    {open ? (
                      <>
                        <T variant="caption">{t('team.changeRole')}</T>
                        <Chips
                          value={m.role}
                          onChange={(r) => onChangeRole(m, r)}
                          options={INVITE_ROLES.map((r) => ({ value: r, label: t(`memberRoles.${r}`) }))}
                        />
                        <Button label={t('team.remove')} icon="person-remove" variant="danger" onPress={() => onRemove(m)} />
                      </>
                    ) : null}
                  </Card>
                );
              })}
            </View>
          </>
        ) : null}

        {isOwner ? (
          <>
            <SectionHeader title={t('team.invite')} />
            <Card style={{ gap: space.md }}>
              <T variant="caption">{t('team.chooseRole')}</T>
              {INVITE_ROLES.map((r) => {
                const active = r === inviteRole;
                return (
                  <Pressable
                    key={r}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: active }}
                    onPress={() => {
                      tap();
                      setInviteRole(r);
                      setCode(null);
                    }}
                    style={[styles.roleRow, active && styles.roleRowActive]}
                  >
                    <Ionicons name={active ? 'radio-button-on' : 'radio-button-off'} size={20} color={active ? colors.gold : colors.textFaint} />
                    <View style={{ flex: 1 }}>
                      <T variant="bodyLg">{t(`memberRoles.${r}`)}</T>
                      <T variant="caption">{t(`roleDesc.${r}`)}</T>
                    </View>
                  </Pressable>
                );
              })}
              {code ? (
                <View style={styles.codeBox}>
                  <T variant="label" color={colors.gold}>
                    {t('team.codeTitle')}
                  </T>
                  <T style={styles.code} selectable>
                    {formatInviteCode(code)}
                  </T>
                  <T variant="caption" style={{ textAlign: 'center' }}>
                    {t('team.codeBody')}
                  </T>
                  <Button
                    label={t('team.share')}
                    icon="share-social"
                    onPress={() => Share.share({ message: t('team.shareMessage', { code: formatInviteCode(code) }) })}
                    style={{ alignSelf: 'stretch' }}
                  />
                </View>
              ) : (
                <Button label={t('team.createCode')} icon="key" onPress={makeCode} loading={busy} />
              )}
            </Card>
          </>
        ) : null}

        <SectionHeader title={t('team.join')} />
        <Card style={{ gap: space.md }}>
          <T variant="caption">{t('team.joinBody')}</T>
          <Field
            label={t('team.code')}
            value={joinCode}
            onChangeText={(v) => setJoinCode(v.toUpperCase())}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={12}
            placeholder="ABCD-2345"
          />
          <Field label={t('team.yourName')} value={joinName} onChangeText={setJoinName} maxLength={60} />
          <Button
            label={t('team.joinBtn')}
            icon="enter"
            variant="secondary"
            onPress={join}
            loading={busy}
            disabled={joinCode.replace(/[^A-Z0-9]/gi, '').length !== 8}
          />
        </Card>
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = themed(() =>
  StyleSheet.create({
  member: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  dot: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  roleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  roleRowActive: { borderColor: colors.gold, backgroundColor: colors.goldSoft },
  codeBox: { alignItems: 'center', gap: space.sm, padding: space.md, borderRadius: radius.md, backgroundColor: colors.surfaceAlt },
  code: { fontSize: 34, fontWeight: '800', letterSpacing: 4, color: colors.text },
  }),
);
