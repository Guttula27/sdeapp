import { Inject, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../config/prisma/prisma.service';
import { TRANSLATION_PROVIDER, TranslationProvider } from './translation-provider';

export const SOURCE_LANGUAGE = 'en';

/**
 * Detect a stub-provider tagged value like "[te] english text" or
 * "[हिन्दी] english text" — the Stub provider's output format. Such values
 * MUST NOT be persisted (we'd see them in the customer menu) and MUST be
 * ignored on read (any legacy poisoned row hydrates to source instead).
 *
 * Regex: anchored open-bracket, then 1–12 non-bracket chars (covers
 * 2-letter ISO codes like "te" and short Devanagari script labels like
 * "हिन्दी"), then close-bracket and at least one whitespace.
 */
export function isStubTaggedValue(s: string | null | undefined): boolean {
  if (!s) return false;
  return /^\[[^\]]{1,12}\]\s/.test(s);
}

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
            const raw =
              lang === SOURCE_LANGUAGE
                ? sourceText
                : await this.provider.translate(sourceText, SOURCE_LANGUAGE, lang).catch((e) => {
                    this.logger.warn(`translate failed (${entityType}.${fieldName} → ${lang}): ${e.message}`);
                    return sourceText;
                  });
            // Defensive: if the provider chain returned a stub-tagged
            // value (only possible when TRANSLATION_PROVIDER_NAME=stub
            // is explicitly set), drop it and persist the English
            // source instead. The customer menu shows English — never
            // "[te] english" — even if someone misconfigures env.
            const value = isStubTaggedValue(raw) ? sourceText : raw;
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
      // Drop stub-tagged values silently. hydrate() then leaves the
      // field at its source English value rather than rendering
      // "[te] Masala Dosa" to a customer. The repair endpoint
      // (repairStubTagged) can purge these rows so a next backfill
      // overwrites them with real translations.
      if (isStubTaggedValue(r.value)) continue;
      const existing = map.get(r.entityId) ?? {};
      existing[r.fieldName] = r.value;
      map.set(r.entityId, existing);
    }
    return map;
  }

  /**
   * One-shot cleanup: delete every Translation row whose value matches
   * the stub-provider tagged format. Safe to run any time — the next
   * backfill (`TranslationBackfillService.run(<lang>)`) will recreate
   * the rows using the currently configured real provider.
   * Returns the number of rows removed for reporting.
   */
  async repairStubTagged(): Promise<{ deleted: number }> {
    // MySQL pattern: anything starting with `[<short text>]<space>`.
    // We can't run a regex through Prisma's MySQL connector portably,
    // so we read candidates by simple LIKE then verify with the JS
    // regex helper — slightly chatty but safe.
    const candidates = await this.prisma.translation.findMany({
      where: { value: { startsWith: '[' } },
      select: { entityType: true, entityId: true, fieldName: true, languageCode: true, value: true },
    });
    const toDelete = candidates.filter((c) => isStubTaggedValue(c.value));
    if (toDelete.length === 0) return { deleted: 0 };

    await this.prisma.$transaction(
      toDelete.map((c) =>
        this.prisma.translation.delete({
          where: {
            entityType_entityId_fieldName_languageCode: {
              entityType: c.entityType,
              entityId: c.entityId,
              fieldName: c.fieldName,
              languageCode: c.languageCode,
            },
          },
        }),
      ),
    );
    this.logger.log(`repairStubTagged: deleted ${toDelete.length} stub-tagged rows`);
    return { deleted: toDelete.length };
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
