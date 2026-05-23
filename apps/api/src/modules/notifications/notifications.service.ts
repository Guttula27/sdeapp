import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  async sendSms(to: string, message: string) {
    this.logger.log(`SMS to ${to}: ${message}`);
    // Integrate Twilio here
    // const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    // await client.messages.create({ from: process.env.TWILIO_FROM_NUMBER, to, body: message });
  }

  async sendWhatsApp(to: string, message: string) {
    this.logger.log(`WhatsApp to ${to}: ${message}`);
    // Twilio WhatsApp integration
  }

  async sendEmail(to: string, subject: string, html: string) {
    this.logger.log(`Email to ${to}: ${subject}`);
    // SendGrid integration
  }

  async notifyOrderStatus(phone: string, orderNumber: string, status: string) {
    const messages: Record<string, string> = {
      ACCEPTED: `Your order ${orderNumber} has been accepted and will be prepared shortly.`,
      READY: `Your order ${orderNumber} is ready! Please collect it.`,
      DELIVERED: `Your order ${orderNumber} has been delivered. Enjoy your meal!`,
      CANCELLED: `Your order ${orderNumber} has been cancelled. Contact the outlet for assistance.`,
    };
    const message = messages[status];
    if (message) await this.sendSms(phone, message);
  }

  async notifyLowStock(email: string, materialName: string, currentStock: number, unit: string) {
    await this.sendEmail(
      email,
      'Low Stock Alert - PayNPik',
      `<p>Stock alert: <strong>${materialName}</strong> is running low. Current stock: ${currentStock} ${unit}.</p>`,
    );
  }
}
