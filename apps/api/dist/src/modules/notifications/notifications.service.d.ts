export declare class NotificationsService {
    private readonly logger;
    sendSms(to: string, message: string): Promise<void>;
    sendWhatsApp(to: string, message: string): Promise<void>;
    sendEmail(to: string, subject: string, html: string): Promise<void>;
    notifyOrderStatus(phone: string, orderNumber: string, status: string): Promise<void>;
    notifyLowStock(email: string, materialName: string, currentStock: number, unit: string): Promise<void>;
}
