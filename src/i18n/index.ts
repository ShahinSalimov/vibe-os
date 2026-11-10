import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { getLocales } from 'expo-localization';
import az from './locales/az';
import en from './locales/en';
import ru from './locales/ru';
import { LANGUAGES, type Language } from '../lib/types';

export function deviceLanguage(): Language {
  const code = getLocales()[0]?.languageCode ?? 'az';
  return (LANGUAGES as string[]).includes(code) ? (code as Language) : 'az';
}

i18n.use(initReactI18next).init({
  resources: {
    az: { translation: az },
    ru: { translation: ru },
    en: { translation: en },
  },
  lng: deviceLanguage(),
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
  returnNull: false,
});

export default i18n;
