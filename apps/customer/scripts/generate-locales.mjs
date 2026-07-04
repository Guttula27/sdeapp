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
// "Existing only" mode — only refresh locales that already have a
// committed JSON file. Skips greenfield generation entirely. The
// prebuild hook runs in this mode so a deploy never hammers Lingva
// from inside a build container (which always loses against per-IP
// throttles); new languages are translated locally and committed.
const existingOnly = args.includes('--existing-only') || process.env.LOCALE_EXISTING_ONLY === '1';

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
  ? process.env.LINGVA_URL.split(',').map((s) => s.trim().replace(/\/$/, '')).filter(Boolean)
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
// Concurrent in-flight translation requests. Lingva mirrors handle a
// handful in parallel without complaining; serial requests left the
// run an order of magnitude slower than needed.
const CONCURRENCY = parseInt(process.env.LINGVA_CONCURRENCY || '6', 10);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Counts consecutive failures per host — drives exponential backoff so
// a flaky mirror gets a short timeout the first time and progressively
// longer ones if it keeps failing. Resets on every successful response.
const hostFailureCount = new Map();
const BACKOFF_BASE_MS = 5_000;   // 1st fail: 5s, 2nd: 10s, 3rd: 20s, 4th: 40s, cap 60s
const BACKOFF_CAP_MS = 60_000;
let nextWorkerIdx = 0;
function nextWorkerStart() {
  // Round-robin starting mirror per worker so we don't synchronize on
  // the first host. With concurrency=4 and 2 hosts, workers 0/2 start
  // at host 0, workers 1/3 start at host 1.
  const i = nextWorkerIdx;
  nextWorkerIdx = (nextWorkerIdx + 1) % Math.max(1, HOSTS.length);
  return i;
}

async function translateOne(text, fromCode, toCode, workerStart = 0) {
  if (!text || fromCode === toCode) return text;
  const { frozen, map } = freezePlaceholders(text);
  const encoded = encodeURIComponent(frozen);
  let lastError = null;
  // Up to three passes through the rotated mirror list. After each pass,
  // if every mirror is in cooldown, wait for the soonest one with jitter
  // so workers don't all retry at exactly the same instant.
  for (let pass = 0; pass < 3; pass++) {
    for (let i = 0; i < HOSTS.length; i++) {
      const host = HOSTS[(workerStart + i) % HOSTS.length];
      const blockedUntil = blockedHosts.get(host) ?? 0;
      if (blockedUntil > Date.now()) continue;
      try {
        const res = await fetch(`${host}/api/v1/${fromCode}/${toCode}/${encoded}`, {
          method: 'GET',
          headers: { Accept: 'application/json' },
          signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        });
        if (!res.ok) {
          // HTTP error = mirror is alive but rejecting. Exponential backoff.
          const fails = (hostFailureCount.get(host) ?? 0) + 1;
          hostFailureCount.set(host, fails);
          const backoff = Math.min(BACKOFF_BASE_MS * 2 ** (fails - 1), BACKOFF_CAP_MS);
          blockedHosts.set(host, Date.now() + backoff);
          lastError = new Error(`${host} ${res.status}`);
          continue;
        }
        const data = await res.json();
        if (typeof data?.translation === 'string' && data.translation.trim()) {
          hostFailureCount.set(host, 0); // success resets backoff
          await sleep(REQUEST_GAP_MS);
          return thawPlaceholders(data.translation, map);
        }
        lastError = new Error(`${host} no translation`);
      } catch (e) {
        // Timeout / network error: short cooldown, don't blacklist for a full minute.
        // Bumping failure count still escalates if the mirror is genuinely down.
        const fails = (hostFailureCount.get(host) ?? 0) + 1;
        hostFailureCount.set(host, fails);
        const backoff = Math.min(BACKOFF_BASE_MS * 2 ** (fails - 1), BACKOFF_CAP_MS);
        blockedHosts.set(host, Date.now() + backoff);
        lastError = e;
      }
    }
    if (pass < 2) {
      const earliest = Math.min(...HOSTS.map((h) => blockedHosts.get(h) ?? Date.now()));
      const wait = Math.max(0, earliest - Date.now());
      if (wait > 0 && wait < BACKOFF_CAP_MS + 5_000) {
        // Jitter ± 30% — keeps concurrent workers from synchronizing
        // on the same wakeup tick.
        const jitter = Math.floor(wait * (Math.random() * 0.6 - 0.3));
        await sleep(Math.max(200, wait + jitter));
      } else {
        break;
      }
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Lingva failed');
}

// Walk the source tree, classify every leaf string at `path` as either
// "carry" (use the previous translation) or "translate" (needs Lingva).
// Returns { carryMap: path→translated, needSet: Set<sourceText> }.
function classifyTree(node, previous, prevSrc, path = '', acc = { carryMap: {}, needSet: new Set() }) {
  if (typeof node === 'string') {
    if (!force && previous && prevSrc && prevSrc[path] === node) {
      const carried = getNested(previous, path);
      if (typeof carried === 'string') { acc.carryMap[path] = carried; return acc; }
    }
    // First auto-run on a hand-curated dictionary — don't clobber the
    // human's work, but still mark it as "carried" so we don't fire
    // a Lingva call to overwrite it.
    if (!force && previous && !prevSrc) {
      const carried = getNested(previous, path);
      if (typeof carried === 'string' && carried.trim()) { acc.carryMap[path] = carried; return acc; }
    }
    // existing-only mode (used by the prod prebuild hook) treats
    // "already present in the previous locale file" as good enough,
    // even when the previous value is the English fallback. This
    // prevents prod from hammering Lingva every deploy for strings
    // that failed translation locally — the developer commits when
    // Lingva recovers, prod picks it up next build. Genuinely new
    // strings (not in previous at all) still hit the translator.
    if (!force && existingOnly && previous) {
      const carried = getNested(previous, path);
      if (typeof carried === 'string') { acc.carryMap[path] = carried; return acc; }
    }
    acc.needSet.add(node);
    return acc;
  }
  if (Array.isArray(node)) {
    for (let i = 0; i < node.length; i++) classifyTree(node[i], previous, prevSrc, `${path}[${i}]`, acc);
    return acc;
  }
  if (node && typeof node === 'object') {
    for (const [k, v] of Object.entries(node)) classifyTree(v, previous, prevSrc, path ? `${path}.${k}` : k, acc);
    return acc;
  }
  return acc;
}

// Concurrent batch translation. Fires CONCURRENCY requests at a time,
// keeps the rest queued. Each completed call frees a slot. Errors are
// caught and the English source is kept so one bad string doesn't
// abort the run.
// Tracks which source strings hit the English fallback in this batch so
// the sidecar can skip them — next run will then retry these instead of
// treating the English fallback as a settled translation.
async function translateBatch(strings, lang, cache, failedSet) {
  const queue = [...strings];
  let done = 0;
  const total = queue.length;
  async function worker() {
    const workerStart = nextWorkerStart();
    while (queue.length) {
      const src = queue.shift();
      if (cache.has(src)) { done++; continue; }
      try {
        const t = await translateOne(src, 'en', lang, workerStart);
        cache.set(src, t);
      } catch (e) {
        cache.set(src, src);
        failedSet.add(src);
        console.log(`  × "${src.slice(0, 60)}" (${e.message}) — kept English`);
      }
      done++;
      if (done % 25 === 0 || done === total) {
        process.stdout.write(`  · ${done}/${total}\r`);
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, queue.length) }, worker));
  process.stdout.write('\n');
}

// After the cache is populated, walk the source again and emit the
// translated tree. Uses `carryMap` for previous-translation paths and
// the cache (or the English source as fallback) for everything else.
function buildTree(node, cache, carryMap, path = '') {
  if (typeof node === 'string') {
    if (carryMap[path] !== undefined) return carryMap[path];
    return cache.get(node) ?? node;
  }
  if (Array.isArray(node)) return node.map((v, i) => buildTree(v, cache, carryMap, `${path}[${i}]`));
  if (node && typeof node === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(node)) out[k] = buildTree(v, cache, carryMap, path ? `${path}.${k}` : k);
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

    if (existingOnly && !existsSync(outFile)) {
      console.log(`\n=== ${lang} === skipped (existing-only mode, run \`--langs ${lang}\` locally to seed)`);
      continue;
    }

    const previous = existsSync(outFile) ? JSON.parse(readFileSync(outFile, 'utf8')) : null;
    const prevSrc  = !force && existsSync(sidecar) ? JSON.parse(readFileSync(sidecar, 'utf8')) : null;

    console.log(`\n=== ${lang} ===`);
    const cache = new Map();
    const failedSources = new Set();
    const { carryMap, needSet } = classifyTree(source, previous, prevSrc);
    console.log(`  carried ${Object.keys(carryMap).length} · translating ${needSet.size} unique strings (concurrency=${CONCURRENCY})`);
    if (needSet.size > 0) await translateBatch([...needSet], lang, cache, failedSources);
    const translated = buildTree(source, cache, carryMap);

    writeFileSync(outFile, JSON.stringify(translated, null, 2) + '\n');
    // Sidecar tracks the source value behind each translated key so the
    // next run can skip unchanged entries. Behaviour differs by mode:
    //   - Interactive / dev runs (default): exclude paths whose
    //     translation fell back to English, so a future run retries
    //     them when the translator recovers. This is the safety net
    //     against the dictionary drifting into stale English forever.
    //   - --existing-only (prod prebuild): INCLUDE failed paths too.
    //     Prod docker builds don't persist output back to git, so
    //     without this every deploy would re-hit Lingva for the same
    //     failed strings forever. Marking them settled means prod
    //     stops trying; when Lingva recovers, dev runs the generator
    //     locally with --force to re-attempt and commit real
    //     translations.
    const sidecarOut = {};
    for (const [path, val] of Object.entries(sourceFlat)) {
      if (!existingOnly && failedSources.has(val)) continue;
      sidecarOut[path] = val;
    }
    writeFileSync(sidecar, JSON.stringify(sidecarOut, null, 2) + '\n');
    const recovered = Object.keys(sourceFlat).length - Object.keys(sidecarOut).length;
    console.log(`✓ Wrote ${outFile}${recovered ? ` (${recovered} keys deferred — will retry next run)` : ''}`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
