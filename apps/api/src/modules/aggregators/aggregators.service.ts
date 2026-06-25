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

  // ─── Item mappings ────────────────────────────────────────

  /**
   * Returns every item on this outlet's menu alongside its current
   * per-channel external-id mappings. Powers the bulk mappings table
   * in the admin — staff paste in the IDs from each provider's
   * dashboard against the rows they care about.
   *
   * Performance note: capped at the outlet's own items (excludes
   * business-template rows) and includes only the menu-tree fields
   * the UI needs. For a 500-item outlet this is one indexed join.
   */
  async listItemMappings(outletId: string) {
    const items = await this.prisma.item.findMany({
      where: { subcategory: { category: { outletId } } },
      select: {
        id: true,
        name: true,
        basePrice: true,
        isAvailable: true,
        subcategory: {
          select: {
            id: true,
            name: true,
            category: { select: { id: true, name: true, displayOrder: true } },
          },
        },
        aggregatorMappings: {
          select: {
            id: true,
            channel: true,
            externalItemId: true,
            externalPrice: true,
            isEnabled: true,
          },
        },
      },
      orderBy: [
        { subcategory: { category: { displayOrder: 'asc' } } },
        { subcategory: { displayOrder: 'asc' } },
        { displayOrder: 'asc' },
      ],
    });
    return items;
  }

  async upsertItemMapping(
    outletId: string,
    itemId: string,
    channel: AggregatorChannel,
    data: {
      externalItemId: string;
      externalPrice?: number | null;
      isEnabled?: boolean;
    },
  ) {
    if (channel === AggregatorChannel.DIRECT) {
      throw new BadRequestException('DIRECT channel cannot be mapped per-item');
    }
    // Guard: item must belong to this outlet — prevents a tenant
    // boundary leak via the URL parameter.
    const item = await this.prisma.item.findFirst({
      where: { id: itemId, subcategory: { category: { outletId } } },
      select: { id: true },
    });
    if (!item) throw new NotFoundException('Item not found on this outlet');

    if (!data.externalItemId?.trim()) {
      throw new BadRequestException('externalItemId is required');
    }

    return this.prisma.aggregatorItemMapping.upsert({
      where: { itemId_channel: { itemId, channel } },
      update: {
        externalItemId: data.externalItemId.trim(),
        ...(data.externalPrice !== undefined ? { externalPrice: data.externalPrice ?? null } : {}),
        ...(data.isEnabled !== undefined ? { isEnabled: data.isEnabled } : {}),
      },
      create: {
        itemId,
        channel,
        externalItemId: data.externalItemId.trim(),
        externalPrice: data.externalPrice ?? null,
        isEnabled: data.isEnabled ?? true,
      },
    });
  }

  async deleteItemMapping(outletId: string, itemId: string, channel: AggregatorChannel) {
    // Same tenant boundary check as upsert.
    const item = await this.prisma.item.findFirst({
      where: { id: itemId, subcategory: { category: { outletId } } },
      select: { id: true },
    });
    if (!item) throw new NotFoundException('Item not found on this outlet');
    await this.prisma.aggregatorItemMapping.deleteMany({
      where: { itemId, channel },
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
      resolveItemByExternalId: (externalItemId) => this.resolveItemId(outletId, channel, externalItemId),
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
   * Build the Order + AggregatorOrder + Payment rows in one txn,
   * plus an upserted AggregatorCustomer when the inbound payload
   * carries customer info. Pricing is recomputed locally from
   * current Item.basePrice so the kitchen receipt + reports reflect
   * what we'd charge — adapter's reportedTotal is captured on the
   * AggregatorOrder.rawPayload for reconciliation when there's a
   * delta.
   *
   * Why we don't try to populate Order.customerId for aggregator
   * orders: phones are masked, so any "match" against an existing
   * User row by phone would be either false-positive (different
   * customers sharing the same masked proxy) or false-negative (the
   * same real person ordering direct vs marketplace). Better to keep
   * them in their own AggregatorCustomer table and leave Order's
   * direct-customer link clean.
   */
  private async materialiseInboundOrder(outletId: string, inbound: InboundOrder) {
    // Upsert the marketplace customer record, if the payload carries
    // anything we can use as a join key. Stable external_customer_id
    // wins; falls back to the masked phone (prefixed so it can't
    // collide with a real external id). When neither is present
    // (rare — partner-test payloads, anonymised refund webhooks) we
    // skip the link and accept the order as customerless.
    const aggregatorCustomerId = await this.upsertAggregatorCustomer(
      outletId,
      inbound,
    );

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
          // Order.customerId stays null for aggregator orders — see
          // the doc-block above. Marketplace customer lives on the
          // AggregatorOrder side-table via aggregatorCustomerId.
          customerId: null,
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
          aggregatorCustomerId,
        },
      });
      // Bump the marketplace customer's order counter + last-order
      // stamp. Done inside the same transaction so a webhook retry
      // that re-fires the same order doesn't double-increment — the
      // (channel, externalOrderId) unique check would have rolled
      // the whole tx back before reaching here.
      if (aggregatorCustomerId) {
        await tx.aggregatorCustomer.update({
          where: { id: aggregatorCustomerId },
          data: {
            orderCount: { increment: 1 },
            lastOrderAt: new Date(),
          },
        });
      }

      return order;
    });
  }

  /**
   * Upserts the marketplace customer record. Identity key precedence:
   *   1. external_customer_id (stable per customer per restaurant on
   *      every provider we support — the right anchor when present).
   *   2. masked phone, prefixed `phone:` so it can never collide with
   *      a real external id from path 1.
   *   3. Neither → returns null. The order still saves; the marketplace
   *      customer link is simply absent.
   *
   * Display name + masked phone refresh on every order so the latest
   * payload's info wins. Counters bump in the caller's transaction.
   */
  private async upsertAggregatorCustomer(
    outletId: string,
    inbound: InboundOrder,
  ): Promise<string | null> {
    const cust = inbound.customer;
    if (!cust) return null;
    const key = cust.externalCustomerId
      ? cust.externalCustomerId
      : cust.phone
        ? `phone:${cust.phone}`
        : null;
    if (!key) return null;
    const now = new Date();
    const upserted = await this.prisma.aggregatorCustomer.upsert({
      where: {
        outletId_channel_externalCustomerId: {
          outletId,
          channel: inbound.channel,
          externalCustomerId: key,
        },
      },
      update: {
        // Keep the most recent name/phone on file. Aggregators
        // sometimes update the masked phone proxy when their call-
        // masking number rotates; we want the latest one for the
        // packing slip / rider callback.
        displayName: cust.name ?? undefined,
        maskedPhone: cust.phone ?? undefined,
      },
      create: {
        outletId,
        channel: inbound.channel,
        externalCustomerId: key,
        displayName: cust.name ?? null,
        maskedPhone: cust.phone ?? null,
        firstOrderAt: now,
        lastOrderAt: now,
        orderCount: 0,
      },
    });
    return upserted.id;
  }

  /**
   * Resolves an external item id to our internal Item id. Both the
   * per-mapping isEnabled flag AND the parent integration's isActive
   * must be on — turning off the channel on the Aggregators page
   * effectively dark-flips every mapping for that channel without
   * forcing the operator to clear them individually. Also scopes to
   * the outlet so a mapping defined on outlet A can't be picked up
   * by an inbound webhook addressed to outlet B (e.g. shared external
   * IDs across a chain).
   */
  private async resolveItemId(
    outletId: string,
    channel: AggregatorChannel,
    externalItemId: string,
  ): Promise<string | null> {
    // Cheap pre-check: is the integration on at all? Saves the bigger
    // join below when the channel is dark.
    const integration = await this.prisma.aggregatorIntegration.findUnique({
      where: { outletId_channel: { outletId, channel } },
      select: { isActive: true },
    });
    if (!integration?.isActive) return null;
    const mapping = await this.prisma.aggregatorItemMapping.findFirst({
      where: {
        channel,
        externalItemId,
        isEnabled: true,
        item: { subcategory: { category: { outletId } } },
      },
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
