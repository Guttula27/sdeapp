import {
  AggregatorChannel,
  AggregatorOrderStatus,
  PaymentMode,
} from '@prisma/client';

/**
 * Adapter-friendly inbound-order shape. Each provider's webhook
 * payload is parsed into this normalised form before reaching
 * AggregatorsService.registerInboundOrder — so the service stays
 * channel-agnostic and adapters can evolve independently.
 *
 * Items reference our internal Item ids — the adapter resolves the
 * provider's per-channel ids against AggregatorItemMapping before
 * yielding the InboundOrder. When a mapping is missing the adapter
 * either fails fast or uses a fallback "unmapped item" placeholder
 * (provider-specific decision; document in the adapter).
 */
export interface InboundOrder {
  channel: AggregatorChannel;
  externalOrderId: string;
  // Customer info as the aggregator provided it. Phone is the join
  // key against our User table (existing menu/auth flows already
  // resolve customers by phone hash).
  customer?: {
    name?: string;
    phone?: string;
  };
  items: Array<{
    itemId: string;
    variantId?: string;
    quantity: number;
    notes?: string;
  }>;
  // Aggregator-side totals — we still recompute locally for the
  // kitchen receipt + reports, but we keep these for reconciliation
  // when there's a delta between what we charged vs what the
  // aggregator collected.
  reportedTotal?: number;
  reportedTax?: number;
  // Payment is already collected by the aggregator (they do the
  // checkout). We record it as a SUCCESS Payment row on our side
  // tagged with the inbound channel mode.
  paymentMode: PaymentMode;
  // Raw inbound payload, persisted on AggregatorOrder.rawPayload for
  // audit. Strongly recommended for adapters to forward verbatim —
  // shape changes on the provider side become traceable here.
  rawPayload?: any;
  // Optional notes / instructions from the customer ("less spicy",
  // "no onion") — surfaced on the kitchen receipt.
  notes?: string;
  // Whether this is delivery or self-pickup. Most aggregator orders
  // are delivery; some platforms expose "self pickup" too.
  isParcel: boolean;
}

export interface AggregatorAdapter {
  readonly channel: AggregatorChannel;

  /**
   * Validate the inbound webhook signature against the configured
   * webhook secret. Each provider has its own signing scheme; the
   * adapter encapsulates it. Return false → controller responds 401
   * without touching the DB.
   */
  verifyInboundSignature(rawBody: string, headers: Record<string, string>, webhookSecret: string): boolean;

  /**
   * Parse the inbound payload into our normalised InboundOrder.
   * Adapters resolve external_item_id → our Item id via
   * AggregatorItemMapping (passed in by the service). Throw to
   * reject the webhook entirely; return null to acknowledge but
   * skip (e.g. duplicate that we already processed).
   */
  parseInboundOrder(
    payload: any,
    ctx: { outletId: string; resolveItemByExternalId: (externalItemId: string) => Promise<string | null> },
  ): Promise<InboundOrder | null>;

  /**
   * Push a status update back to the aggregator. Adapters are
   * responsible for retry policy + idempotency on the provider side
   * (most aggregators accept the same status twice as a no-op).
   */
  syncStatus(
    integration: { credentials: any; externalRestaurantId: string | null },
    externalOrderId: string,
    status: AggregatorOrderStatus,
  ): Promise<void>;

  /**
   * Push the full menu to the aggregator. Optional; some providers
   * (Zomato) require a portal upload. When the adapter doesn't
   * support it, throw NotImplemented and the operator pushes from
   * the provider dashboard.
   */
  syncMenu(
    integration: { credentials: any; externalRestaurantId: string | null },
    menu: any,
  ): Promise<void>;

  /**
   * Toggle a single item's availability on the aggregator without
   * a full menu sync. Hot path for in-shift stock-out alerts. Same
   * NotImplemented escape hatch as syncMenu.
   */
  toggleItem(
    integration: { credentials: any; externalRestaurantId: string | null },
    externalItemId: string,
    isAvailable: boolean,
  ): Promise<void>;
}
