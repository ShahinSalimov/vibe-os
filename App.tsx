import './src/i18n';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Platform, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import i18n from './src/i18n';
import RootNavigator from './src/navigation/RootNavigator';
import LockScreen from './src/screens/LockScreen';
import { useAppStore } from './src/store/useAppStore';
import { colors } from './src/theme/tokens';

export default function App() {
  const hydrated = useAppStore((s) => s.hydrated);
  const hasProfile = useAppStore((s) => !!s.profile);
  const language = useAppStore((s) => s.settings.language);
  const appLock = useAppStore((s) => s.settings.appLock);
  const [locked, setLocked] = useState(true);
  const appState = useRef(AppState.currentState);

  // Saved language wins over device language once the user has onboarded.
  useEffect(() => {
    if (hydrated && hasProfile && i18n.language !== language) i18n.changeLanguage(language);
  }, [hydrated, hasProfile, language]);

  // Enabling the lock in Settings already required authentication -> stay unlocked.
  // Only a live off->on switch counts; a cold start with the lock on stays locked.
  const prevLock = useRef<boolean | null>(null);
  useEffect(() => {
    if (!hydrated) return;
    if (prevLock.current === false && appLock) setLocked(false);
    prevLock.current = appLock;
  }, [hydrated, appLock]);

  // Re-lock when the app goes to background ('inactive' is ignored: the Face ID prompt itself triggers it).
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'background') setLocked(true);
      appState.current = next;
    });
    return () => sub.remove();
  }, []);

  if (!hydrated) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.gold} />
      </View>
    );
  }

  const showLock = appLock && locked && hasProfile && Platform.OS !== 'web';

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <RootNavigator />
        {showLock ? <LockScreen onUnlock={() => setLocked(false)} /> : null}
      </View>
    </SafeAreaProvider>
  );
}
