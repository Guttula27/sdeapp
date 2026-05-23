import { Global, Logger, Module } from '@nestjs/common';
import { TranslationsService } from './translations.service';
import { StubTranslationProvider, TRANSLATION_PROVIDER, TranslationProvider } from './translation-provider';
import { BhashiniTranslationProvider } from './bhashini-translation-provider';
import { LingvaTranslationProvider } from './lingva-translation-provider';

const logger = new Logger('TranslationsModule');

/**
 * Selection order:
 *   1. TRANSLATION_PROVIDER_NAME=bhashini  → Bhashini (needs BHASHINI_USER_ID / BHASHINI_API_KEY)
 *   2. TRANSLATION_PROVIDER_NAME=lingva    → Lingva (no key)
 *   3. TRANSLATION_PROVIDER_NAME=stub      → stub (dev only)
 *   4. (default) auto: Bhashini if creds present, else Lingva, else stub.
 *
 * Wrap whichever real provider is picked in a fallback chain so a transient
 * upstream error doesn't lose the translation — fall through to the next
 * provider before finally degrading to the stub.
 */
function buildProvider(): TranslationProvider {
  const explicit = (process.env.TRANSLATION_PROVIDER_NAME || '').trim().toLowerCase();
  const hasBhashini = !!(process.env.BHASHINI_USER_ID && process.env.BHASHINI_API_KEY);

  const stub = new StubTranslationProvider();
  const lingva = new LingvaTranslationProvider();
  const bhashini = new BhashiniTranslationProvider();

  const order: TranslationProvider[] = [];
  if (explicit === 'bhashini') {
    if (!hasBhashini) logger.warn('TRANSLATION_PROVIDER_NAME=bhashini but credentials missing — falling back to Lingva then stub');
    order.push(bhashini, lingva, stub);
  } else if (explicit === 'lingva') {
    order.push(lingva, stub);
  } else if (explicit === 'stub') {
    order.push(stub);
  } else if (hasBhashini) {
    logger.log('Using Bhashini (with Lingva → stub fallback)');
    order.push(bhashini, lingva, stub);
  } else {
    logger.warn('Bhashini credentials not set — using Lingva (free public Google proxy). Set BHASHINI_USER_ID and BHASHINI_API_KEY to switch.');
    order.push(lingva, stub);
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
  providers: [
    TranslationsService,
    StubTranslationProvider,
    BhashiniTranslationProvider,
    LingvaTranslationProvider,
    { provide: TRANSLATION_PROVIDER, useFactory: buildProvider },
  ],
  exports: [TranslationsService],
})
export class TranslationsModule {}
