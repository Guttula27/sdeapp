import { PaymentsService } from './payments.service';
import { PaymentMode } from '@prisma/client';
export declare class PaymentsController {
    private service;
    constructor(service: PaymentsService);
    initiate(body: {
        orderId: string;
        mode: PaymentMode;
        amount: number;
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
    } | {
        paymentId: string;
        amount: number;
        mode: "UPI" | "CARD" | "WALLET" | "NET_BANKING";
        orderId: string;
    }>;
    confirm(id: string, gatewayRef: string): Promise<{
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
    getByOrder(orderId: string): Promise<{
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
    razorpayWebhook(payload: any): Promise<{
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
