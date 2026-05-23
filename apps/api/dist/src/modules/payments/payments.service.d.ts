import { PrismaService } from '../../config/prisma/prisma.service';
import { OrdersGateway } from '../orders/orders.gateway';
import { PaymentMode } from '@prisma/client';
import { LifecycleDispatcherService } from '../customer-alerts/lifecycle-dispatcher.service';
export declare class PaymentsService {
    private prisma;
    private ordersGateway;
    private dispatcher;
    constructor(prisma: PrismaService, ordersGateway: OrdersGateway, dispatcher: LifecycleDispatcherService);
    initiatePayment(orderId: string, mode: PaymentMode, amount: number): Promise<{
        id: string;
        status: import(".prisma/client").$Enums.PaymentStatus;
        createdAt: Date;
        updatedAt: Date;
        amount: import("@prisma/client/runtime/library").Decimal;
        mode: import(".prisma/client").$Enums.PaymentMode;
        isRefund: boolean;
        gatewayRef: string | null;
        gatewayResponse: import("@prisma/client/runtime/library").JsonValue | null;
        orderId: string;
    } | {
        paymentId: string;
        amount: number;
        mode: "UPI" | "CARD" | "WALLET" | "NET_BANKING";
        orderId: string;
    }>;
    confirmPayment(paymentId: string, gatewayRef: string | null): Promise<{
        id: string;
        status: import(".prisma/client").$Enums.PaymentStatus;
        createdAt: Date;
        updatedAt: Date;
        amount: import("@prisma/client/runtime/library").Decimal;
        mode: import(".prisma/client").$Enums.PaymentMode;
        isRefund: boolean;
        gatewayRef: string | null;
        gatewayResponse: import("@prisma/client/runtime/library").JsonValue | null;
        orderId: string;
    }>;
    failPayment(paymentId: string, reason?: string): Promise<{
        id: string;
        status: import(".prisma/client").$Enums.PaymentStatus;
        createdAt: Date;
        updatedAt: Date;
        amount: import("@prisma/client/runtime/library").Decimal;
        mode: import(".prisma/client").$Enums.PaymentMode;
        isRefund: boolean;
        gatewayRef: string | null;
        gatewayResponse: import("@prisma/client/runtime/library").JsonValue | null;
        orderId: string;
    }>;
    getPaymentsByOrder(orderId: string): Promise<{
        id: string;
        status: import(".prisma/client").$Enums.PaymentStatus;
        createdAt: Date;
        updatedAt: Date;
        amount: import("@prisma/client/runtime/library").Decimal;
        mode: import(".prisma/client").$Enums.PaymentMode;
        isRefund: boolean;
        gatewayRef: string | null;
        gatewayResponse: import("@prisma/client/runtime/library").JsonValue | null;
        orderId: string;
    }[]>;
    handleRazorpayWebhook(payload: any, signature: string): Promise<{
        id: string;
        status: import(".prisma/client").$Enums.PaymentStatus;
        createdAt: Date;
        updatedAt: Date;
        amount: import("@prisma/client/runtime/library").Decimal;
        mode: import(".prisma/client").$Enums.PaymentMode;
        isRefund: boolean;
        gatewayRef: string | null;
        gatewayResponse: import("@prisma/client/runtime/library").JsonValue | null;
        orderId: string;
    } | {
        received: boolean;
    }>;
}
