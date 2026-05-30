import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import * as crypto from 'crypto';

type RazorpayOrder = {
  id: string;
  amount: number;
  currency: string;
  status: string;
};

// Thin wrapper around the razorpay node SDK. Lazy-instantiated so the API
// boots fine when keys are absent — gateway endpoints just 503 instead.
@Injectable()
export class RazorpayService {
  private client: any = null;

  get keyId(): string | undefined {
    return process.env.RAZORPAY_KEY_ID || undefined;
  }

  private get keySecret(): string | undefined {
    return process.env.RAZORPAY_KEY_SECRET || undefined;
  }

  private get webhookSecret(): string | undefined {
    return process.env.RAZORPAY_WEBHOOK_SECRET || undefined;
  }

  isConfigured(): boolean {
    return !!(this.keyId && this.keySecret);
  }

  private ensureClient() {
    if (this.client) return this.client;
    if (!this.isConfigured()) {
      throw new ServiceUnavailableException(
        'Razorpay is not configured — set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.',
      );
    }
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Razorpay = require('razorpay');
    this.client = new Razorpay({ key_id: this.keyId, key_secret: this.keySecret });
    return this.client;
  }

  async createOrder(opts: {
    amountInRupees: number;
    receipt: string;
    notes?: Record<string, string>;
  }): Promise<RazorpayOrder> {
    const client = this.ensureClient();
    return client.orders.create({
      amount: Math.round(opts.amountInRupees * 100),
      currency: 'INR',
      receipt: opts.receipt,
      notes: opts.notes,
    });
  }

  // When stubbed (RAZORPAY_STUB_TRANSFERS=true OR Razorpay is unconfigured),
  // skip the actual gateway call and return a fake Route-shaped order. We
  // still persist the requested transfers[] so the audit trail matches what
  // production will produce.
  isStubbed(): boolean {
    if (!this.isConfigured()) return true;
    return (process.env.RAZORPAY_STUB_TRANSFERS || '').toLowerCase() === 'true';
  }

  // Cluster checkout flow — creates a Razorpay Route order. `transfers` is
  // the per-outlet split: each entry routes funds to one outlet's Linked
  // Account (LA) on capture. When stubbed, the response is fabricated with
  // a 'rp_stub_' prefix so it's obvious in logs/DB this wasn't a real call.
  async createRouteOrder(opts: {
    amountInRupees: number;
    receipt: string;
    notes?: Record<string, string>;
    transfers: Array<{
      account: string;        // razorpayLinkedAccountId
      amountInRupees: number; // outlet's slice
      notes?: Record<string, string>;
    }>;
  }): Promise<RazorpayOrder & { stubbed?: boolean }> {
    if (this.isStubbed()) {
      // Stubbed path — return a deterministic-ish fake order so the
      // downstream code paths (verify, mark-paid) execute the same way.
      const fakeId = 'rp_stub_' + crypto.randomBytes(8).toString('hex');
      return {
        id: fakeId,
        amount: Math.round(opts.amountInRupees * 100),
        currency: 'INR',
        status: 'created',
        stubbed: true,
      };
    }
    const client = this.ensureClient();
    return client.orders.create({
      amount: Math.round(opts.amountInRupees * 100),
      currency: 'INR',
      receipt: opts.receipt,
      notes: opts.notes,
      transfers: opts.transfers.map((t) => ({
        account: t.account,
        amount: Math.round(t.amountInRupees * 100),
        currency: 'INR',
        notes: t.notes,
        // Funds settle to the LA on payment capture. Adjust for refunds /
        // hold periods when productionising the cluster flow.
        on_hold: 0,
      })),
    });
  }

  verifyHandlerSignature(orderId: string, paymentId: string, signature: string): boolean {
    if (!this.keySecret) return false;
    const expected = crypto
      .createHmac('sha256', this.keySecret)
      .update(`${orderId}|${paymentId}`)
      .digest('hex');
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  }

  verifyWebhookSignature(rawBody: string, signature: string): boolean {
    if (!this.webhookSecret) return false;
    const expected = crypto
      .createHmac('sha256', this.webhookSecret)
      .update(rawBody)
      .digest('hex');
    try {
      return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
    } catch {
      return false;
    }
  }
}
