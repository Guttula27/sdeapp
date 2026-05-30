import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../config/prisma/prisma.service';

type RewardConfigDto = {
  earnRate?: number;
  redeemRate?: number;
  minRedemptionPoints?: number;
  maxRedemptionPercent?: number;
  expiryDays?: number | null;
  isActive?: boolean;
};

@Injectable()
export class RewardsService {
  constructor(private prisma: PrismaService) {}

  // ─── Platform-wide config (single row) ──────────────────────────
  async getConfig() {
    let cfg = await this.prisma.rewardConfig.findUnique({ where: { id: 'default' } });
    if (!cfg) {
      cfg = await this.prisma.rewardConfig.create({ data: { id: 'default' } });
    }
    return cfg;
  }

  async updateConfig(dto: RewardConfigDto) {
    await this.getConfig();
    return this.prisma.rewardConfig.update({
      where: { id: 'default' },
      data: {
        ...(dto.earnRate !== undefined ? { earnRate: dto.earnRate } : {}),
        ...(dto.redeemRate !== undefined ? { redeemRate: dto.redeemRate } : {}),
        ...(dto.minRedemptionPoints !== undefined ? { minRedemptionPoints: dto.minRedemptionPoints } : {}),
        ...(dto.maxRedemptionPercent !== undefined ? { maxRedemptionPercent: dto.maxRedemptionPercent } : {}),
        ...(dto.expiryDays !== undefined ? { expiryDays: dto.expiryDays } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });
  }

  // ─── Customer account ──────────────────────────────────────────
  async ensureAccount(userId: string) {
    return this.prisma.customerRewardAccount.upsert({
      where: { userId },
      create: { userId },
      update: {},
    });
  }

  async getAccount(userId: string) {
    const acc = await this.ensureAccount(userId);
    const transactions = await this.prisma.rewardTransaction.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return { ...acc, transactions };
  }

  // ─── Earn (called on order PAID) ───────────────────────────────
  async earnForOrder(opts: {
    userId: string;
    orderId?: string | null;
    clusterOrderId?: string | null;
    outletId?: string | null;
    subtotal: number;
  }) {
    const cfg = await this.getConfig();
    if (!cfg.isActive) return null;

    const earnRate = Number(cfg.earnRate);
    const pointsRaw = opts.subtotal * earnRate;
    const points = Math.floor(pointsRaw);
    if (points <= 0) return null;

    const expiresAt = cfg.expiryDays
      ? new Date(Date.now() + cfg.expiryDays * 24 * 60 * 60 * 1000)
      : null;

    return this.prisma.$transaction(async (tx) => {
      const account = await tx.customerRewardAccount.upsert({
        where: { userId: opts.userId },
        create: { userId: opts.userId, balance: points, lifetimeEarned: points },
        update: {
          balance: { increment: points },
          lifetimeEarned: { increment: points },
        },
      });
      return tx.rewardTransaction.create({
        data: {
          accountId: account.id,
          userId: opts.userId,
          type: 'EARN',
          points,
          balanceAfter: account.balance,
          orderId: opts.orderId ?? null,
          clusterOrderId: opts.clusterOrderId ?? null,
          outletId: opts.outletId ?? null,
          expiresAt,
        },
      });
    });
  }

  // ─── Quote redemption (preview without persisting) ─────────────
  async quoteRedeem(userId: string, billSubtotal: number, pointsRequested: number, outletId?: string) {
    const cfg = await this.getConfig();
    if (!cfg.isActive) throw new BadRequestException('Rewards disabled');

    if (outletId) {
      const outlet = await this.prisma.outlet.findUnique({
        where: { id: outletId },
        select: { acceptRewardRedemption: true },
      });
      if (outlet && !outlet.acceptRewardRedemption) {
        throw new BadRequestException('This outlet does not accept reward redemption');
      }
    }

    const account = await this.ensureAccount(userId);
    if (pointsRequested < cfg.minRedemptionPoints) {
      throw new BadRequestException(`Minimum redemption is ${cfg.minRedemptionPoints} points`);
    }
    if (pointsRequested > account.balance) {
      throw new BadRequestException('Insufficient points');
    }

    const cashEquivalent = pointsRequested * Number(cfg.redeemRate);
    const maxByPercent = (billSubtotal * Number(cfg.maxRedemptionPercent)) / 100;
    const applied = Math.min(cashEquivalent, maxByPercent, billSubtotal);
    return {
      pointsRequested,
      cashEquivalent: Number(cashEquivalent.toFixed(2)),
      applied: Number(applied.toFixed(2)),
      remainingPoints: account.balance - pointsRequested,
    };
  }

  // ─── Burn (called atomically during checkout) ──────────────────
  async redeem(opts: {
    userId: string;
    points: number;
    amountValue: number;
    orderId?: string | null;
    clusterOrderId?: string | null;
    outletId?: string | null;
  }) {
    const account = await this.ensureAccount(opts.userId);
    if (opts.points > account.balance) {
      throw new BadRequestException('Insufficient points');
    }
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.customerRewardAccount.update({
        where: { id: account.id },
        data: {
          balance: { decrement: opts.points },
          lifetimeRedeemed: { increment: opts.points },
        },
      });
      return tx.rewardTransaction.create({
        data: {
          accountId: account.id,
          userId: opts.userId,
          type: 'REDEEM',
          points: -opts.points,
          amountValue: opts.amountValue,
          balanceAfter: updated.balance,
          orderId: opts.orderId ?? null,
          clusterOrderId: opts.clusterOrderId ?? null,
          outletId: opts.outletId ?? null,
        },
      });
    });
  }

  // ─── Manual adjust (admin) ─────────────────────────────────────
  async adjust(userId: string, points: number, notes?: string) {
    if (!points || points === 0) throw new BadRequestException('Points required');
    const account = await this.ensureAccount(userId);
    if (account.balance + points < 0) throw new BadRequestException('Cannot push balance below 0');
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.customerRewardAccount.update({
        where: { id: account.id },
        data: {
          balance: { increment: points },
          lifetimeEarned: points > 0 ? { increment: points } : undefined,
          lifetimeRedeemed: points < 0 ? { increment: -points } : undefined,
        },
      });
      return tx.rewardTransaction.create({
        data: {
          accountId: account.id,
          userId,
          type: 'ADJUST',
          points,
          balanceAfter: updated.balance,
          notes: notes ?? null,
        },
      });
    });
  }
}
