import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../config/prisma/prisma.service';

const SINGLETON_ID = 'singleton';

export type PlatformFeeConfig = {
  percent: number;
  minimum: number;
};

@Injectable()
export class PlatformSettingsService {
  constructor(private prisma: PrismaService) {}

  // The settings table holds exactly one row. Migration seeds it, but
  // the upsert here means a fresh DB (e.g. a test reset) is still safe.
  async get() {
    const row = await this.prisma.platformSettings.upsert({
      where: { id: SINGLETON_ID },
      create: { id: SINGLETON_ID },
      update: {},
    });
    return row;
  }

  async update(data: { platformFeePercent?: number; platformFeeMinimum?: number }) {
    return this.prisma.platformSettings.upsert({
      where: { id: SINGLETON_ID },
      create: { id: SINGLETON_ID, ...data },
      update: data,
    });
  }

  // Resolve the effective platform fee for a given business — business
  // overrides win when both fields are set, but null/undefined falls
  // back to the platform default field-by-field so admins can override
  // just one of the two if they want.
  async feeForBusiness(businessId: string | null | undefined): Promise<PlatformFeeConfig> {
    const settings = await this.get();
    const fallback = {
      percent: Number(settings.platformFeePercent),
      minimum: Number(settings.platformFeeMinimum),
    };
    if (!businessId) return fallback;
    const biz = await this.prisma.business.findUnique({
      where: { id: businessId },
      select: { platformFeePercent: true, platformFeeMinimum: true },
    });
    if (!biz) return fallback;
    return {
      percent: biz.platformFeePercent != null
        ? Number(biz.platformFeePercent)
        : fallback.percent,
      minimum: biz.platformFeeMinimum != null
        ? Number(biz.platformFeeMinimum)
        : fallback.minimum,
    };
  }
}

// Pure helper — extracted so payments can call it without going back to
// the DB once the config has been resolved. Returns the integer-paise
// values to keep downstream Razorpay math precise.
export function computePlatformFee(amountInRupees: number, cfg: PlatformFeeConfig) {
  if (amountInRupees <= 0) return { fee: 0, transferable: 0 };
  const pct = Math.max(0, cfg.percent) / 100;
  const min = Math.max(0, cfg.minimum);
  const raw = amountInRupees * pct;
  const fee = Math.min(amountInRupees, Math.max(raw, min));
  return { fee, transferable: amountInRupees - fee };
}
