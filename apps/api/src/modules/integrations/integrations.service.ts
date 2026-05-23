import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { IsBoolean, IsEnum, IsObject, IsOptional, IsString } from 'class-validator';
import { IntegrationChannel } from '@prisma/client';
import { PrismaService } from '../../config/prisma/prisma.service';

export class UpsertIntegrationDto {
  @IsEnum(IntegrationChannel) channel!: IntegrationChannel;
  @IsString() providerKey!: string;
  @IsString() providerName!: string;
  @IsOptional() @IsBoolean() isDefault?: boolean;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsObject() config?: Record<string, any>;
}

@Injectable()
export class IntegrationsService {
  constructor(private prisma: PrismaService) {}

  list(channel?: IntegrationChannel) {
    return this.prisma.integrationConfig.findMany({
      where: channel ? { channel } : undefined,
      orderBy: [{ channel: 'asc' }, { isDefault: 'desc' }, { providerName: 'asc' }],
    });
  }

  async upsert(dto: UpsertIntegrationDto) {
    const { channel, providerKey, providerName, isDefault, isActive, config } = dto;

    // If this provider is being marked default, demote the previous default
    // for the same channel in a single transaction so we never have two.
    return this.prisma.$transaction(async (tx) => {
      if (isDefault) {
        await tx.integrationConfig.updateMany({
          where: { channel, isDefault: true, NOT: { providerKey } },
          data: { isDefault: false },
        });
      }
      return tx.integrationConfig.upsert({
        where: { channel_providerKey: { channel, providerKey } },
        create: {
          channel,
          providerKey,
          providerName,
          isDefault: !!isDefault,
          isActive: isActive ?? true,
          config: config ?? {},
        },
        update: {
          providerName,
          ...(isDefault !== undefined ? { isDefault } : {}),
          ...(isActive !== undefined ? { isActive } : {}),
          ...(config !== undefined ? { config } : {}),
        },
      });
    });
  }

  async remove(id: string) {
    const existing = await this.prisma.integrationConfig.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Integration not found');
    if (existing.isDefault) {
      throw new BadRequestException('Cannot delete the default provider. Mark another as default first.');
    }
    return this.prisma.integrationConfig.delete({ where: { id } });
  }

  async setDefault(id: string) {
    const existing = await this.prisma.integrationConfig.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Integration not found');
    return this.prisma.$transaction(async (tx) => {
      await tx.integrationConfig.updateMany({
        where: { channel: existing.channel, isDefault: true, NOT: { id } },
        data: { isDefault: false },
      });
      return tx.integrationConfig.update({ where: { id }, data: { isDefault: true } });
    });
  }

  /**
   * Public-facing view of the active payment gateway. Returns provider name
   * + per-mode surcharge percentages only — never raw credentials. The
   * customer app uses this to render the gateway picker with accurate fees.
   * Returns null when no gateway is configured (customer sees UPI-only).
   */
  async activePaymentGateway() {
    const provider = await this.prisma.integrationConfig.findFirst({
      where: { channel: 'PAYMENT_GATEWAY', isActive: true, isDefault: true },
      select: { providerKey: true, providerName: true, config: true },
    });
    if (!provider) return null;
    const cfg = (provider.config as any) || {};
    const charges = (cfg.charges as Record<string, number>) || {};
    return {
      providerKey: provider.providerKey,
      providerName: provider.providerName,
      // Per-payment-mode surcharge in percent. Missing modes are treated as 0
      // by callers — keep keys uppercase for symmetry with PaymentMode enum.
      charges: {
        UPI: Number(charges.UPI ?? 0),
        DEBIT_CARD: Number(charges.DEBIT_CARD ?? 0),
        CREDIT_CARD: Number(charges.CREDIT_CARD ?? 0),
        NET_BANKING: Number(charges.NET_BANKING ?? 0),
        WALLET: Number(charges.WALLET ?? 0),
      },
    };
  }
}
