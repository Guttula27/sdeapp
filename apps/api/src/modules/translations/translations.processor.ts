import { Inject, Logger } from '@nestjs/common';
import { Process, Processor } from '@nestjs/bull';
import { Job } from 'bull';
import { PrismaService } from '../../config/prisma/prisma.service';
import { TranslationsService, SOURCE_LANGUAGE, isStubTaggedValue } from './translations.service';
import { TRANSLATION_PROVIDER, TranslationProvider } from './translation-provider';
import { TRANSLATIONS_QUEUE, TRANSLATE_FIELD_JOB, TranslateFieldJobData } from './translations-queue.constants';

/**
 * Bull worker for the translation queue.
 *
 * Replaces the synchronous Promise.all the menu/business edit path
 * used to do inside TranslationsService.upsertAll(). The benefits:
 *   • a slow / failing provider can't bottleneck a menu save — the
 *     staff member sees a fast 200 even if Bhashini is down.
 *   • retries + exponential backoff handled by Bull instead of
 *     hand-rolled try/catch.
 *   • dedup on jobId means burst writes (drag-reorder, batch import)
 *     don't multiply provider load.
 *
 * The handler re-checks the manual-override flag at run time so a
 * race between an admin's manual save and a queued auto-translate
 * always lets the manual win.
 */
@Processor(TRANSLATIONS_QUEUE)
export class TranslationsProcessor {
  private readonly logger = new Logger(TranslationsProcessor.name);

  constructor(
    private prisma: PrismaService,
    private translations: TranslationsService,
    @Inject(TRANSLATION_PROVIDER) private provider: TranslationProvider,
  ) {}

  // Process up to 5 jobs in parallel per worker process. Provider
  // calls (Bhashini/Lingva) are network-bound; the DB writes are
  // small UPDATEs. 5 is a defensible default — higher risks
  // breaching provider rate limits, lower leaves the queue draining
  // serially under a cold-language burst.
  @Process({ name: TRANSLATE_FIELD_JOB, concurrency: 5 })
  async handleTranslate(job: Job<TranslateFieldJobData>) {
    const { entityType, entityId, fieldName, sourceText, languageCode } = job.data;
    if (!sourceText?.trim()) return;
    if (!languageCode || languageCode === SOURCE_LANGUAGE) return;

    // Skip if an admin already curated this cell — the manual flag
    // also gates the same skip in upsertAll(), but a manual save can
    // land AFTER this job was enqueued, so re-check at run time.
    const manual = await this.prisma.translation.findUnique({
      where: {
        entityType_entityId_fieldName_languageCode: { entityType, entityId, fieldName, languageCode },
      },
      select: { source: true },
    });
    if (manual?.source === 'manual') return;

    let translated: string;
    try {
      translated = await this.provider.translate(sourceText, SOURCE_LANGUAGE, languageCode);
    } catch (e: any) {
      this.logger.warn(`translate ${entityType}.${fieldName} → ${languageCode} failed: ${e?.message}`);
      // Let Bull retry by re-throwing — the queue is configured with
      // backoff in the module registration.
      throw e;
    }
    // Stub-tagged values (only emitted when TRANSLATION_PROVIDER_NAME=
    // stub is explicitly set) would poison the menu with `[te] english`.
    // Persist the English source instead so the customer always sees
    // readable text.
    const value = isStubTaggedValue(translated) ? sourceText : translated;

    await this.translations.writeAutoTranslation({
      entityType, entityId, fieldName, languageCode, value,
    });
  }
}
