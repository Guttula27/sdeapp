#!/usr/bin/env node
/**
 * Build-time generation of the customer PWA's locale dictionaries.
 *
 * en.json is the source-of-truth. This script reads every leaf string,
 * translates it via the same public Lingva proxy the platform's own
 * TranslationsService uses, and writes apps/customer/src/i18n/locales/
 * <lang>.json files mirroring en.json's shape.
 *
 * Why a build-time script and not a runtime endpoint:
 *   - PWA stays purely static — no auth needed for UI translations,
 *     no failure mode when the backend is down or rate-limited.
 *   - Translation cost is paid once per dictionary change, not per
 *     pageview.
 *   - Re-runs are idempotent: only strings whose English source
 *     changed get re-translated, the rest carry through from the
 *     previous run.
 *
 * Usage:
 *   # Auto-discover the active language set from the API (default).
 *   # When the platform admin enables a new language, the next build
 *   # picks it up automatically — no code change needed.
 *   node apps/customer/scripts/generate-locales.mjs
 *
 *   # Override with a fixed set (useful in CI without API access).
 *   node apps/customer/scripts/generate-locales.mjs --langs hi,ta,te,kn
 *
 *   # Force re-translate everything (ignore cached old translations):
 *   node apps/customer/scripts/generate-locales.mjs --force
 *
 *   # Point at a non-default API:
 *   VITE_API_URL=https://api.example.com/api/v1 \
 *     node apps/customer/scripts/generate-locales.mjs
 *
 *   # Use a specific Lingva mirror (override default failover order):
 *   LINGVA_URL=https://lingva.lunar.icu node apps/customer/scripts/generate-locales.mjs
 *
 * Wired into the PWA's npm prebuild hook so every deploy regenerates
 * any locale files missing for currently-enabled languages.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const LOCALES_DIR = join(__dirname, '..', 'src', 'i18n', 'locales');
const SOURCE_FILE = join(LOCALES_DIR, 'en.json');

// ─── CLI args ───────────────────────────────────────────────────
// Default list is only used if the API can't be reached (e.g. CI
// without network access to the API host). When a new language is
// added in the platform admin UI, it lands in the /languages
// endpoint and gets picked up by the next build automatically.
const FALLBACK_LANGS = ['hi', 'ta', 'te', 'kn', 'bn', 'mr', 'gu', 'ml', 'pa', 'ur'];
const args = process.argv.slice(2);
const langsArg = args.find((a) => a.startsWith('--langs='))
  || (args.includes('--langs') ? args[args.indexOf('--langs') + 1] : null);
const force = args.includes('--force');

async function resolveTargetLangs() {
  if (langsArg) {
    return langsArg.split(',').map((s) => s.trim()).filter(Boolean);
  }
  // Auto-discover: ask the API which languages are enabled. The public
  // GET /languages route returns only isEnabled=true rows.
  const apiBase = (process.env.VITE_API_URL || process.env.API_URL || 'http://localhost:3001/api/v1').replace(/\/$/, '');
  try {
    const res = await fetch(`${apiBase}/languages`, {
      signal: AbortSignal.timeout(5_000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = await res.json();
    const rows = Array.isArray(body?.data) ? body.data : (Array.isArray(body) ? body : []);
    const codes = rows
      .filter((l) => l?.code && l.code !== 'en' && l.isEnabled !== false)
      .map((l) => l.code);
    if (codes.length === 0) throw new Error('API returned no enabled languages');
    console.log(`→ Auto-discovered ${codes.length} language(s) from ${apiBase}: ${codes.join(', ')}`);
    return codes;
  } catch (e) {
    console.warn(`! Could not reach API (${e.message}); falling back to defaults: ${FALLBACK_LANGS.join(', ')}`);
    return FALLBACK_LANGS;
  }
}

const targetLangs = await resolveTargetLangs();
console.log(`→ Generating locales for: ${targetLangs.join(', ')}${force ? ' (force)' : ''}`);

// ─── Lingva client ──────────────────────────────────────────────
// Same mirror order + circuit-breaker shape as the platform's
// LingvaTranslationProvider so behaviour stays predictable.
const HOSTS = process.env.LINGVA_URL
  ? [process.env.LINGVA_URL.replace(/\/$/, '')]
  : ['https://lingva.lunar.icu', 'https://lingva.ml', 'https://translate.plausibility.cloud'];
const FETCH_TIMEOUT_MS = parseInt(process.env.LINGVA_TIMEOUT_MS || '8000', 10);
const blockedHosts = new Map();

// Protect i18next interpolation placeholders ({{name}}) from the
// translator — Lingva happily translates "{{value}}" into the target
// language ("{{मान}}" for Hindi), which breaks t('key', {value:N}).
// We swap them for opaque sentinels before sending, then restore.
function freezePlaceholders(text) {
  const map = [];
  const frozen = text.replace(/\{\{[^}]+\}\}/g, (m) => {
    const idx = map.length;
    map.push(m);
    // Sentinel uses letters + digits so translators leave it alone.
    return `ZZP${idx}ZZ`;
  });
  return { frozen, map };
}
function thawPlaceholders(translated, map) {
  return translated.replace(/ZZP(\d+)ZZ/g, (_, i) => map[Number(i)] ?? '');
}

// Polite per-request gap to keep Lingva's public mirrors happy.
const REQUEST_GAP_MS = parseInt(process.env.LINGVA_GAP_MS || '300', 10);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function translateOne(text, fromCode, toCode) {
  if (!text || fromCode === toCode) return text;
  const { frozen, map } = freezePlaceholders(text);
  const encoded = encodeURIComponent(frozen);
  let lastError = null;
  const now = Date.now();
  // Two passes — if every host is in cooldown on the first, wait it
  // out once and retry. Better than burning a whole dictionary's
  // worth of strings just because one bad host put them all to sleep
  // back-to-back.
  for (let pass = 0; pass < 2; pass++) {
    for (const host of HOSTS) {
      const blockedUntil = blockedHosts.get(host) ?? 0;
      if (blockedUntil > Date.now()) continue;
      try {
        const res = await fetch(`${host}/api/v1/${fromCode}/${toCode}/${encoded}`, {
          method: 'GET',
          headers: { Accept: 'application/json' },
          signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        });
        if (!res.ok) { blockedHosts.set(host, Date.now() + 60_000); lastError = new Error(`${host} ${res.status}`); continue; }
        const data = await res.json();
        if (typeof data?.translation === 'string' && data.translation.trim()) {
          await sleep(REQUEST_GAP_MS);
          return thawPlaceholders(data.translation, map);
        }
        lastError = new Error(`${host} no translation`);
      } catch (e) {
        blockedHosts.set(host, Date.now() + 60_000);
        lastError = e;
      }
    }
    if (pass === 0) {
      // Find the soonest cooldown end and wait for it.
      const earliest = Math.min(...HOSTS.map((h) => blockedHosts.get(h) ?? Date.now()));
      const wait = Math.max(0, earliest - Date.now());
      if (wait > 0 && wait < 65_000) {
        console.log(`  ↻ all mirrors cooling down, waiting ${Math.ceil(wait / 1000)}s…`);
        await sleep(wait + 250);
      } else {
        break;
      }
    }
  }
  void now;
  throw lastError instanceof Error ? lastError : new Error('Lingva failed');
}

// ─── Recursive walk ─────────────────────────────────────────────
// Map { sourceText -> translatedText } per language, populated as we
// go. Reuses translations for identical source strings (the dictionary
// has duplicates like "Save", "Cancel" across namespaces) so a 300-key
// dictionary may only fire ~250 Lingva calls.
async function translateTree(node, lang, cache, previous, prevSrc, path = '') {
  if (typeof node === 'string') {
    // Reuse the previous translation when the source hasn't changed —
    // saves Lingva budget on incremental runs.
    if (!force && previous && prevSrc && prevSrc[path] === node) {
      const carried = getNested(previous, path);
      if (typeof carried === 'string') return carried;
    }
    // No sidecar yet (first auto-generated run on a hand-curated
    // dictionary) but the key already has a translation — keep it.
    // Hand-curated values are higher quality than the auto path, and
    // wiping them on a script run would be a regression. The sidecar
    // written at the end of this run lets subsequent runs spot
    // legitimate source changes and retranslate those alone.
    if (!force && previous && !prevSrc) {
      const carried = getNested(previous, path);
      if (typeof carried === 'string' && carried.trim()) return carried;
    }
    if (cache.has(node)) return cache.get(node);
    process.stdout.write(`  • ${path} `);
    try {
      const translated = await translateOne(node, 'en', lang);
      cache.set(node, translated);
      console.log(`→ ${translated}`);
      return translated;
    } catch (e) {
      console.log(`× ${e.message} (keeping English)`);
      cache.set(node, node);
      return node;
    }
  }
  if (Array.isArray(node)) {
    const out = [];
    for (let i = 0; i < node.length; i++) {
      out.push(await translateTree(node[i], lang, cache, previous, prevSrc, `${path}[${i}]`));
    }
    return out;
  }
  if (node && typeof node === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(node)) {
      out[k] = await translateTree(v, lang, cache, previous, prevSrc, path ? `${path}.${k}` : k);
    }
    return out;
  }
  return node;
}

function getNested(obj, dotted) {
  if (!obj || !dotted) return undefined;
  return dotted.split('.').reduce((acc, k) => (acc == null ? acc : acc[k]), obj);
}

// Flatten the source tree into a path→value map. Used as the
// .sources sidecar so future runs can spot which strings changed.
function flatten(node, prefix = '') {
  const out = {};
  if (typeof node === 'string') { out[prefix] = node; return out; }
  if (node && typeof node === 'object' && !Array.isArray(node)) {
    for (const [k, v] of Object.entries(node)) {
      Object.assign(out, flatten(v, prefix ? `${prefix}.${k}` : k));
    }
  }
  return out;
}

// ─── Main ───────────────────────────────────────────────────────
async function main() {
  if (!existsSync(SOURCE_FILE)) {
    console.error(`Source file not found: ${SOURCE_FILE}`);
    process.exit(1);
  }
  const source = JSON.parse(readFileSync(SOURCE_FILE, 'utf8'));
  const sourceFlat = flatten(source);
  console.log(`Source has ${Object.keys(sourceFlat).length} strings.`);

  for (const lang of targetLangs) {
    if (lang === 'en') continue;
    const outFile = join(LOCALES_DIR, `${lang}.json`);
    const sidecar = join(LOCALES_DIR, `${lang}.sources.json`);

    const previous = existsSync(outFile) ? JSON.parse(readFileSync(outFile, 'utf8')) : null;
    const prevSrc  = !force && existsSync(sidecar) ? JSON.parse(readFileSync(sidecar, 'utf8')) : null;

    console.log(`\n=== ${lang} ===`);
    const cache = new Map();
    const translated = await translateTree(source, lang, cache, previous, prevSrc);

    writeFileSync(outFile, JSON.stringify(translated, null, 2) + '\n');
    // Sidecar tracks the source value behind each translated key so
    // the next run can skip unchanged entries.
    writeFileSync(sidecar, JSON.stringify(sourceFlat, null, 2) + '\n');
    console.log(`✓ Wrote ${outFile}`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
