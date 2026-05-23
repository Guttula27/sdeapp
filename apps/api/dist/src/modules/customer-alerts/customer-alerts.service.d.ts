import { PrismaService } from '../../config/prisma/prisma.service';
export declare class CustomerAlertsService {
    private prisma;
    constructor(prisma: PrismaService);
    list(customerId: string, opts?: {
        unreadOnly?: boolean;
        limit?: number;
    }): import(".prisma/client").Prisma.PrismaPromise<{
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
    unreadCount(customerId: string): import(".prisma/client").Prisma.PrismaPromise<number>;
    markRead(customerId: string, id: string): Promise<import(".prisma/client").Prisma.BatchPayload>;
    markAllRead(customerId: string): Promise<import(".prisma/client").Prisma.BatchPayload>;
}
