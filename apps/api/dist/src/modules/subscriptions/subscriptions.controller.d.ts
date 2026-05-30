import { SubscriptionsService } from './subscriptions.service';
export declare class SubscriptionsController {
    private service;
    constructor(service: SubscriptionsService);
    getPlans(): Promise<{
        name: string;
        description: string | null;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        isActive: boolean;
        monthlyCost: import("@prisma/client/runtime/library").Decimal;
        annualCost: import("@prisma/client/runtime/library").Decimal;
        maxOutlets: number;
        maxUsers: number;
        transactionLimit: number | null;
        storageLimit: number | null;
        features: import("@prisma/client/runtime/library").JsonValue;
    }[]>;
    createPlan(body: any): Promise<{
        name: string;
        description: string | null;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        isActive: boolean;
        monthlyCost: import("@prisma/client/runtime/library").Decimal;
        annualCost: import("@prisma/client/runtime/library").Decimal;
        maxOutlets: number;
        maxUsers: number;
        transactionLimit: number | null;
        storageLimit: number | null;
        features: import("@prisma/client/runtime/library").JsonValue;
    }>;
    subscribe(body: {
        businessId: string;
        planId: string;
        billing: 'MONTHLY' | 'ANNUAL';
    }): Promise<{
        id: string;
        status: import(".prisma/client").$Enums.SubscriptionStatus;
        createdAt: Date;
        updatedAt: Date;
        startDate: Date;
        endDate: Date;
        autoRenew: boolean;
        planId: string;
    }>;
    getSubscription(businessId: string): Promise<({
        plan: {
            name: string;
            description: string | null;
            id: string;
            createdAt: Date;
            updatedAt: Date;
            isActive: boolean;
            monthlyCost: import("@prisma/client/runtime/library").Decimal;
            annualCost: import("@prisma/client/runtime/library").Decimal;
            maxOutlets: number;
            maxUsers: number;
            transactionLimit: number | null;
            storageLimit: number | null;
            features: import("@prisma/client/runtime/library").JsonValue;
        };
        invoices: {
            id: string;
            status: string;
            createdAt: Date;
            subscriptionId: string;
            totalAmount: import("@prisma/client/runtime/library").Decimal;
            amount: import("@prisma/client/runtime/library").Decimal;
            gstAmount: import("@prisma/client/runtime/library").Decimal;
            dueDate: Date;
            paidAt: Date | null;
        }[];
    } & {
        id: string;
        status: import(".prisma/client").$Enums.SubscriptionStatus;
        createdAt: Date;
        updatedAt: Date;
        startDate: Date;
        endDate: Date;
        autoRenew: boolean;
        planId: string;
    }) | null | undefined>;
    getInvoices(businessId: string): Promise<{
        id: string;
        status: string;
        createdAt: Date;
        subscriptionId: string;
        totalAmount: import("@prisma/client/runtime/library").Decimal;
        amount: import("@prisma/client/runtime/library").Decimal;
        gstAmount: import("@prisma/client/runtime/library").Decimal;
        dueDate: Date;
        paidAt: Date | null;
    }[]>;
}
