import { Injectable, Logger, NotImplementedException } from '@nestjs/common';
import { AggregatorChannel, AggregatorOrderStatus, PaymentMode } from '@prisma/client';
import * as crypto from 'crypto';
import { AggregatorAdapter, InboundOrder } from '../types';

/**
 * Swiggy Restaurant Partner API stub. Same shape as the Zomato adapter
 * — see the doc-block there for the framework's design intent. Real
 * endpoints are TBD when the operator's API keys are provisioned.
 *
 * Swiggy uses x-swiggy-signature (HMAC-SHA256, hex). Their menu API
 * is direct (supports syncMenu and toggleItem), so we don't throw
 * NotImplemented on those paths — we just log under the stub.
 */
@Injectable()
export class SwiggyAdapter implements AggregatorAdapter {
  readonly channel = AggregatorChannel.SWIGGY;
  private readonly logger = new Logger(SwiggyAdapter.name);

  verifyInboundSignature(rawBody: string, headers: Record<string, string>, webhookSecret: string): boolean {
    if (!webhookSecret) return false;
    const sig = headers['x-swiggy-signature'] ?? headers['X-Swiggy-Signature'];
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
    const order = payload?.order ?? payload;
    if (!order?.order_id) return null;

    const items: InboundOrder['items'] = [];
    for (const line of order.line_items ?? order.items ?? []) {
      const externalId = String(line.swiggy_item_id ?? line.item_id);
      const itemId = await ctx.resolveItemByExternalId(externalId);
      if (!itemId) {
        this.logger.warn(`Swiggy item ${externalId} has no mapping — skipping`);
        continue;
      }
      items.push({
        itemId,
        quantity: Number(line.quantity ?? 1),
        notes: line.special_request ?? undefined,
      });
    }
    if (items.length === 0) return null;

    return {
      channel: AggregatorChannel.SWIGGY,
      externalOrderId: String(order.order_id),
      customer: {
        name: order.customer_name,
        phone: order.customer_phone,
      },
      items,
      reportedTotal: order.total ? Number(order.total) : undefined,
      reportedTax: order.tax ? Number(order.tax) : undefined,
      paymentMode: PaymentMode.WALLET,
      isParcel: true, // Swiggy is delivery-only on the food side
      notes: order.notes ?? undefined,
      rawPayload: payload,
    };
  }

  async syncStatus(): Promise<void> {
    this.logger.log('Swiggy syncStatus called (stub) — wire when credentials are available');
  }

  async syncMenu(): Promise<void> {
    this.logger.log('Swiggy syncMenu called (stub) — push the full menu JSON when wired');
  }

  async toggleItem(
    _integration: any,
    externalItemId: string,
    isAvailable: boolean,
  ): Promise<void> {
    this.logger.log(
      `Swiggy toggleItem (stub): item=${externalItemId} available=${isAvailable}`,
    );
  }

  static mapStatusToSwiggy(status: AggregatorOrderStatus): string {
    switch (status) {
      case AggregatorOrderStatus.ACCEPTED: return 'CONFIRMED';
      case AggregatorOrderStatus.REJECTED: return 'REJECTED';
      case AggregatorOrderStatus.PREPARING: return 'IN_KITCHEN';
      case AggregatorOrderStatus.READY: return 'FOOD_READY';
      case AggregatorOrderStatus.DISPATCHED: return 'DE_ASSIGNED';
      case AggregatorOrderStatus.DELIVERED: return 'DELIVERED';
      case AggregatorOrderStatus.CANCELLED: return 'CANCELLED';
      default: return 'NEW';
    }
  }

  // Required NotImplementedException re-export so the file's lint
  // doesn't flag the unused import when stubbed methods are extended.
  private _hint = NotImplementedException;
}
