import React, { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { setDialogListener, type DialogRequest } from '../lib/confirm';
import { colors, radius, space, themed } from '../theme/tokens';
import { Button, T } from './ui';

/** Web-only dialog used by confirmAction()/notify(); mounted once at the app root. */
export function DialogHost() {
  const [req, setReq] = useState<DialogRequest | null>(null);
  useEffect(() => {
    setDialogListener((r) => setReq(r));
    return () => setDialogListener(null);
  }, []);
  if (!req) return null;
  const close = (ok: boolean) => {
    req.resolve(ok);
    setReq(null);
  };
  return (
    <Modal visible transparent animationType="fade" onRequestClose={() => close(false)}>
      <Pressable style={styles.backdrop} onPress={() => close(false)}>
        <Pressable style={styles.box} onPress={() => {}} accessibilityRole="alert">
          <T variant="title">{req.title}</T>
          {req.message ? <T color={colors.textMuted}>{req.message}</T> : null}
          <View style={styles.row}>
            {req.cancelLabel ? <Button label={req.cancelLabel} variant="secondary" onPress={() => close(false)} style={{ flex: 1 }} /> : null}
            <Button
              label={req.confirmLabel}
              variant={req.destructive ? 'danger' : 'primary'}
              onPress={() => close(true)}
              style={{ flex: 1 }}
            />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: space.lg },
    box: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      padding: space.xl,
      gap: space.md,
      maxWidth: 420,
      width: '100%',
      alignSelf: 'center',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    row: { flexDirection: 'row', gap: space.md, marginTop: space.sm },
  }),
);
