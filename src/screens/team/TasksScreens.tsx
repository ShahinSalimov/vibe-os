import { Ionicons } from '@expo/vector-icons';
import React, { useLayoutEffect, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { OptionalDateField } from '../../components/DateField';
import { Banner, Button, Chips, EmptyState, Field, IconButton, Screen, Segmented, T, tap } from '../../components/ui';
import { confirmAction, notify } from '../../lib/confirm';
import { formatDate, toISODate } from '../../lib/format';
import { detectSensitiveIn } from '../../lib/sensitive';
import type { Language, Task } from '../../lib/types';
import type { RootProps } from '../../navigation/types';
import { daysUntil } from '../../notify/plan';
import { useAppStore } from '../../store/useAppStore';
import { useRole } from '../../team/useRole';
import { colors, radius, space } from '../../theme/tokens';

/** Can this user tick the task? Managers: any task. Others: only their own. Local (no team): always. */
function canTick(task: Task, write: boolean, myId: string | null, inTeam: boolean) {
  return !inTeam || write || (!!myId && task.assigneeId === myId);
}

export function TasksScreen({ navigation }: RootProps<'Tasks'>) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language as Language;
  const tasks = useAppStore((s) => s.tasks);
  const members = useAppStore((s) => s.members);
  const events = useAppStore((s) => s.events);
  const myId = useAppStore((s) => s.cloud.userId);
  const toggleTask = useAppStore((s) => s.toggleTask);
  const { write, inTeam } = useRole();
  const canEdit = write('tasks');
  const [tab, setTab] = useState<'mine' | 'open' | 'done'>(inTeam && !canEdit ? 'mine' : 'open');
  const today = toISODate(new Date());

  useLayoutEffect(() => {
    navigation.setOptions({
      title: t('tasks.title'),
      headerRight: () =>
        canEdit ? <IconButton icon="add" color={colors.gold} label={t('tasks.new')} onPress={() => navigation.navigate('TaskForm')} /> : null,
    });
  }, [navigation, t, canEdit]);

  const list = useMemo(() => {
    const f = tasks.filter((x) =>
      tab === 'done' ? x.done : tab === 'mine' ? !x.done && !!myId && x.assigneeId === myId : !x.done,
    );
    return f.sort((a, b) => (a.due || '9999').localeCompare(b.due || '9999') || b.createdAt.localeCompare(a.createdAt));
  }, [tasks, tab, myId]);

  const nameOf = (id: string) => {
    const m = members.find((x) => x.userId === id);
    return m ? m.displayName || m.email : '';
  };

  return (
    <Screen edges={['bottom']}>
      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          ...(inTeam ? [{ value: 'mine' as const, label: t('tasks.mine') }] : []),
          { value: 'open' as const, label: t('tasks.open') },
          { value: 'done' as const, label: t('tasks.done') },
        ]}
      />
      {list.length === 0 ? (
        <EmptyState
          icon="checkbox"
          title={t('tasks.empty')}
          body={t('tasks.emptyBody')}
          action={canEdit ? t('tasks.new') : undefined}
          onAction={canEdit ? () => navigation.navigate('TaskForm') : undefined}
        />
      ) : (
        <View style={{ gap: space.sm }}>
          {list.map((x) => {
            const tick = canTick(x, canEdit, myId, inTeam);
            const left = x.due ? daysUntil(x.due, today) : null;
            const ev = x.eventId ? events.find((e) => e.id === x.eventId) : undefined;
            return (
              <View key={x.id} style={styles.row}>
                <Pressable
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: x.done, disabled: !tick }}
                  disabled={!tick}
                  onPress={() => {
                    tap();
                    toggleTask(x.id);
                  }}
                  hitSlop={8}
                  style={!tick && { opacity: 0.4 }}
                >
                  <Ionicons name={x.done ? 'checkmark-circle' : 'ellipse-outline'} size={28} color={x.done ? colors.success : colors.gold} />
                </Pressable>
                <Pressable
                  style={{ flex: 1, gap: 2 }}
                  disabled={!canEdit}
                  onPress={() => navigation.navigate('TaskForm', { id: x.id })}
                >
                  <T variant="bodyLg" style={x.done ? styles.doneText : undefined}>
                    {x.title}
                  </T>
                  <T variant="caption" numberOfLines={1}>
                    {[x.assigneeId ? nameOf(x.assigneeId) : '', x.due ? formatDate(x.due, lang, false) : '', ev?.title]
                      .filter(Boolean)
                      .join(' · ')}
                  </T>
                  {!x.done && left !== null && left < 0 ? (
                    <T variant="caption" color={colors.danger}>
                      {t('tasks.overdue')}
                    </T>
                  ) : null}
                </Pressable>
              </View>
            );
          })}
        </View>
      )}
    </Screen>
  );
}

export function TaskFormScreen({ route, navigation }: RootProps<'TaskForm'>) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language as Language;
  const id = route.params?.id;
  const existing = useAppStore((s) => (id ? s.tasks.find((x) => x.id === id) : undefined));
  const members = useAppStore((s) => s.members);
  const events = useAppStore((s) => s.events);
  const saveTask = useAppStore((s) => s.saveTask);
  const deleteTask = useAppStore((s) => s.deleteTask);
  const { write, inTeam } = useRole();
  const canEdit = write('tasks');

  const [title, setTitle] = useState(existing?.title ?? '');
  const [note, setNote] = useState(existing?.note ?? '');
  const [assigneeId, setAssigneeId] = useState(existing?.assigneeId ?? '');
  const [due, setDue] = useState<string>(existing?.due ?? '');
  const [eventId, setEventId] = useState(existing?.eventId ?? route.params?.eventId ?? '');
  const [error, setError] = useState<string | null>(null);
  const today = toISODate(new Date());
  const upcoming = events.filter((e) => e.date >= today || e.id === eventId).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 12);

  useLayoutEffect(() => {
    navigation.setOptions({ title: existing ? t('tasks.edit') : t('tasks.new') });
  }, [navigation, existing, t]);

  const save = () => {
    if (!title.trim()) return setError(t('tasks.errors.title'));
    if (detectSensitiveIn([title, note])) return notify(t('security.blockedTitle'), t('security.blockedCard'));
    saveTask({ id, title: title.trim(), note: note.trim(), assigneeId, due: due as '' | string, eventId: eventId || undefined, done: existing?.done ?? false });
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
      deleteTask(id);
      navigation.goBack();
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen edges={['bottom']}>
        {!canEdit ? <Banner icon="eye" text={t('readOnly')} /> : null}
        <Field voice label={t('tasks.fields.title')} value={title} onChangeText={setTitle} error={error ?? undefined} maxLength={150} editable={canEdit} />
        {inTeam && members.length ? (
          <View style={{ gap: space.sm }}>
            <T variant="caption">{t('tasks.fields.assignee')}</T>
            <Chips
              value={assigneeId}
              onChange={setAssigneeId}
              options={[
                { value: '', label: t('tasks.unassigned') },
                ...members.map((m) => ({ value: m.userId, label: m.displayName || m.email })),
              ]}
            />
          </View>
        ) : null}
        <OptionalDateField label={t('tasks.fields.due')} value={due} onChange={setDue} addLabel={t('tasks.addDue')} />
        {upcoming.length ? (
          <View style={{ gap: space.sm }}>
            <T variant="caption">{t('tasks.fields.event')}</T>
            <Chips
              wrap={false}
              value={eventId}
              onChange={setEventId}
              options={[
                { value: '', label: t('tasks.noEvent') },
                ...upcoming.map((e) => ({ value: e.id, label: `${formatDate(e.date, lang, false)} · ${e.title}` })),
              ]}
            />
          </View>
        ) : null}
        <Field voice label={t('tasks.fields.note')} optional optionalLabel={t('common.optional')} value={note} onChangeText={setNote} multiline maxLength={1000} editable={canEdit} />
        {canEdit ? <Button label={t('common.save')} icon="checkmark" onPress={save} /> : null}
        {canEdit && existing ? <Button label={t('common.delete')} icon="trash" variant="danger" onPress={remove} /> : null}
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
  doneText: { textDecorationLine: 'line-through', color: colors.textMuted },
});
