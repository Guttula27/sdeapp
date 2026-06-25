import { Injectable, Logger, NotImplementedException } from '@nestjs/common';
import { AggregatorChannel, AggregatorOrderStatus, PaymentMode } from '@prisma/client';
import * as crypto from 'crypto';
import { AggregatorAdapter, InboundOrder } from '../types';

/**
 * Zomato Restaurant Partner API stub.
 *
 * Reference (when wiring): https://api-docs.zomato.com/
 *
 * Webhook signature: Zomato signs the body with an HMAC-SHA256 using
 * the shared webhook secret and sends it in the X-Zomato-Signature
 * header. The verifier below is fully wired; the parse + push methods
 * are sketches that log + return so the rest of the framework can
 * exercise without live API calls.
 */
@Injectable()
export class ZomatoAdapter implements AggregatorAdapter {
  readonly channel = AggregatorChannel.ZOMATO;
  private readonly logger = new Logger(ZomatoAdapter.name);

  verifyInboundSignature(rawBody: string, headers: Record<string, string>, webhookSecret: string): boolean {
    if (!webhookSecret) return false;
    const sig = headers['x-zomato-signature'] ?? headers['X-Zomato-Signature'];
    if (!sig) return false;
    const expected = crypto.createHmac('sha256', webhookSecret).update(rawBody).digest('hex');
    try {
      return crypto.timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(expected, 'hex'));
    } catch {
      return false;
    }
  }

  async parseInboundOrder(
    payload: any,
    ctx: { outletId: string; resolveItemByExternalId: (externalItemId: string) => Promise<string | null> },
  ): Promise<InboundOrder | null> {
    // Zomato wraps the order under payload.data.order. The mapping
    // below is a rough sketch — verify against the live payload spec
    // before flipping isActive on the integration.
    const order = payload?.data?.order ?? payload?.order;
    if (!order?.order_id) return null;

    const items: InboundOrder['items'] = [];
    for (const line of order.items ?? []) {
      const itemId = await ctx.resolveItemByExternalId(String(line.menu_item_id));
      if (!itemId) {
        this.logger.warn(`Zomato item ${line.menu_item_id} has no AggregatorItemMapping — skipping`);
        continue;
      }
      items.push({
        itemId,
        quantity: Number(line.quantity ?? 1),
        notes: line.special_instructions ?? undefined,
      });
    }
    if (items.length === 0) return null;

    return {
      channel: AggregatorChannel.ZOMATO,
      externalOrderId: String(order.order_id),
      customer: {
        // Zomato exposes a stable per-customer id on the customer
        // object. When the field is absent (very early integration
        // payloads, partner-test orders) the service falls back to
        // the masked phone.
        externalCustomerId: order.customer?.customer_id
          ? String(order.customer.customer_id)
          : undefined,
        name: order.customer?.name,
        phone: order.customer?.phone,
      },
      items,
      reportedTotal: order.total_cost ? Number(order.total_cost) : undefined,
      reportedTax: order.tax_amount ? Number(order.tax_amount) : undefined,
      // Zomato collects payment at checkout — record as WALLET (the
      // closest enum match for "paid via marketplace"); split per
      // tender at reconciliation time via the rawPayload.
      paymentMode: PaymentMode.WALLET,
      isParcel: order.delivery_mode !== 'pickup',
      notes: order.special_instructions ?? undefined,
      rawPayload: payload,
    };
  }

  async syncStatus(): Promise<void> {
    // STUB — real impl: PUT /partner/orders/:id/status with the
    // Zomato status code mapped from AggregatorOrderStatus.
    this.logger.log('Zomato syncStatus called (stub) — wire when credentials are available');
  }

  async syncMenu(): Promise<void> {
    throw new NotImplementedException(
      'Zomato menu sync is portal-driven — push the menu CSV from the Zomato Partner Hub',
    );
  }

  async toggleItem(
    _integration: any,
    externalItemId: string,
    isAvailable: boolean,
  ): Promise<void> {
    // STUB — real impl: POST /partner/menu/items/toggle with
    // { menu_item_id, in_stock }.
    this.logger.log(
      `Zomato toggleItem (stub): item=${externalItemId} available=${isAvailable}`,
    );
  }

  // Mapping helper for the syncStatus push (unused while stubbed,
  // but documented so the wiring is obvious when the integration
  // goes live).
  static mapStatusToZomato(status: AggregatorOrderStatus): string {
    switch (status) {
      case AggregatorOrderStatus.ACCEPTED: return 'order_confirmed';
      case AggregatorOrderStatus.REJECTED: return 'order_rejected';
      case AggregatorOrderStatus.PREPARING: return 'order_preparing';
      case AggregatorOrderStatus.READY: return 'food_ready';
      case AggregatorOrderStatus.DISPATCHED: return 'order_picked_up';
      case AggregatorOrderStatus.DELIVERED: return 'order_delivered';
      case AggregatorOrderStatus.CANCELLED: return 'order_cancelled';
      default: return 'order_received';
    }
  }
}
