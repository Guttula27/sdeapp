import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../config/prisma/prisma.service';
import { TranslationsService, SOURCE_LANGUAGE } from './translations.service';

/**
 * Registry of every entity type that owns translatable text. Adding a
 * new translatable model means adding ONE row here — the backfill +
 * the "enable language" hook pick it up automatically.
 *
 * Each row:
 *   - `type`     : the canonical entityType used in Translation rows.
 *   - `model`    : the Prisma model name (lowercased) used for findMany.
 *   - `fields`   : list of source columns to translate. Must match the
 *                  fields each module's create/update path already passes
 *                  to translations.upsertAll, otherwise the backfill
 *                  would create rows that hydrate() doesn't read.
 */
const TRANSLATABLE_ENTITIES: Array<{
  type: string;
  model: string;
  fields: string[];
}> = [
  { type: 'Business',     model: 'business',     fields: ['name', 'description', 'address', 'addressLine1', 'addressLine2'] },
  { type: 'Outlet',       model: 'outlet',       fields: ['name', 'description', 'address', 'addressLine1', 'addressLine2'] },
  { type: 'Category',     model: 'category',     fields: ['name'] },
  { type: 'Subcategory',  model: 'subcategory',  fields: ['name'] },
  { type: 'Item',         model: 'item',         fields: ['name', 'description', 'shortDescription'] },
  { type: 'Variant',      model: 'variant',      fields: ['name'] },
  { type: 'Topping',      model: 'topping',      fields: ['name'] },
  { type: 'ToppingOption',model: 'toppingOption',fields: ['name'] },
  { type: 'CustomerTag',  model: 'customerTag',  fields: ['name'] },
  { type: 'Dispute',      model: 'dispute',      fields: ['description'] },
];

/**
 * Walks every translatable entity in the DB and pushes the source text
 * through translations.upsertAll(). Used in two flows:
 *
 *   1. Admin adds a new language — backfill so existing entities have
 *      translations under the new code instead of silently falling
 *      back to English (which produces a half-translated UI).
 *   2. Admin enables a previously-disabled language — same problem.
 *
 * Runs as fire-and-forget from the LanguagesService caller; the
 * admin gets an immediate response while the backfill streams in
 * the background. Each upsertAll has its own try/catch so a failure
 * on one entity doesn't stop the rest.
 */
@Injectable()
export class TranslationBackfillService {
  private readonly logger = new Logger(TranslationBackfillService.name);
  // Prevents two concurrent backfills for the same language from
  // double-translating every row. Toggling a language fast in the UI
  // won't pile up jobs.
  private inFlight = new Set<string>();

  constructor(
    private prisma: PrismaService,
    private translations: TranslationsService,
  ) {}

  /**
   * Runs a backfill for `languageCode`. Iterates every translatable
   * entity, for every row, and calls upsertAll. The upsertAll path
   * already short-circuits when a target row exists, so re-running
   * the backfill is a no-op for entities that have already been
   * translated.
   */
  async run(languageCode: string): Promise<void> {
    if (languageCode === SOURCE_LANGUAGE) return; // English IS the source
    if (this.inFlight.has(languageCode)) {
      this.logger.warn(`backfill for ${languageCode} already in flight; skipping`);
      return;
    }
    this.inFlight.add(languageCode);

    this.logger.log(`backfill starting for ${languageCode}`);
    const started = Date.now();
    let totalRows = 0;
    let errored = 0;

    try {
      for (const entity of TRANSLATABLE_ENTITIES) {
        for await (const row of this.streamRows(entity)) {
          const fields: Record<string, string> = {};
          for (const f of entity.fields) {
            const v = (row as any)[f];
            if (typeof v === 'string' && v.trim()) fields[f] = v;
          }
          if (Object.keys(fields).length === 0) continue;
          try {
            await this.translations.upsertAll(entity.type, row.id, fields);
            totalRows++;
          } catch (e: any) {
            errored++;
            this.logger.warn(`backfill ${entity.type}/${row.id} → ${languageCode} failed: ${e?.message}`);
          }
        }
      }
    } finally {
      this.inFlight.delete(languageCode);
    }

    const elapsedMs = Date.now() - started;
    this.logger.log(
      `backfill for ${languageCode} done — ${totalRows} entities translated, ${errored} errors, ${elapsedMs}ms`,
    );
  }

  /**
   * Stream every translatable row of an entity in cursor-paginated
   * batches so the backfill never buffers the whole table in memory.
   * The earlier non-streaming `findMany({ select })` was fine at seed
   * scale but would OOM the API once any entity (most likely Item)
   * grew past a few tens of thousands.
   */
  private async *streamRows(
    entity: typeof TRANSLATABLE_ENTITIES[number],
  ): AsyncGenerator<{ id: string }> {
    const model = (this.prisma as any)[entity.model];
    if (!model || typeof model.findMany !== 'function') {
      this.logger.warn(`no Prisma model "${entity.model}" — skipping ${entity.type}`);
      return;
    }
    const selectArg: Record<string, true> = { id: true };
    for (const f of entity.fields) selectArg[f] = true;

    const BATCH = 500;
    let cursor: string | undefined;
    while (true) {
      const batch: Array<{ id: string }> = await model.findMany({
        select: selectArg,
        take: BATCH,
        orderBy: { id: 'asc' },
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      });
      if (batch.length === 0) return;
      for (const row of batch) yield row;
      if (batch.length < BATCH) return;
      cursor = batch[batch.length - 1].id;
    }
  }
}
