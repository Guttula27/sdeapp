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
