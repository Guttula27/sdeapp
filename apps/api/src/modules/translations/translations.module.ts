import { Global, Logger, Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { TranslationsService } from './translations.service';
import { TranslationBackfillService } from './translation-backfill.service';
import { TranslationsAdminController } from './translations-admin.controller';
import { TranslationsProcessor } from './translations.processor';
import { TRANSLATIONS_QUEUE } from './translations-queue.constants';
import { StubTranslationProvider, TRANSLATION_PROVIDER, TranslationProvider } from './translation-provider';
import { BhashiniTranslationProvider } from './bhashini-translation-provider';
import { LingvaTranslationProvider } from './lingva-translation-provider';

const logger = new Logger('TranslationsModule');

/**
 * Selection order:
 *   1. TRANSLATION_PROVIDER_NAME=bhashini  → Bhashini (needs BHASHINI_USER_ID / BHASHINI_API_KEY)
 *   2. TRANSLATION_PROVIDER_NAME=lingva    → Lingva (no key)
 *   3. TRANSLATION_PROVIDER_NAME=stub      → stub (dev only — appears verbatim in DB!)
 *   4. (default) auto: Bhashini if creds present, else Lingva.
 *
 * The Stub provider returns `[<lang>] <english>` and never throws — useful
 * for dev / screenshots but TOXIC for production because the tagged string
 * lands in Translation.value and pollutes the menu forever. So the Stub is
 * NEVER part of the auto-fallback chain — it is only used when explicitly
 * opted into via TRANSLATION_PROVIDER_NAME=stub. When the real providers
 * fail, the chain throws and translations.service catches it, persisting
 * the English source instead. The customer menu then shows English (the
 * original copy the admin typed) rather than [te] english.
 */
function buildProvider(): TranslationProvider {
  const explicit = (process.env.TRANSLATION_PROVIDER_NAME || '').trim().toLowerCase();
  const hasBhashini = !!(process.env.BHASHINI_USER_ID && process.env.BHASHINI_API_KEY);

  const stub = new StubTranslationProvider();
  const lingva = new LingvaTranslationProvider();
  const bhashini = new BhashiniTranslationProvider();

  const order: TranslationProvider[] = [];
  if (explicit === 'bhashini') {
    if (!hasBhashini) logger.warn('TRANSLATION_PROVIDER_NAME=bhashini but credentials missing — falling back to Lingva');
    order.push(bhashini, lingva);
  } else if (explicit === 'lingva') {
    order.push(lingva);
  } else if (explicit === 'stub') {
    // Explicit opt-in only — never picked automatically. Translations
    // service still detects stub-tagged values and refuses to persist
    // them, so even this path no longer poisons the DB.
    logger.warn('TRANSLATION_PROVIDER_NAME=stub — translations are pseudo-localised. Never use in production.');
    order.push(stub);
  } else if (hasBhashini) {
    logger.log('Using Bhashini (with Lingva fallback)');
    order.push(bhashini, lingva);
  } else {
    logger.warn('Bhashini credentials not set — using Lingva (free public Google proxy). Set BHASHINI_USER_ID and BHASHINI_API_KEY to switch.');
    order.push(lingva);
  }

  return {
    async translate(text: string, from: string, to: string) {
      let lastError: unknown = null;
      for (const p of order) {
        try {
          return await p.translate(text, from, to);
        } catch (e) {
          lastError = e;
          logger.warn(`${p.constructor.name} failed for ${from}→${to}: ${(e as any)?.message ?? e}`);
        }
      }
      throw lastError instanceof Error ? lastError : new Error('All translation providers failed');
    },
  };
}

@Global()
@Module({
  imports: [
    // Bull queue for provider-side translation fan-out. Workers run
    // in-process (Nest's default for @Processor). Heavy multi-tenant
    // installs can later split workers to a separate node by setting
    // up a separate process consuming this queue with no API
    // controllers mounted.
    BullModule.registerQueue({ name: TRANSLATIONS_QUEUE }),
  ],
  controllers: [TranslationsAdminController],
  providers: [
    TranslationsService,
    TranslationBackfillService,
    TranslationsProcessor,
    StubTranslationProvider,
    BhashiniTranslationProvider,
    LingvaTranslationProvider,
    { provide: TRANSLATION_PROVIDER, useFactory: buildProvider },
  ],
  exports: [TranslationsService, TranslationBackfillService],
})
export class TranslationsModule {}
