import { Injectable, Logger } from '@nestjs/common';
import { TemplateChannel } from '@prisma/client';
import { PrismaService } from '../../config/prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { OrdersGateway } from '../orders/orders.gateway';
import { PushService } from '../push/push.service';

/**
 * Lifecycle triggers — keep in sync with the seeded platform template names.
 * Adding a new trigger? Seed a default WhatsApp template at PLATFORM scope so
 * the dispatcher has something to render even when business/outlets haven't
 * customised the message.
 */
export type LifecycleTrigger =
  | 'ORDER_PLACED'
  | 'PAYMENT_RECEIVED'
  | 'ITEM_READY'
  | 'ORDER_READY'
  | 'PICKUP_READY'
  | 'ORDER_SERVED';

const FALLBACK_BODIES: Record<LifecycleTrigger, string> = {
  ORDER_PLACED:
    'Hi {{customer_name}}, your order *{{order_number}}* at {{outlet_name}} has been placed.\n\n' +
    '*Items*\n{{items_list}}\n\n' +
    'Total: *{{total}}*\nToken: {{token_number}}\n\n' +
    'View receipt: {{receipt_url}}',
  PAYMENT_RECEIVED: 'Payment of ₹{{amount}} received for order {{order_number}}.',
  ITEM_READY: 'Your {{item}} is ready (order {{order_number}}).',
  ORDER_READY: 'Your order {{order_number}} is ready.',
  PICKUP_READY: 'Your parcel order {{order_number}} is packed and ready for pickup at {{outlet_name}}.',
  ORDER_SERVED: 'Order {{order_number}} has been served. Enjoy!',
};

const TITLES: Record<LifecycleTrigger, string> = {
  ORDER_PLACED: 'Order placed',
  PAYMENT_RECEIVED: 'Payment received',
  ITEM_READY: 'Item ready',
  ORDER_READY: 'Order ready',
  PICKUP_READY: 'Ready for pickup',
  ORDER_SERVED: 'Order served',
};

type OrderLine = { name: string; quantity: number; total: number | string };

type Ctx = {
  customerId: string;
  customerName?: string | null;
  customerPhone?: string | null;
  outletId: string;
  outletName?: string | null;
  businessId?: string | null;
  orderId?: string;
  orderItemId?: string;
  orderNumber?: string;
  itemName?: string;
  amount?: number | string;
  // Receipt fields — populated by orders.service on ORDER_PLACED so the
  // template can render a full line-itemised summary inside WhatsApp.
  items?: OrderLine[];
  subtotal?: number | string;
  taxAmount?: number | string;
  totalAmount?: number | string;
  tokenNumber?: number | null;
  receiptUrl?: string;
  ringtone?: string | null;
};

function render(body: string, vars: Record<string, string | number | null | undefined>) {
  return body.replace(/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g, (_, key) => {
    const v = vars[key];
    return v === undefined || v === null ? '' : String(v);
  });
}

@Injectable()
export class LifecycleDispatcherService {
  private readonly logger = new Logger(LifecycleDispatcherService.name);

  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
    private ordersGateway: OrdersGateway,
    private push: PushService,
  ) {}

  /**
   * Resolve the best WhatsApp template body for this trigger. Most-specific
   * scope wins, but only APPROVED templates are usable:
   *   OUTLET (approved) → BUSINESS (approved) → PLATFORM (approved)
   * Falls back to a hard-coded boilerplate so the customer always receives
   * something, even before any provider is configured.
   */
  private async resolveTemplateBody(
    trigger: LifecycleTrigger,
    channel: TemplateChannel,
    businessId?: string | null,
    outletId?: string | null,
  ): Promise<string> {
    const where = {
      trigger,
      channel,
      approvalStatus: 'APPROVED' as const,
    };
    const candidates = await this.prisma.messageTemplate.findMany({
      where: {
        ...where,
        OR: [
          { scope: 'OUTLET', outletId: outletId ?? undefined },
          { scope: 'BUSINESS', businessId: businessId ?? undefined },
          { scope: 'PLATFORM' },
        ],
      },
    });
    const byScope = (s: 'OUTLET' | 'BUSINESS' | 'PLATFORM') => candidates.find((c) => c.scope === s);
    const picked = byScope('OUTLET') || byScope('BUSINESS') || byScope('PLATFORM');
    return picked?.body || FALLBACK_BODIES[trigger];
  }

  /**
   * Returns the active default WhatsApp provider, or null if none configured.
   * The dispatcher treats "no provider" as "fall back to in-app alert only".
   */
  private async whatsappProvider() {
    return this.prisma.integrationConfig.findFirst({
      where: { channel: 'WHATSAPP', isActive: true, isDefault: true },
    });
  }

  /**
   * Fire the dispatcher for a lifecycle event. Always writes a CustomerAlert
   * (so the customer's in-app alerts feed shows it), attempts WhatsApp if a
   * provider is configured, and pushes a socket event so connected clients
   * can ring the user's preferred ringtone.
   */
  async fire(trigger: LifecycleTrigger, ctx: Ctx) {
    // No customer linked to this order (e.g. counter-only walk-in) → nothing to do.
    if (!ctx.customerId) return;

    const customer = await this.prisma.user.findUnique({
      where: { id: ctx.customerId },
      select: { name: true, phone: true, alertRingtone: true },
    });
    if (!customer) return;

    const body = await this.resolveTemplateBody(trigger, 'WHATSAPP', ctx.businessId, ctx.outletId);

    // Render a multi-line itemised list for the receipt-style template. WhatsApp
    // honours newlines + *bold* markers, so we lean on that for readability.
    const itemsList = (ctx.items ?? [])
      .map((it) => `• ${it.name} × ${it.quantity} — ₹${Number(it.total).toFixed(0)}`)
      .join('\n');

    const rendered = render(body, {
      customer_name: ctx.customerName ?? customer.name,
      order_number: ctx.orderNumber,
      order_id: ctx.orderId,
      item: ctx.itemName,
      outlet_name: ctx.outletName,
      amount: ctx.amount,
      datetime: new Date().toLocaleString(),
      items_list: itemsList,
      subtotal: ctx.subtotal !== undefined ? `₹${Number(ctx.subtotal).toFixed(0)}` : '',
      tax: ctx.taxAmount !== undefined ? `₹${Number(ctx.taxAmount).toFixed(0)}` : '',
      total: ctx.totalAmount !== undefined ? `₹${Number(ctx.totalAmount).toFixed(0)}` : '',
      token_number: ctx.tokenNumber ?? '',
      receipt_url: ctx.receiptUrl ?? '',
    });

    const provider = await this.whatsappProvider();
    const hasApiKey = !!provider?.config && Object.values(provider.config as object).some((v) => !!v);
    let sentVia: 'IN_APP' | 'WHATSAPP' | 'BOTH' = 'IN_APP';
    let whatsappError: string | null = null;

    if (provider && hasApiKey && customer.phone) {
      try {
        await this.notifications.sendWhatsApp(customer.phone, rendered);
        sentVia = 'BOTH';
      } catch (e: any) {
        this.logger.warn(`WhatsApp send failed for ${customer.phone}: ${e?.message}`);
        whatsappError = e?.message || 'send failed';
      }
    }

    // Decide whether this alert should be "loud" (ringtone + popup +
    // FCM push) or "quiet" (toast + bell-list entry only). The split
    // mirrors the physical fulfilment model:
    //
    //   table-service (DINE_IN_*, HYBRID + tableId set)
    //     → waiter walks the food over. Ringing the customer is
    //       annoying and unnecessary; the tracking page status
    //       update is enough.
    //   self-service / pickup / parcel / counter
    //     → customer has to act. Ring them.
    //
    // ORDER_PLACED / PAYMENT_RECEIVED / ORDER_SERVED are never loud
    // regardless — those are informational. Only the "ready" set
    // ever ring even on the self-service path.
    const READY_TRIGGERS: LifecycleTrigger[] = ['ITEM_READY', 'ORDER_READY', 'PICKUP_READY'];
    let isLoud = (READY_TRIGGERS as string[]).includes(trigger);
    if (isLoud && ctx.orderId) {
      const order = await this.prisma.order.findUnique({
        where: { id: ctx.orderId },
        select: { tableId: true, outlet: { select: { outletType: true } } },
      });
      const tableServiceOutlet = !!order && (
        order.outlet?.outletType === 'DINE_IN_PREPAID'
        || order.outlet?.outletType === 'DINE_IN_POSTPAID'
        || order.outlet?.outletType === 'HYBRID'
      );
      // A table-service outlet AND a tableId on the order → waiter
      // path. HYBRID outlets can do both, so we only suppress when a
      // table is actually attached.
      if (tableServiceOutlet && order?.tableId) {
        isLoud = false;
      }
    }

    const alert = await this.prisma.customerAlert.create({
      data: {
        customerId: ctx.customerId,
        orderId: ctx.orderId,
        orderItemId: ctx.orderItemId,
        trigger,
        title: TITLES[trigger],
        body: rendered,
        ringtone: ctx.ringtone || customer.alertRingtone || 'chime',
        sentVia,
        whatsappError,
        isLoud,
      },
    });

    // Push to the customer's socket room and the order's room so the customer
    // app can ring the ringtone + flash a toast in real time.
    this.ordersGateway.emitCustomerAlert(alert);

    // Fan out to every push subscription this customer has registered
    // (FCM tokens on Capacitor APKs today; Web Push subscriptions for
    // browser PWAs once the SW handler lands). Fire-and-forget — the
    // socket emit + in-app retry path above is already best-effort,
    // and a push failure shouldn't fail the calling order flow.
    // Quiet alerts skip the push pathway entirely — the customer
    // already sees the status update on the tracking page; no need
    // to wake their device.
    if (isLoud) {
      void this.push.sendToUser(ctx.customerId, {
        title: alert.title,
        body: alert.body,
        ringtone: alert.ringtone,
        data: {
          // Keep the keys short and primitive — FCM data payload is a
          // flat string→string map. The customer client uses these to
          // deep-link into the right page when the user taps the
          // notification.
          alertId: alert.id,
          trigger: alert.trigger,
          ...(alert.orderId ? { orderId: alert.orderId } : {}),
          ...(alert.orderItemId ? { orderItemId: alert.orderItemId } : {}),
        },
      }).catch((e) => this.logger.warn(`Push fan-out failed for ${ctx.customerId}: ${e?.message}`));
    }

    return alert;
  }
}
