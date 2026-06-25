import { Injectable, Logger } from '@nestjs/common';
import { AggregatorChannel, AggregatorOrderStatus, PaymentMode } from '@prisma/client';
import * as crypto from 'crypto';
import { AggregatorAdapter, InboundOrder } from '../types';

/**
 * Uber Eats Marketplace API stub.
 *
 * Reference (when wiring): https://developer.uber.com/docs/eats/
 *
 * Uber uses OAuth client_credentials + X-Uber-Signature on webhooks
 * (HMAC-SHA256 against the client_secret). Status codes are slightly
 * different from Zomato/Swiggy — see the mapping at the bottom of
 * this file for the live wiring later.
 */
@Injectable()
export class UberEatsAdapter implements AggregatorAdapter {
  readonly channel = AggregatorChannel.UBER_EATS;
  private readonly logger = new Logger(UberEatsAdapter.name);

  verifyInboundSignature(rawBody: string, headers: Record<string, string>, webhookSecret: string): boolean {
    if (!webhookSecret) return false;
    const sig = headers['x-uber-signature'] ?? headers['X-Uber-Signature'];
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
    const order = payload?.event_type === 'orders.notification' ? payload?.meta?.resource : payload;
    if (!order?.id) return null;

    const items: InboundOrder['items'] = [];
    for (const line of order.cart?.items ?? []) {
      const externalId = String(line.id);
      const itemId = await ctx.resolveItemByExternalId(externalId);
      if (!itemId) {
        this.logger.warn(`Uber Eats item ${externalId} has no mapping — skipping`);
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
      channel: AggregatorChannel.UBER_EATS,
      externalOrderId: String(order.id),
      customer: {
        // Uber Eats uses "eater" for the customer entity. The eater.id
        // is stable per customer per restaurant.
        externalCustomerId: order.eater?.id
          ? String(order.eater.id)
          : undefined,
        name: order.customer?.name ?? order.eater?.first_name,
        phone: order.customer?.phone ?? order.eater?.phone,
      },
      items,
      reportedTotal: order.payment?.charges?.total?.amount
        ? Number(order.payment.charges.total.amount) / 100 // cents → rupees
        : undefined,
      paymentMode: PaymentMode.WALLET,
      isParcel: order.fulfillment_type !== 'dine_in',
      notes: order.eater?.first_name ? `For ${order.eater.first_name}` : undefined,
      rawPayload: payload,
    };
  }

  async syncStatus(): Promise<void> {
    this.logger.log('Uber Eats syncStatus called (stub) — wire when credentials are available');
  }

  async syncMenu(): Promise<void> {
    this.logger.log('Uber Eats syncMenu called (stub) — push the full menu JSON when wired');
  }

  async toggleItem(
    _integration: any,
    externalItemId: string,
    isAvailable: boolean,
  ): Promise<void> {
    this.logger.log(
      `Uber Eats toggleItem (stub): item=${externalItemId} available=${isAvailable}`,
    );
  }

  static mapStatusToUberEats(status: AggregatorOrderStatus): string {
    switch (status) {
      case AggregatorOrderStatus.ACCEPTED: return 'accepted';
      case AggregatorOrderStatus.REJECTED: return 'denied';
      case AggregatorOrderStatus.PREPARING: return 'in_preparation';
      case AggregatorOrderStatus.READY: return 'ready_for_pickup';
      case AggregatorOrderStatus.DISPATCHED: return 'in_transit';
      case AggregatorOrderStatus.DELIVERED: return 'delivered';
      case AggregatorOrderStatus.CANCELLED: return 'canceled';
      default: return 'received';
    }
  }
}
