import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Localization from 'expo-localization';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en';
import es from './locales/es';

const LANG_KEY = 'app_language';

export type Language = 'es' | 'en';

const deviceLang = Localization.getLocales()[0]?.languageCode ?? 'es';
const fallbackLang: Language = deviceLang.startsWith('es') ? 'es' : 'en';

export async function initI18n(): Promise<void> {
  const stored = await AsyncStorage.getItem(LANG_KEY) as Language | null;
  const lng = stored ?? fallbackLang;

  await i18n.use(initReactI18next).init({
    resources: { es: { translation: es }, en: { translation: en } },
    lng,
    fallbackLng: 'es',
    interpolation: { escapeValue: false },
  });
}

export async function changeLanguage(lang: Language): Promise<void> {
  await i18n.changeLanguage(lang);
  await AsyncStorage.setItem(LANG_KEY, lang);
}

export { i18n };
