import { useCallback, useEffect, useRef, useState } from 'react';
import type { Language } from '../lib/types';

// Native speech recognition (iOS: Apple Speech, Android: Google, web: Web Speech API).
// The module is loaded lazily: in Expo Go (no native module) voice is simply "unavailable"
// and the app keeps working with typing and the keyboard's own microphone.

type Mod = typeof import('expo-speech-recognition').ExpoSpeechRecognitionModule;
let mod: Mod | null | undefined;
function getModule(): Mod | null {
  if (mod !== undefined) return mod;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    mod = require('expo-speech-recognition').ExpoSpeechRecognitionModule as Mod;
  } catch {
    mod = null;
  }
  return mod;
}

export const SPEECH_LOCALES: Record<Language, string> = { az: 'az-AZ', ru: 'ru-RU', en: 'en-US' };

export type SpeechError = 'unavailable' | 'permission' | 'language' | 'no-speech' | 'network' | 'other';

export function isSpeechAvailable(): boolean {
  const m = getModule();
  if (!m) return false;
  try {
    return m.isRecognitionAvailable();
  } catch {
    return false;
  }
}

export function useSpeech(lang: Language) {
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [final, setFinal] = useState(false);
  const [error, setError] = useState<SpeechError | null>(null);
  const subs = useRef<{ remove: () => void }[]>([]);

  const cleanup = () => {
    subs.current.forEach((s) => s.remove());
    subs.current = [];
  };
  useEffect(() => () => {
    cleanup();
    try {
      getModule()?.abort();
    } catch {
      /* not running */
    }
  }, []);

  const start = useCallback(async () => {
    setTranscript('');
    setFinal(false);
    setError(null);
    const m = getModule();
    if (!m || !isSpeechAvailable()) return setError('unavailable');
    const perm = await m.requestPermissionsAsync().catch(() => null);
    if (!perm?.granted) return setError('permission');

    cleanup();
    subs.current.push(
      m.addListener('result', (e) => {
        const text = e.results?.[0]?.transcript ?? '';
        setTranscript(text);
        if (e.isFinal) setFinal(true);
      }),
      m.addListener('error', (e) => {
        const code = e.error;
        setError(
          code === 'not-allowed'
            ? 'permission'
            : code === 'language-not-supported'
              ? 'language'
              : code === 'no-speech' || code === 'speech-timeout'
                ? 'no-speech'
                : code === 'network'
                  ? 'network'
                  : code === 'aborted'
                    ? null
                    : 'other',
        );
        setListening(false);
      }),
      m.addListener('end', () => setListening(false)),
    );
    try {
      m.start({ lang: SPEECH_LOCALES[lang], interimResults: true, continuous: false, addsPunctuation: false });
      setListening(true);
    } catch {
      setError('other');
    }
  }, [lang]);

  const stop = useCallback(() => {
    try {
      getModule()?.stop();
    } catch {
      /* ignore */
    }
  }, []);

  const cancel = useCallback(() => {
    try {
      getModule()?.abort();
    } catch {
      /* ignore */
    }
    cleanup();
    setListening(false);
  }, []);

  return { listening, transcript, final, error, start, stop, cancel, setTranscript };
}
