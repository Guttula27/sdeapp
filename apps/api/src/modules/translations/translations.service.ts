import { Inject, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../config/prisma/prisma.service';
import { TRANSLATION_PROVIDER, TranslationProvider } from './translation-provider';

export const SOURCE_LANGUAGE = 'en';

/**
 * Translation primitives used across modules.
 *
 * Conventions:
 *   - `entityType` is a stable string like "Item", "Category", "Outlet". For
 *     denormalised snapshots (e.g. an item's name copied into an order item)
 *     use a compound key, e.g. "OrderItem.snapshotName".
 *   - All translations are stored *into* every enabled language, including
 *     English (the source). Source rows make hydration uniform and let admins
 *     edit source text safely.
 *   - The stub provider tags translations with the target language; swap in a
 *     real provider via TRANSLATION_PROVIDER without changing call sites.
 */
@Injectable()
export class TranslationsService {
  private readonly logger = new Logger(TranslationsService.name);

  constructor(
    private prisma: PrismaService,
    @Inject(TRANSLATION_PROVIDER) private provider: TranslationProvider,
  ) {}

  /** Returns enabled language codes. Cached per call (no in-memory cache to keep things simple). */
  async enabledLanguages(): Promise<string[]> {
    const rows = await this.prisma.language.findMany({
      where: { isEnabled: true },
      select: { code: true },
    });
    return rows.map((r) => r.code);
  }

  /**
   * Translate `fields` to every enabled language and persist them. Idempotent —
   * safe to call after each create/update. Pass only the source (English)
   * strings; this method fans out to all languages.
   */
  async upsertAll(
    entityType: string,
    entityId: string,
    fields: Record<string, string | null | undefined>,
  ): Promise<void> {
    const cleanFields: Record<string, string> = {};
    for (const [k, v] of Object.entries(fields)) {
      if (typeof v === 'string' && v.trim()) cleanFields[k] = v;
    }
    if (Object.keys(cleanFields).length === 0) return;

    const languages = await this.enabledLanguages();

    const rows: Array<{
      entityType: string;
      entityId: string;
      fieldName: string;
      languageCode: string;
      value: string;
    }> = [];

    // Translate every (field, language) pair in parallel so a slow provider
    // doesn't compound: serial × N languages used to push category-create
    // past the browser's 15s axios timeout when a Lingva mirror was down.
    const jobs: Array<Promise<typeof rows[number]>> = [];
    for (const [fieldName, sourceText] of Object.entries(cleanFields)) {
      for (const lang of languages) {
        jobs.push(
          (async () => {
            const value =
              lang === SOURCE_LANGUAGE
                ? sourceText
                : await this.provider.translate(sourceText, SOURCE_LANGUAGE, lang).catch((e) => {
                    this.logger.warn(`translate failed (${entityType}.${fieldName} → ${lang}): ${e.message}`);
                    return sourceText;
                  });
            return { entityType, entityId, fieldName, languageCode: lang, value };
          })(),
        );
      }
    }
    rows.push(...(await Promise.all(jobs)));

    // Upsert in a single transaction — bulk createMany doesn't support upsert,
    // so we use the per-row upsert which is fine at this volume.
    await this.prisma.$transaction(
      rows.map((r) =>
        this.prisma.translation.upsert({
          where: {
            entityType_entityId_fieldName_languageCode: {
              entityType: r.entityType,
              entityId: r.entityId,
              fieldName: r.fieldName,
              languageCode: r.languageCode,
            },
          },
          update: { value: r.value, source: 'auto' },
          create: r,
        }),
      ),
    );
  }

  /** Remove every translation row for an entity (call from delete handlers). */
  async deleteAll(entityType: string, entityId: string): Promise<void> {
    await this.prisma.translation.deleteMany({ where: { entityType, entityId } });
  }

  /**
   * For a batch of entity ids of the same type, return a map
   * `id → { fieldName → translatedValue }` for the requested language.
   * Falls back to the source value (English) when a translation is missing.
   */
  async lookup(
    entityType: string,
    entityIds: string[],
    languageCode: string,
  ): Promise<Map<string, Record<string, string>>> {
    const map = new Map<string, Record<string, string>>();
    if (entityIds.length === 0 || !languageCode) return map;

    const rows = await this.prisma.translation.findMany({
      where: { entityType, entityId: { in: entityIds }, languageCode },
    });
    for (const r of rows) {
      const existing = map.get(r.entityId) ?? {};
      existing[r.fieldName] = r.value;
      map.set(r.entityId, existing);
    }
    return map;
  }

  /**
   * Hydrate one or many objects in-place by replacing `fields[*]` with the
   * value for the user's preferred language. Returns the same array reference
   * (or single object) for ergonomic chaining.
   *
   * Usage:
   *   await translations.hydrate('Item', items, ['name', 'description'], userLang)
   */
  async hydrate<T extends { id: string }>(
    entityType: string,
    rows: T | T[] | null | undefined,
    fields: Array<keyof T & string>,
    languageCode: string | null | undefined,
  ): Promise<T | T[] | null | undefined> {
    if (!rows || !languageCode || languageCode === SOURCE_LANGUAGE) return rows;
    const list = Array.isArray(rows) ? rows : [rows];
    if (list.length === 0) return rows;

    const ids = list.map((r) => r.id).filter(Boolean);
    const map = await this.lookup(entityType, ids, languageCode);
    for (const row of list) {
      const t = map.get(row.id);
      if (!t) continue;
      for (const f of fields) {
        if (t[f] != null) (row as any)[f] = t[f];
      }
    }
    return rows;
  }
}
