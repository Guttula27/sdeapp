import { PrismaService } from '../../config/prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { OrdersGateway } from '../orders/orders.gateway';
export type LifecycleTrigger = 'ORDER_PLACED' | 'PAYMENT_RECEIVED' | 'ITEM_READY' | 'ORDER_READY' | 'ORDER_SERVED';
type OrderLine = {
    name: string;
    quantity: number;
    total: number | string;
};
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
    items?: OrderLine[];
    subtotal?: number | string;
    taxAmount?: number | string;
    totalAmount?: number | string;
    tokenNumber?: number | null;
    receiptUrl?: string;
    ringtone?: string | null;
};
export declare class LifecycleDispatcherService {
    private prisma;
    private notifications;
    private ordersGateway;
    private readonly logger;
    constructor(prisma: PrismaService, notifications: NotificationsService, ordersGateway: OrdersGateway);
    private resolveTemplateBody;
    private whatsappProvider;
    fire(trigger: LifecycleTrigger, ctx: Ctx): Promise<{
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
    } | undefined>;
}
export {};
