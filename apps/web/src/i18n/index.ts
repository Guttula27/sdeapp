import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import en from './locales/en.json';
import hi from './locales/hi.json';

// Bundled translations for the languages we ship with. Newly-added languages
// fall back to English until a bundle is shipped for them.
const resources: Record<string, { translation: any }> = {
  en: { translation: en },
  hi: { translation: hi },
};

// Languages we surface in the admin header switcher. Only list codes with
// a bundled translation — otherwise the switch would silently render English.
// nativeName is what shows in the dropdown so the user picks in their own script.
export const SUPPORTED_LANGS: Array<{ code: string; nativeName: string; englishName: string }> = [
  { code: 'en', nativeName: 'English',   englishName: 'English' },
  { code: 'hi', nativeName: 'हिन्दी',    englishName: 'Hindi' },
];

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'preferredLanguage',
    },
  });

// Keep <html lang> in sync so browser reading tools, spellcheck, and CSS
// :lang() selectors pick the right script.
const syncHtmlLang = (lng: string) => {
  if (typeof document !== 'undefined') document.documentElement.lang = lng;
};
syncHtmlLang(i18n.language || 'en');
i18n.on('languageChanged', syncHtmlLang);

export default i18n;
