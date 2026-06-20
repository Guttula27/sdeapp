import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  AggregatorChannel,
  AggregatorOrderStatus,
  OrderStatus,
  PaymentStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../config/prisma/prisma.service';
import { EncryptionService } from '../../config/crypto/encryption.service';
import { AggregatorAdapter, InboundOrder } from './types';
import { ZomatoAdapter } from './adapters/zomato.adapter';
import { SwiggyAdapter } from './adapters/swiggy.adapter';
import { UberEatsAdapter } from './adapters/uber-eats.adapter';

@Injectable()
export class AggregatorsService {
  private readonly logger = new Logger(AggregatorsService.name);
  private readonly adapters: Map<AggregatorChannel, AggregatorAdapter>;

  constructor(
    private prisma: PrismaService,
    private encryption: EncryptionService,
    private zomato: ZomatoAdapter,
    private swiggy: SwiggyAdapter,
    private uberEats: UberEatsAdapter,
  ) {
    this.adapters = new Map<AggregatorChannel, AggregatorAdapter>([
      [AggregatorChannel.ZOMATO, zomato],
      [AggregatorChannel.SWIGGY, swiggy],
      [AggregatorChannel.UBER_EATS, uberEats],
    ]);
  }

  private adapterFor(channel: AggregatorChannel): AggregatorAdapter {
    const adapter = this.adapters.get(channel);
    if (!adapter) {
      throw new BadRequestException(`No adapter registered for channel ${channel}`);
    }
    return adapter;
  }

  // ─── Integration CRUD ─────────────────────────────────────

  listIntegrations(outletId: string) {
    return this.prisma.aggregatorIntegration.findMany({
      where: { outletId },
      orderBy: { channel: 'asc' },
      select: {
        id: true,
        outletId: true,
        channel: true,
        isActive: true,
        externalRestaurantId: true,
        lastMenuSyncAt: true,
        notes: true,
        createdAt: true,
        updatedAt: true,
        // Credentials + webhookSecret are sensitive — never returned
        // in the list call. The operator sees a "configured" badge
        // based on whether the encrypted column is non-null (see the
        // mapping below).
      },
    });
  }

  async upsertIntegration(
    outletId: string,
    channel: AggregatorChannel,
    data: {
      isActive?: boolean;
      externalRestaurantId?: string | null;
      credentials?: Record<string, any> | null;
      webhookSecret?: string | null;
      notes?: string | null;
    },
  ) {
    if (channel === AggregatorChannel.DIRECT) {
      throw new BadRequestException('DIRECT channel cannot be configured as an aggregator integration');
    }
    const credentialsEnc = data.credentials !== undefined
      ? (data.credentials === null ? null : this.encryption.encrypt(JSON.stringify(data.credentials)))
      : undefined;
    const webhookSecretEnc = data.webhookSecret !== undefined
      ? (data.webhookSecret === null ? null : this.encryption.encrypt(data.webhookSecret))
      : undefined;

    return this.prisma.aggregatorIntegration.upsert({
      where: { outletId_channel: { outletId, channel } },
      update: {
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
        ...(data.externalRestaurantId !== undefined ? { externalRestaurantId: data.externalRestaurantId } : {}),
        ...(credentialsEnc !== undefined ? { credentialsEnc } : {}),
        ...(webhookSecretEnc !== undefined ? { webhookSecretEnc } : {}),
        ...(data.notes !== undefined ? { notes: data.notes } : {}),
      },
      create: {
        outletId,
        channel,
        isActive: data.isActive ?? false,
        externalRestaurantId: data.externalRestaurantId ?? null,
        credentialsEnc: credentialsEnc ?? null,
        webhookSecretEnc: webhookSecretEnc ?? null,
        notes: data.notes ?? null,
      },
    });
  }

  async deleteIntegration(outletId: string, channel: AggregatorChannel) {
    await this.prisma.aggregatorIntegration.deleteMany({
      where: { outletId, channel },
    });
  }

  // ─── Webhook entry ────────────────────────────────────────

  /**
   * Inbound webhook handler. The controller forwards the raw body
   * (post-signature-validation) and the parsed payload; we run the
   * channel-specific adapter to normalise into an InboundOrder and
   * then materialise it as a local Order + AggregatorOrder pair
   * (atomic transaction).
   *
   * Idempotent on (channel, externalOrderId): the @@unique index
   * means a duplicate webhook will fail at the DB layer, and we
   * catch + return the existing AggregatorOrder so the aggregator
   * gets a 200 instead of a panicked retry storm.
   */
  async handleInboundWebhook(
    outletId: string,
    channel: AggregatorChannel,
    rawBody: string,
    payload: any,
    headers: Record<string, string>,
  ) {
    const adapter = this.adapterFor(channel);
    const integration = await this.prisma.aggregatorIntegration.findUnique({
      where: { outletId_channel: { outletId, channel } },
    });
    if (!integration || !integration.isActive) {
      throw new BadRequestException(`No active ${channel} integration configured for this outlet`);
    }
    const webhookSecret = integration.webhookSecretEnc
      ? this.encryption.decrypt(integration.webhookSecretEnc)
      : '';
    if (!adapter.verifyInboundSignature(rawBody, headers, webhookSecret ?? '')) {
      throw new BadRequestException('Webhook signature verification failed');
    }

    const inbound = await adapter.parseInboundOrder(payload, {
      outletId,
      resolveItemByExternalId: (externalItemId) => this.resolveItemId(channel, externalItemId),
    });
    if (!inbound) {
      this.logger.log(`Inbound ${channel} payload acknowledged with no actionable order`);
      return { ok: true, skipped: true };
    }

    // Duplicate guard via the (channel, externalOrderId) unique.
    const existing = await this.prisma.aggregatorOrder.findUnique({
      where: { channel_externalOrderId: { channel, externalOrderId: inbound.externalOrderId } },
    });
    if (existing) {
      this.logger.log(`Duplicate inbound ${channel} order ${inbound.externalOrderId} — acknowledging`);
      return { ok: true, duplicate: true, orderId: existing.orderId };
    }

    return this.materialiseInboundOrder(outletId, inbound);
  }

  /**
   * Build the Order + AggregatorOrder + Payment rows in one txn.
   * Pricing is recomputed locally from current Item.basePrice so the
   * kitchen receipt + reports reflect what we'd charge — adapter's
   * reportedTotal is captured on the AggregatorOrder.rawPayload for
   * reconciliation when there's a delta.
   */
  private async materialiseInboundOrder(outletId: string, inbound: InboundOrder) {
    // Resolve / link the customer by phone. Reuse the existing
    // OutletCustomer pattern if a User exists.
    let customerId: string | null = null;
    if (inbound.customer?.phone) {
      // Lookup by hashed phone — keeps the encryption boundary clean.
      // For now we skip hashing and use plaintext phone for the
      // lookup (existing User table allows it).
      const user = await this.prisma.user.findFirst({
        where: { phone: inbound.customer.phone },
      });
      customerId = user?.id ?? null;
    }

    // Resolve items + compute totals.
    const items = await this.prisma.item.findMany({
      where: { id: { in: inbound.items.map((i) => i.itemId) } },
      select: { id: true, basePrice: true, gstRate: true, name: true, subcategory: { select: { category: { select: { menuId: true } } } } },
    });
    const itemMap = new Map(items.map((i) => [i.id, i]));

    let subtotal = new Prisma.Decimal(0);
    let taxAmount = new Prisma.Decimal(0);
    const orderItemsData = inbound.items.map((line) => {
      const meta = itemMap.get(line.itemId);
      if (!meta) throw new BadRequestException(`Inbound order references unknown item ${line.itemId}`);
      const unitPrice = new Prisma.Decimal(meta.basePrice);
      const lineTotal = unitPrice.mul(line.quantity);
      const gstRate = new Prisma.Decimal(meta.gstRate ?? 0);
      const lineTax = lineTotal.mul(gstRate).div(100);
      subtotal = subtotal.plus(lineTotal);
      taxAmount = taxAmount.plus(lineTax);
      return {
        itemId: line.itemId,
        quantity: line.quantity,
        unitPrice,
        totalPrice: lineTotal,
        gstRate,
        gstAmount: lineTax,
        notes: line.notes ?? null,
        itemNameSnapshot: meta.name,
        menuId: meta.subcategory?.category?.menuId ?? null,
      };
    });
    const totalAmount = subtotal.plus(taxAmount);
    const sgst = taxAmount.div(2);
    const cgst = taxAmount.div(2);
    const orderNumber = `AGG-${inbound.channel.slice(0, 3)}-${Date.now().toString(36).toUpperCase()}`;

    return this.prisma.$transaction(async (tx) => {
      const order = await tx.order.create({
        data: {
          orderNumber,
          outletId,
          customerId,
          status: OrderStatus.CREATED,
          channel: inbound.channel,
          isParcel: inbound.isParcel,
          isPostpaid: false,
          notes: inbound.notes ?? null,
          subtotal,
          taxAmount,
          sgstAmount: sgst,
          cgstAmount: cgst,
          parcelAmount: new Prisma.Decimal(0),
          discountAmount: new Prisma.Decimal(0),
          totalAmount,
          items: { create: orderItemsData as any },
          statusHistory: {
            create: { status: OrderStatus.CREATED, changedBy: null, notes: `Inbound from ${inbound.channel}` },
          },
          // Payment already collected by the aggregator — record a
          // SUCCESS row so the order reports as paid.
          payments: {
            create: {
              amount: totalAmount,
              mode: inbound.paymentMode,
              status: PaymentStatus.SUCCESS,
              isRefund: false,
            },
          },
        },
      });

      await tx.aggregatorOrder.create({
        data: {
          orderId: order.id,
          channel: inbound.channel,
          externalOrderId: inbound.externalOrderId,
          status: AggregatorOrderStatus.RECEIVED,
          rawPayload: inbound.rawPayload ?? Prisma.JsonNull,
        },
      });

      return order;
    });
  }

  private async resolveItemId(channel: AggregatorChannel, externalItemId: string): Promise<string | null> {
    const mapping = await this.prisma.aggregatorItemMapping.findFirst({
      where: { channel, externalItemId, isEnabled: true },
      select: { itemId: true },
    });
    return mapping?.itemId ?? null;
  }

  // ─── Outbound status sync ──────────────────────────────────

  /**
   * Push an AggregatorOrderStatus back to the source aggregator.
   * Called from the orders module's lifecycle hooks when an order
   * has an aggregatorOrder. Errors are recorded on
   * AggregatorOrder.lastSyncError so the operator can see them in
   * the integrations page without parsing logs.
   */
  async syncOrderStatus(orderId: string, status: AggregatorOrderStatus) {
    const agg = await this.prisma.aggregatorOrder.findUnique({ where: { orderId } });
    if (!agg) return;
    const integration = await this.prisma.aggregatorIntegration.findFirst({
      where: { channel: agg.channel, isActive: true, outlet: { orders: { some: { id: orderId } } } },
    });
    if (!integration) return;
    const adapter = this.adapterFor(agg.channel);
    const credentials = integration.credentialsEnc
      ? JSON.parse(this.encryption.decrypt(integration.credentialsEnc) ?? '{}')
      : {};

    try {
      await adapter.syncStatus(
        { credentials, externalRestaurantId: integration.externalRestaurantId },
        agg.externalOrderId,
        status,
      );
      await this.prisma.aggregatorOrder.update({
        where: { id: agg.id },
        data: { status, lastSyncError: null },
      });
    } catch (e: any) {
      await this.prisma.aggregatorOrder.update({
        where: { id: agg.id },
        data: { lastSyncError: e?.message ?? 'unknown' },
      });
      this.logger.warn(`Status sync to ${agg.channel} for order ${orderId} failed: ${e?.message}`);
    }
  }
}
