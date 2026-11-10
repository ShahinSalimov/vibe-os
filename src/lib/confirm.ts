import { Alert, Platform } from 'react-native';

// Native: the system Alert. Web: an in-app dialog (DialogHost) — browser confirm()/alert()
// are blocked in some embedded viewers and look out of place in an installed web app.

export interface DialogRequest {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string; // absent = information dialog with one button
  destructive?: boolean;
  resolve: (ok: boolean) => void;
}

type Listener = (req: DialogRequest) => void;
let listener: Listener | null = null;

/** Called once by DialogHost. */
export function setDialogListener(l: Listener | null) {
  listener = l;
}

export function confirmAction(opts: {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  destructive?: boolean;
}): Promise<boolean> {
  if (Platform.OS === 'web') {
    return new Promise((resolve) => {
      if (listener) listener({ ...opts, resolve });
      else resolve(false);
    });
  }
  return new Promise((resolve) => {
    Alert.alert(opts.title, opts.message, [
      { text: opts.cancelLabel, style: 'cancel', onPress: () => resolve(false) },
      { text: opts.confirmLabel, style: opts.destructive ? 'destructive' : 'default', onPress: () => resolve(true) },
    ]);
  });
}

export function notify(title: string, message: string) {
  if (Platform.OS === 'web') {
    if (listener) listener({ title, message, confirmLabel: 'OK', resolve: () => {} });
    return;
  }
  Alert.alert(title, message);
}
