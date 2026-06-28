import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

/**
 * Resource loading is dynamic via Vite's import.meta.glob — any JSON
 * dropped into ./locales/ is auto-registered as a resource bundle.
 * That keeps the contract simple: the build-time
 * scripts/generate-locales.mjs writes <lang>.json files from the
 * platform's enabled-languages list, this loader picks them up on the
 * next refresh, and adding a new language is zero-code.
 *
 * en.json is the source-of-truth; the other files are auto-generated
 * but check-in-able, so they ship inside the PWA bundle (no runtime
 * translation call, no failure mode, no per-pageview latency).
 *
 * .sources.json sidecars are generation-time bookkeeping (which
 * English string was each translated value derived from) and are
 * filtered out — they have no role at runtime.
 */
const modules = import.meta.glob<{ default: Record<string, any> }>(
  './locales/*.json',
  { eager: true },
);

const resources: Record<string, { translation: any }> = {};
for (const [path, mod] of Object.entries(modules)) {
  // path looks like './locales/hi.json' or './locales/hi.sources.json'
  const file = path.split('/').pop() || '';
  if (file.endsWith('.sources.json')) continue;
  const code = file.replace(/\.json$/, '');
  if (!code) continue;
  resources[code] = { translation: mod.default };
}

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

export default i18n;
