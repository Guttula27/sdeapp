import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EncryptionService } from './encryption.service';

/**
 * Single place to look up a User by phone. All callsites that used to
 * do `prisma.user.findUnique({ where: { phone } })` go through here so
 * the dual-read pattern (HMAC index first, plaintext fallback) is
 * applied once. Once the plaintext `phone` column is dropped in the
 * cleanup migration, only the hash branch stays.
 */
@Injectable()
export class UserLookupService {
  constructor(
    private prisma: PrismaService,
    private encryption: EncryptionService,
  ) {}

  async findByPhone(phone: string, args?: { include?: any; select?: any }): Promise<any | null> {
    if (!phone) return null;
    const normalized = this.encryption.normalizePhone(phone);
    const hash = this.encryption.phoneHmac(normalized);
    const byHash = await this.prisma.user.findUnique({
      where: { phoneHash: hash },
      ...((args as any) ?? {}),
    });
    if (byHash) return byHash;
    return this.prisma.user.findUnique({
      where: { phone: normalized },
      ...((args as any) ?? {}),
    });
  }

  // Batch variant used by promotions / customer-tag flows that want
  // to resolve many phones at once. Returns a Map keyed by normalized
  // phone for easy O(1) lookup at callsites.
  async findByPhones(phones: string[]): Promise<Map<string, any>> {
    const cleaned = phones
      .map((p) => this.encryption.normalizePhone(p))
      .filter((p) => p.length > 0);
    if (cleaned.length === 0) return new Map();
    const hashes = cleaned.map((p) => this.encryption.phoneHmac(p));
    const [byHash, byPlain] = await Promise.all([
      this.prisma.user.findMany({ where: { phoneHash: { in: hashes } } }),
      this.prisma.user.findMany({ where: { phone: { in: cleaned } } }),
    ]);
    const out = new Map<string, any>();
    for (const u of byPlain) out.set(u.phone, u);   // fallback layer
    for (const u of byHash) out.set(u.phone, u);    // hash-matched wins
    return out;
  }
}
