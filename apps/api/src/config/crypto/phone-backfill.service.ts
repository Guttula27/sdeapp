import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EncryptionService } from './encryption.service';

/**
 * One-shot boot job that populates phoneEnc + phoneHash for any user
 * row created before this migration landed. Runs in batches to avoid
 * locking the table on large datasets. Idempotent: re-running after a
 * full backfill is a no-op (no rows match the WHERE).
 *
 * Lookups during the gap between boot and "backfill complete" still
 * work because every callsite tries `phoneHash` first and falls back
 * to `phone` if no row matches — see auth.service / orders.service.
 */
@Injectable()
export class PhoneBackfillService implements OnApplicationBootstrap {
  private readonly logger = new Logger('PhoneBackfill');

  constructor(
    private prisma: PrismaService,
    private encryption: EncryptionService,
  ) {}

  async onApplicationBootstrap() {
    // Skipped explicitly when running tests / one-off scripts that
    // boot the app without wanting side effects.
    if (process.env.SKIP_PHONE_BACKFILL === 'true') return;

    try {
      await this.runBackfill();
    } catch (e: any) {
      // Don't crash boot on a backfill failure — the dual-read fallback
      // keeps logins working from the plaintext column. Operator gets
      // a loud log to investigate.
      this.logger.error(`phone backfill failed: ${e?.message ?? e}`);
    }
  }

  private async runBackfill() {
    const total = await this.prisma.user.count({ where: { phoneHash: null } });
    if (total === 0) return;
    this.logger.log(`Backfilling phoneHash/phoneEnc for ${total} user(s)…`);

    const BATCH = 500;
    let processed = 0;
    // Loop until the WHERE returns empty — each iteration consumes one
    // batch's worth of `phoneHash IS NULL` rows.
    while (true) {
      const batch = await this.prisma.user.findMany({
        where: { phoneHash: null },
        select: { id: true, phone: true },
        take: BATCH,
      });
      if (batch.length === 0) break;

      for (const row of batch) {
        if (!row.phone) continue;
        const fields = this.encryption.buildPhoneFields(row.phone);
        try {
          await this.prisma.user.update({
            where: { id: row.id },
            data: { phoneEnc: fields.phoneEnc, phoneHash: fields.phoneHash },
          });
        } catch (e: any) {
          // Most likely cause: two rows with the same normalized phone
          // (legacy data drift). Log and continue so one bad row doesn't
          // block the rest; operator can dedupe manually.
          this.logger.warn(`skip user ${row.id}: ${e?.message ?? e}`);
        }
      }
      processed += batch.length;
      this.logger.debug(`backfill progress: ${processed}/${total}`);
    }
    this.logger.log(`phone backfill complete (${processed} rows processed)`);
  }
}
