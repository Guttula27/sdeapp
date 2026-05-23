import { CustomerAlertsService } from './customer-alerts.service';
export declare class CustomerAlertsController {
    private service;
    constructor(service: CustomerAlertsService);
    list(user: any, unread?: string, limit?: string): import(".prisma/client").Prisma.PrismaPromise<{
        title: string;
        id: string;
        createdAt: Date;
        customerId: string;
        orderItemId: string | null;
        orderId: string | null;
        trigger: string;
        body: string;
        ringtone: string | null;
        sentVia: string;
        whatsappError: string | null;
        isRead: boolean;
    }[]>;
    unreadCount(user: any): import(".prisma/client").Prisma.PrismaPromise<number>;
    readAll(user: any): Promise<import(".prisma/client").Prisma.BatchPayload>;
    read(user: any, id: string): Promise<import(".prisma/client").Prisma.BatchPayload>;
}
