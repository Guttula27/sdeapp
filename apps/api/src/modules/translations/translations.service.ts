import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { PrismaService } from '../../config/prisma/prisma.service';
import { TRANSLATION_PROVIDER, TranslationProvider } from './translation-provider';
import { BhashiniTranslationProvider } from './bhashini-translation-provider';
import { LingvaTranslationProvider } from './lingva-translation-provider';
import { TRANSLATIONS_QUEUE, TRANSLATE_FIELD_JOB, TranslateFieldJobData } from './translations-queue.constants';

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
  // Optional — when the BullModule.registerQueue('translations') is
  // wired (Phase 3.5), translate jobs are enqueued here instead of
  // running synchronously in upsertAll(). The legacy code path stays
  // intact as a fallback so the service still works during early
  // boot / when Redis is down.
  @InjectQueue(TRANSLATIONS_QUEUE)
  private readonly translationsQueue?: Queue<TranslateFieldJobData>;
  private readonly logger = new Logger(TranslationsService.name);

  constructor(
    private prisma: PrismaService,
    @Inject(TRANSLATION_PROVIDER) private provider: TranslationProvider,
    private bhashini: BhashiniTranslationProvider,
    private lingva: LingvaTranslationProvider,
  ) {}

  /**
   * Operator-facing diagnostic: tries each concrete provider (Bhashini
   * first, then Lingva) with a sample string and reports back what
   * happened. Lets the admin see exactly which provider is wired up
   * and whether it's reachable from the API container without trawling
   * server logs. Hits the providers DIRECTLY (bypassing the chain) so
   * a failure in Bhashini doesn't mask a working Lingva.
   *
   * Returns:
   *   - env state (which provider the chain would pick, creds set?)
   *   - per-provider result: { ok, durationMs, output? OR error? }
   * The configured chain's result comes last so the operator can see
   * what the menu pipeline would actually persist.
   */
  async diagnose(text: string, toCode: string) {
    const sample = text?.trim() || 'Welcome to VEZEOR';
    const target = toCode?.trim() || 'te';

    const tryOne = async (
      name: string,
      fn: () => Promise<string>,
    ) => {
      const start = Date.now();
      try {
        const output = await fn();
        return {
          provider: name,
          ok: true,
          durationMs: Date.now() - start,
          output,
          // Flag: if the output is stub-tagged that's a soft failure;
          // the operator usually doesn't want this in production.
          stubTagged: isStubTaggedValue(output),
        };
      } catch (e: any) {
        return {
          provider: name,
          ok: false,
          durationMs: Date.now() - start,
          error: String(e?.message ?? e).slice(0, 300),
        };
      }
    };

    const [bhashini, lingva, chain] = await Promise.all([
      tryOne('bhashini', () => this.bhashini.translate(sample, SOURCE_LANGUAGE, target)),
      tryOne('lingva', () => this.lingva.translate(sample, SOURCE_LANGUAGE, target)),
      tryOne('chain', () => this.provider.translate(sample, SOURCE_LANGUAGE, target)),
    ]);

    return {
      sample,
      target,
      env: {
        TRANSLATION_PROVIDER_NAME: process.env.TRANSLATION_PROVIDER_NAME || '(unset — auto)',
        bhashiniCredsSet: !!(process.env.BHASHINI_USER_ID && process.env.BHASHINI_API_KEY),
        LINGVA_URL: process.env.LINGVA_URL || '(unset — default hosts)',
        LINGVA_TIMEOUT_MS: process.env.LINGVA_TIMEOUT_MS || '(default 4000)',
      },
      bhashini,
      lingva,
      // The chain is what upsertAll actually uses when writing
      // translations. If `chain.ok` is true but `chain.output ===
      // sample` then both providers failed and we fell back to source.
      chain: {
        ...chain,
        fellBackToSource: chain.ok && chain.output === sample && target !== SOURCE_LANGUAGE,
      },
    };
  }

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

    // D2 fast path: when a Bull queue is wired, fan-out provider
    // calls happen on a worker — staff menu saves don't block on
    // Bhashini/Lingva latency. The synchronous Promise.all below
    // becomes the fallback used only when the queue isn't available
    // (e.g. when Redis is down during boot — the Bull client throws
    // on add() in that case).
    if (this.translationsQueue) {
      await this.enqueueFieldTranslations(entityType, entityId, cleanFields);
      return;
    }

    const languages = await this.enabledLanguages();

    // Find any existing manual overrides for this (entity, field, lang)
    // grid up-front so the auto-backfill never silently clobbers a
    // human-edited translation. The schema's `source` column is the
    // mechanism; this is the read that honours it.
    const manualRows = await this.prisma.translation.findMany({
      where: {
        entityType,
        entityId,
        fieldName: { in: Object.keys(cleanFields) },
        languageCode: { in: languages },
        source: 'manual',
      },
      select: { fieldName: true, languageCode: true },
    });
    const manualKeys = new Set(manualRows.map((r) => `${r.fieldName}:${r.languageCode}`));

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
    // Skips cells the outlet admin has manually overridden.
    const jobs: Array<Promise<typeof rows[number] | null>> = [];
    for (const [fieldName, sourceText] of Object.entries(cleanFields)) {
      for (const lang of languages) {
        if (manualKeys.has(`${fieldName}:${lang}`)) continue;
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
    for (const r of await Promise.all(jobs)) {
      if (r) rows.push(r);
    }

    if (rows.length === 0) return;

    // Upsert in a single transaction — bulk createMany doesn't support upsert,
    // so we use the per-row upsert which is fine at this volume. The
    // update-side keeps `source: 'auto'` because we filtered manual rows
    // out above; this branch only ever touches auto rows.
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

    // Phase 3 dual-write: mirror the same key/value pairs into the
    // per-row JSON column on the entity. Read path prefers the JSON
    // cell, so this is what makes the new menu cache key (no `:lang:`
    // segment) viable. Keeping the legacy paynpik_translations row in
    // sync gives us a one-deploy rollback if the JSON path misbehaves.
    await this.dualWriteJsonCells(rows);
  }

  // Maps an `entityType` to its physical table and the set of fields
  // that own a matching `<field>_i18n` JSON column. Hard-coded rather
  // than reflective because (a) the set is tiny, (b) the migration
  // that created the columns enumerated them explicitly, and (c)
  // composing column names from untrusted data would invite SQL
  // injection through the dual-write path.
  private static readonly DUAL_WRITE_TARGETS: Record<
    string,
    { table: string; fields: Set<string> }
  > = {
    Business:      { table: 'paynpik_businesses',      fields: new Set(['name', 'description', 'address', 'addressLine1', 'addressLine2']) },
    Outlet:        { table: 'paynpik_outlets',         fields: new Set(['name', 'description', 'address', 'addressLine1', 'addressLine2']) },
    Category:      { table: 'paynpik_categories',      fields: new Set(['name']) },
    Subcategory:   { table: 'paynpik_subcategories',   fields: new Set(['name']) },
    Item:          { table: 'paynpik_items',           fields: new Set(['name', 'description', 'shortDescription']) },
    Variant:       { table: 'paynpik_variants',        fields: new Set(['name', 'shortDescription']) },
    Topping:       { table: 'paynpik_toppings',        fields: new Set(['name']) },
    ToppingOption: { table: 'paynpik_topping_options', fields: new Set(['name']) },
    CustomerTag:   { table: 'paynpik_customer_tags',   fields: new Set(['name']) },
    Dispute:       { table: 'paynpik_disputes',        fields: new Set(['description']) },
  };

  /**
   * For every (entityType, entityId, fieldName) tuple in the input,
   * MERGE the (lang → value) map into the entity's `<field>_i18n` JSON
   * column. JSON_MERGE_PATCH preserves existing keys not present in
   * the patch — partial backfills don't wipe out previously-set
   * languages. The source language (English) is skipped because the
   * canonical source stays in the plain column.
   */
  private async dualWriteJsonCells(
    rows: Array<{ entityType: string; entityId: string; fieldName: string; languageCode: string; value: string }>,
  ): Promise<void> {
    type Group = {
      entityType: string;
      entityId: string;
      fieldName: string;
      values: Record<string, string>;
    };
    const grouped = new Map<string, Group>();
    for (const r of rows) {
      if (r.languageCode === SOURCE_LANGUAGE) continue;
      const key = `${r.entityType} ${r.entityId} ${r.fieldName}`;
      let g = grouped.get(key);
      if (!g) {
        g = { entityType: r.entityType, entityId: r.entityId, fieldName: r.fieldName, values: {} };
        grouped.set(key, g);
      }
      g.values[r.languageCode] = r.value;
    }
    if (grouped.size === 0) return;

    const updates: Array<Promise<unknown>> = [];
    for (const g of grouped.values()) {
      const target = TranslationsService.DUAL_WRITE_TARGETS[g.entityType];
      if (!target || !target.fields.has(g.fieldName)) continue;
      const column = `${g.fieldName}_i18n`;
      updates.push(
        this.prisma.$executeRawUnsafe(
          // Table + column are inlined from the allowlist above —
          // never from user input — so the unsafe interpolation here
          // can't be reached with attacker-controlled identifiers.
          // entityId and the JSON payload flow as parameters.
          `UPDATE \`${target.table}\` ` +
            `SET \`${column}\` = JSON_MERGE_PATCH(COALESCE(\`${column}\`, JSON_OBJECT()), CAST(? AS JSON)) ` +
            `WHERE id = ?`,
          JSON.stringify(g.values),
          g.entityId,
        ),
      );
    }
    if (updates.length > 0) await Promise.all(updates);
  }

  // ─── Admin: list + manually correct translations ─────────────
  //
  // The outlet-admin Languages page reads via listOutletStrings to
  // get one row per (entity, field) with the source text and the
  // current translation, then calls upsertManualOverride to save a
  // correction. Manual overrides flip the legacy row's `source` to
  // 'manual' so the backfill in upsertAll() skips them on the next
  // pass (see the manualKeys check above).

  /**
   * Where-clause builder that filters a Prisma model to rows owned
   * by `outletId`. Hard-coded — same allowlist shape as
   * DUAL_WRITE_TARGETS — so an attacker can't ask the admin
   * endpoint for an arbitrary entityType.
   */
  private static readonly ADMIN_LIST: Record<
    string,
    { model: string; fields: string[]; whereForOutlet: (outletId: string) => any }
  > = {
    Outlet:        { model: 'outlet',        fields: ['name', 'description', 'address', 'addressLine1', 'addressLine2'], whereForOutlet: (o) => ({ id: o }) },
    Category:      { model: 'category',      fields: ['name'],                                                            whereForOutlet: (o) => ({ outletId: o }) },
    Subcategory:   { model: 'subcategory',   fields: ['name'],                                                            whereForOutlet: (o) => ({ category: { outletId: o } }) },
    Item:          { model: 'item',          fields: ['name', 'description', 'shortDescription'],                         whereForOutlet: (o) => ({ subcategory: { category: { outletId: o } } }) },
    Variant:       { model: 'variant',       fields: ['name', 'shortDescription'],                                        whereForOutlet: (o) => ({ item: { subcategory: { category: { outletId: o } } } }) },
    Topping:       { model: 'topping',       fields: ['name'],                                                            whereForOutlet: (o) => ({ outletId: o }) },
    ToppingOption: { model: 'toppingOption', fields: ['name'],                                                            whereForOutlet: (o) => ({ topping: { outletId: o } }) },
    CustomerTag:   { model: 'customerTag',   fields: ['name'],                                                            whereForOutlet: (o) => ({ outletId: o }) },
  };

  /**
   * Returns one row per (entity, fieldName) for the requested
   * entityType + language. Each row carries the English source, the
   * current translation (preferring the JSON cell, falling back to
   * the legacy table), and the row's `source` flag (auto / manual /
   * missing). Used by the outlet-admin Languages page.
   */
  async listOutletStrings(
    outletId: string,
    opts: { lang: string; entityType: string; search?: string; page?: number; limit?: number },
  ) {
    const cfg = TranslationsService.ADMIN_LIST[opts.entityType];
    if (!cfg) {
      return { rows: [], total: 0, page: 1, limit: 0, entityTypes: Object.keys(TranslationsService.ADMIN_LIST) };
    }
    const limit = Math.min(Math.max(Number(opts.limit) || 50, 1), 200);
    const page  = Math.max(Number(opts.page) || 1, 1);
    const skip  = (page - 1) * limit;

    const where: any = cfg.whereForOutlet(outletId);
    if (opts.search?.trim()) {
      where.OR = cfg.fields.map((f) => ({ [f]: { contains: opts.search } }));
    }

    const select: Record<string, true> = { id: true };
    for (const f of cfg.fields) {
      select[f] = true;
      select[`${f}_i18n`] = true;
    }

    const [entities, total] = await Promise.all([
      (this.prisma as any)[cfg.model].findMany({
        where, select, take: limit, skip, orderBy: { id: 'asc' },
      }),
      (this.prisma as any)[cfg.model].count({ where }),
    ]);

    // Legacy table lookup batches by entityId — fills in the `source`
    // flag and gives us a fallback when the JSON cell hasn't been
    // populated yet (entities created before the Phase 3 migration
    // but after the last backfill).
    const ids = entities.map((e: any) => e.id);
    const legacy = ids.length
      ? await this.prisma.translation.findMany({
          where: { entityType: opts.entityType, entityId: { in: ids }, languageCode: opts.lang },
          select: { entityId: true, fieldName: true, source: true, value: true },
        })
      : [];
    const legacyByKey = new Map<string, { source: string; value: string }>();
    for (const r of legacy) legacyByKey.set(`${r.entityId}:${r.fieldName}`, r);

    const rows: any[] = [];
    for (const e of entities as any[]) {
      for (const fieldName of cfg.fields) {
        const sourceText: string | null = e[fieldName] ?? null;
        if (!sourceText || !sourceText.trim()) continue;
        const i18nCell = e[`${fieldName}_i18n`] as Record<string, string> | null;
        const jsonValue = i18nCell?.[opts.lang];
        const lg = legacyByKey.get(`${e.id}:${fieldName}`);
        const translatedText =
          (typeof jsonValue === 'string' && jsonValue) ? jsonValue : (lg?.value ?? '');
        const source: 'manual' | 'auto' | 'missing' =
          (lg?.source === 'manual') ? 'manual'
          : translatedText ? 'auto'
          : 'missing';
        rows.push({
          entityType: opts.entityType,
          entityId: e.id,
          fieldName,
          sourceText,
          translatedText,
          source,
        });
      }
    }
    return {
      rows,
      total,
      page,
      limit,
      entityTypes: Object.keys(TranslationsService.ADMIN_LIST),
    };
  }

  /**
   * Save a human-curated correction. Writes to BOTH the legacy
   * translations table (with `source: 'manual'`, so future auto
   * backfills skip it) AND the JSON cell on the entity (which the
   * customer menu reads). Returns the persisted row.
   *
   * Throws when the entityType/fieldName isn't on the admin allowlist
   * or when the entityId doesn't belong to the caller's outlet.
   */
  async upsertManualOverride(
    outletId: string,
    params: { entityType: string; entityId: string; fieldName: string; languageCode: string; value: string },
  ): Promise<{ entityType: string; entityId: string; fieldName: string; languageCode: string; value: string; source: 'manual' }> {
    const cfg = TranslationsService.ADMIN_LIST[params.entityType];
    if (!cfg) throw new Error(`Unknown entityType: ${params.entityType}`);
    if (!cfg.fields.includes(params.fieldName)) throw new Error(`Field ${params.fieldName} is not translatable on ${params.entityType}`);
    if (!params.languageCode || params.languageCode === SOURCE_LANGUAGE) {
      throw new Error('languageCode must be set and non-source');
    }

    // Tenant check: confirm the entity belongs to this outlet by
    // re-running the whereForOutlet filter as an existence query.
    const exists = await (this.prisma as any)[cfg.model].findFirst({
      where: { AND: [cfg.whereForOutlet(outletId), { id: params.entityId }] },
      select: { id: true },
    });
    if (!exists) throw new Error('Entity not found in this outlet');

    const value = (params.value ?? '').trim();
    const dualTarget = TranslationsService.DUAL_WRITE_TARGETS[params.entityType];

    // 1) Legacy row — flips source='manual' so upsertAll skips it.
    await this.prisma.translation.upsert({
      where: {
        entityType_entityId_fieldName_languageCode: {
          entityType: params.entityType,
          entityId: params.entityId,
          fieldName: params.fieldName,
          languageCode: params.languageCode,
        },
      },
      update: { value, source: 'manual' },
      create: {
        entityType: params.entityType,
        entityId: params.entityId,
        fieldName: params.fieldName,
        languageCode: params.languageCode,
        value,
        source: 'manual',
      },
    });

    // 2) Per-row JSON cell — merge in the new (lang → value) so
    // existing keys for other languages stay intact.
    if (dualTarget && dualTarget.fields.has(params.fieldName)) {
      const column = `${params.fieldName}_i18n`;
      await this.prisma.$executeRawUnsafe(
        `UPDATE \`${dualTarget.table}\` ` +
          `SET \`${column}\` = JSON_MERGE_PATCH(COALESCE(\`${column}\`, JSON_OBJECT()), CAST(? AS JSON)) ` +
          `WHERE id = ?`,
        JSON.stringify({ [params.languageCode]: value }),
        params.entityId,
      );
    }

    return { ...params, value, source: 'manual' };
  }

  /**
   * Queue translate-field jobs for every (field × non-source language)
   * tuple. Used by upsertAll's fast path (D2) and by lazy-fill on
   * menu read (D4). Dedup by jobId — burst writes (drag-reorder,
   * batch import) coalesce into one provider call per cell.
   */
  async enqueueFieldTranslations(
    entityType: string,
    entityId: string,
    fields: Record<string, string>,
  ): Promise<void> {
    if (!this.translationsQueue) return;
    const languages = await this.enabledLanguages();
    const targets = languages.filter((l) => l !== SOURCE_LANGUAGE);
    if (targets.length === 0) return;
    // Skip cells the outlet admin has manually curated — race-safe
    // re-check happens inside the job, but filtering here saves a
    // queue trip for the common case.
    const manualRows = await this.prisma.translation.findMany({
      where: {
        entityType,
        entityId,
        fieldName: { in: Object.keys(fields) },
        languageCode: { in: targets },
        source: 'manual',
      },
      select: { fieldName: true, languageCode: true },
    });
    const manualKeys = new Set(manualRows.map((r) => `${r.fieldName}:${r.languageCode}`));

    const jobs: Array<Promise<unknown>> = [];
    for (const [fieldName, sourceText] of Object.entries(fields)) {
      if (!sourceText?.trim()) continue;
      for (const lang of targets) {
        if (manualKeys.has(`${fieldName}:${lang}`)) continue;
        // Stable jobId — burst writes hitting the same cell coalesce.
        // removeOnComplete keeps Redis memory bounded.
        jobs.push(
          this.translationsQueue.add(
            TRANSLATE_FIELD_JOB,
            { entityType, entityId, fieldName, sourceText, languageCode: lang },
            {
              jobId: `${entityType}:${entityId}:${fieldName}:${lang}`,
              attempts: 3,
              backoff: { type: 'exponential', delay: 5_000 },
              removeOnComplete: 50,
              removeOnFail: 100,
            },
          ),
        );
      }
    }
    if (jobs.length > 0) await Promise.all(jobs);
  }

  /**
   * Persists a single auto-translated value to both the legacy
   * paynpik_translations row AND the per-row JSON cell. Called by
   * TranslationsProcessor after the provider returns; also reused
   * by future lazy-fill writers.
   *
   * Honours the source='manual' flag — never overwrites a manual
   * row. The processor double-checks this too, but a cheap
   * defensive guard keeps the invariant local to the writer.
   */
  async writeAutoTranslation(params: {
    entityType: string;
    entityId: string;
    fieldName: string;
    languageCode: string;
    value: string;
  }): Promise<void> {
    const { entityType, entityId, fieldName, languageCode, value } = params;

    // Pre-Phase-3.5 this path wrote to BOTH the legacy
    // paynpik_translations row AND the JSON cell. After the cutover
    // it only writes the JSON cell — the JSON cell is the source of
    // truth for customer-facing rendering.
    //
    // The legacy table still gets queried here as a read-only audit
    // log so a manual override the admin set never gets clobbered
    // by an auto-translation that lands later (race window between
    // a job enqueueing and the admin saving a correction).
    const existing = await this.prisma.translation.findUnique({
      where: {
        entityType_entityId_fieldName_languageCode: { entityType, entityId, fieldName, languageCode },
      },
      select: { source: true },
    });
    if (existing?.source === 'manual') return;

    if (languageCode === SOURCE_LANGUAGE) return;
    const target = TranslationsService.DUAL_WRITE_TARGETS[entityType];
    if (!target || !target.fields.has(fieldName)) return;
    const column = `${fieldName}_i18n`;
    await this.prisma.$executeRawUnsafe(
      `UPDATE \`${target.table}\` ` +
        `SET \`${column}\` = JSON_MERGE_PATCH(COALESCE(\`${column}\`, JSON_OBJECT()), CAST(? AS JSON)) ` +
        `WHERE id = ?`,
      JSON.stringify({ [languageCode]: value }),
      entityId,
    );
  }

  /**
   * Lazy / on-demand fill (D4). Walks a batch of already-loaded
   * entity rows, finds cells where `<field>_i18n[lang]` is missing,
   * and enqueues translate-field jobs. Fire-and-forget — the caller
   * (typically the menu hydrate path) doesn't await. Bull's jobId
   * dedup means the same tuple won't translate twice even if
   * concurrent renders enqueue it.
   *
   * Capped at LAZY_FILL_MAX_PER_RENDER tuples so a cold-cache render
   * of a 400-item menu doesn't fan out into 400 × N-langs jobs in
   * one burst. The rest get picked up on the next render.
   */
  lazyFillMissing(
    entityType: string,
    rows: any[] | null | undefined,
    fields: string[],
    languageCode: string,
  ): void {
    if (!this.translationsQueue) return;
    if (!rows?.length || !languageCode || languageCode === SOURCE_LANGUAGE) return;
    const target = TranslationsService.DUAL_WRITE_TARGETS[entityType];
    if (!target) return;

    let added = 0;
    const MAX = 100;
    for (const row of rows) {
      if (added >= MAX) break;
      for (const f of fields) {
        if (added >= MAX) break;
        if (!target.fields.has(f)) continue;
        const sourceText = row?.[f];
        if (typeof sourceText !== 'string' || !sourceText.trim()) continue;
        const cell = row?.[`${f}_i18n`];
        if (cell && typeof cell === 'object' && typeof cell[languageCode] === 'string') continue;
        // Missing → enqueue. Errors swallowed: lazy fill must never
        // surface a failure to the read path.
        this.translationsQueue.add(
          TRANSLATE_FIELD_JOB,
          { entityType, entityId: row.id, fieldName: f, sourceText, languageCode },
          {
            jobId: `${entityType}:${row.id}:${f}:${languageCode}`,
            attempts: 3,
            backoff: { type: 'exponential', delay: 5_000 },
            removeOnComplete: 50,
            removeOnFail: 100,
          },
        ).catch(() => { /* swallow — lazy fill is best-effort */ });
        added++;
      }
    }
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
  /**
   * In-memory variant of hydrate(). Reads the per-row `<field>_i18n`
   * JSON column (populated by the Phase 3 migration + dual-write in
   * upsertAll) and mutates the row's source field with the translated
   * value. Zero DB queries — replaces the old 5-findMany roundtrip
   * that the legacy hydrate() does. Use for read paths that already
   * pull entity rows with their i18n cells (the menu tree, the orders
   * detail join, anything using include or scalar select).
   *
   * Falls through silently when no entry exists for `languageCode` —
   * caller gets the source value untouched.
   */
  pickI18n<T extends Record<string, any>>(
    row: T | null | undefined,
    fields: Array<keyof T & string>,
    languageCode: string | null | undefined,
  ): T | null | undefined {
    if (!row || !languageCode || languageCode === SOURCE_LANGUAGE) return row;
    for (const f of fields) {
      const cell = (row as any)[`${f}_i18n`];
      if (cell && typeof cell === 'object') {
        const v = cell[languageCode];
        if (typeof v === 'string' && v.length > 0) {
          (row as any)[f] = v;
        }
      }
    }
    return row;
  }

  /** Batch variant of pickI18n — applies to every row in the list. */
  pickI18nBatch<T extends Record<string, any>>(
    rows: T[] | null | undefined,
    fields: Array<keyof T & string>,
    languageCode: string | null | undefined,
  ): T[] | null | undefined {
    if (!rows?.length || !languageCode || languageCode === SOURCE_LANGUAGE) return rows;
    for (const row of rows) this.pickI18n(row, fields, languageCode);
    return rows;
  }

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
