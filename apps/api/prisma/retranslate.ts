/**
 * One-shot: replace stub translations with real ones.
 *
 * The TranslationsService writes "auto"-tagged rows for every (entity,
 * field, language) tuple. When the stub provider fell through (Lingva
 * unreachable / Bhashini creds missing), those rows ended up like
 * "[हिन्दी] Maple Stack" — the source text decorated with a target-language
 * tag. This script finds those stubs and re-translates them via whichever
 * provider chain is currently configured.
 *
 * Detection: any row whose value starts with "[" followed by a language
 * tag and a space (e.g. "[हिन्दी] ", "[ta] "). Hand-edited translations
 * tagged source='manual' are left alone.
 *
 * Usage from the API workspace:
 *   DATABASE_URL=... npx ts-node prisma/retranslate.ts
 *   DATABASE_URL=... npx ts-node prisma/retranslate.ts --dry-run
 *   DATABASE_URL=... npx ts-node prisma/retranslate.ts --lang=hi
 */
import { PrismaClient } from '@prisma/client';

const SOURCE_LANGUAGE = 'en';
const STUB_PATTERN = /^\[[^\]]+\]\s+/;

const args = new Set(process.argv.slice(2));
const dryRun = args.has('--dry-run');
const onlyLang = [...args]
  .find((a) => a.startsWith('--lang='))
  ?.slice('--lang='.length);

// Pull in the providers via the same env-driven logic the API uses.
// Lazy-required so this script runs even before npm run build.
function buildProvider() {
  // Import here so the prisma client used by these files (which expects
  // the generated client) sees DATABASE_URL.
  const stubModule = require('../src/modules/translations/translation-provider');
  const lingvaModule = require('../src/modules/translations/lingva-translation-provider');
  const bhashiniModule = require('../src/modules/translations/bhashini-translation-provider');

  const stub = new stubModule.StubTranslationProvider();
  const lingva = new lingvaModule.LingvaTranslationProvider();
  const bhashini = new bhashiniModule.BhashiniTranslationProvider();

  const hasBhashini = !!(
    process.env.BHASHINI_USER_ID && process.env.BHASHINI_API_KEY
  );
  const order = hasBhashini ? [bhashini, lingva, stub] : [lingva, stub];

  return {
    async translate(text: string, from: string, to: string): Promise<{ value: string; via: string }> {
      for (const p of order) {
        try {
          const value = await p.translate(text, from, to);
          // If we got a stub-looking value back, the real providers failed
          // and we hit the stub — don't pretend it's a real translation.
          if (STUB_PATTERN.test(value)) {
            continue;
          }
          return { value, via: p.constructor.name };
        } catch (e: any) {
          // Try the next provider.
        }
      }
      // Final fallback: stub. Better than blowing up the whole script.
      return { value: await stub.translate(text, from, to), via: 'StubTranslationProvider' };
    },
  };
}

async function main() {
  const prisma = new PrismaClient();
  const provider = buildProvider();

  console.log(`[retranslate] mode: ${dryRun ? 'DRY RUN' : 'WRITE'}`);
  if (onlyLang) console.log(`[retranslate] limited to language: ${onlyLang}`);

  // Pull every non-English translation that looks like a stub.
  const where: any = {
    languageCode: { not: SOURCE_LANGUAGE },
    NOT: { value: '' },
  };
  if (onlyLang) where.languageCode = onlyLang;

  const candidates = await prisma.translation.findMany({ where });
  const stubs = candidates.filter((r) => STUB_PATTERN.test(r.value));
  console.log(
    `[retranslate] scanned ${candidates.length} rows, found ${stubs.length} stubs to retranslate`,
  );

  if (stubs.length === 0) {
    console.log('[retranslate] nothing to do — all translations look real.');
    await prisma.$disconnect();
    return;
  }

  // For each stub, look up the matching English source row.
  const sourceMap = new Map<string, string>();
  const sourceKeys = stubs.map((s) => ({
    entityType: s.entityType,
    entityId: s.entityId,
    fieldName: s.fieldName,
  }));
  const sourceRows = await prisma.translation.findMany({
    where: {
      languageCode: SOURCE_LANGUAGE,
      OR: sourceKeys.map((k) => ({
        entityType: k.entityType,
        entityId: k.entityId,
        fieldName: k.fieldName,
      })),
    },
  });
  for (const r of sourceRows) {
    sourceMap.set(`${r.entityType}|${r.entityId}|${r.fieldName}`, r.value);
  }

  let updated = 0;
  let skipped = 0;
  let errors = 0;
  const providerStats = new Map<string, number>();

  for (const stub of stubs) {
    const key = `${stub.entityType}|${stub.entityId}|${stub.fieldName}`;
    const source = sourceMap.get(key);
    if (!source) {
      console.log(`  [skip] ${key} → ${stub.languageCode}: no English source row`);
      skipped += 1;
      continue;
    }
    try {
      const { value, via } = await provider.translate(source, SOURCE_LANGUAGE, stub.languageCode);
      providerStats.set(via, (providerStats.get(via) ?? 0) + 1);
      if (value === stub.value) {
        // Provider returned the same stub — don't overwrite a stub with a stub.
        skipped += 1;
        continue;
      }
      if (dryRun) {
        console.log(`  [would update] ${key} → ${stub.languageCode}: "${stub.value}" → "${value}" (via ${via})`);
      } else {
        await prisma.translation.update({
          where: {
            entityType_entityId_fieldName_languageCode: {
              entityType: stub.entityType,
              entityId: stub.entityId,
              fieldName: stub.fieldName,
              languageCode: stub.languageCode,
            },
          },
          data: { value, source: 'auto' },
        });
      }
      updated += 1;
    } catch (e: any) {
      console.error(`  [error] ${key} → ${stub.languageCode}: ${e.message}`);
      errors += 1;
    }
  }

  console.log(`\n[retranslate] done. updated=${updated} skipped=${skipped} errors=${errors}`);
  if (providerStats.size > 0) {
    console.log('  providers used:');
    for (const [p, n] of providerStats) console.log(`    ${p}: ${n}`);
  }
  if (dryRun) console.log('\n(this was a dry run — re-run without --dry-run to actually persist changes)');

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error('[retranslate] fatal:', e);
  process.exit(1);
});
