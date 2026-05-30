import { PrismaService } from '../../config/prisma/prisma.service';
import { OrdersGateway } from '../orders/orders.gateway';
import { OrdersService } from '../orders/orders.service';
import { PaymentMode } from '@prisma/client';
import { LifecycleDispatcherService } from '../customer-alerts/lifecycle-dispatcher.service';
import { RazorpayService } from './razorpay.service';
export declare class PaymentsService {
    private prisma;
    private ordersGateway;
    private dispatcher;
    private razorpay;
    private orders;
    constructor(prisma: PrismaService, ordersGateway: OrdersGateway, dispatcher: LifecycleDispatcherService, razorpay: RazorpayService, orders: OrdersService);
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
    createRazorpayOrder(paymentId: string): Promise<{
        paymentId: string;
        keyId: string | undefined;
        orderId: string;
        amount: number;
        currency: string;
        outletName: string;
    }>;
    verifyRazorpayPayment(input: {
        paymentId: string;
        razorpayOrderId: string;
        razorpayPaymentId: string;
        razorpaySignature: string;
    }): Promise<{
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
    handleRazorpayWebhook(payload: any, signature: string, rawBody: string): Promise<{
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
