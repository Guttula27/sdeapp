import { CustomersService } from './customers.service';
export declare class CustomersController {
    private service;
    constructor(service: CustomersService);
    list(outletId: string): Promise<{
        id: string;
        name: string;
        phone: string;
        email: string | null;
        orderCount: number;
        totalSpend: number;
        lastOrderAt: Date | null;
        tag: {
            name: string;
            id: string;
            outletId: string;
            createdAt: Date;
            updatedAt: Date;
            color: string;
        } | null;
    }[]>;
    listOrders(outletId: string, userId: string): Promise<({
        table: {
            number: string;
            id: string;
            outletId: string;
            createdAt: Date;
            updatedAt: Date;
            isActive: boolean;
            sectionId: string | null;
            capacity: number;
            tableTypeId: string | null;
        } | null;
        items: ({
            item: {
                name: string;
                description: string | null;
                id: string;
                createdAt: Date;
                updatedAt: Date;
                thumbnailUrl: string | null;
                shortDescription: string | null;
                longDescription: string | null;
                imageUrl: string | null;
                basePrice: import("@prisma/client/runtime/library").Decimal;
                gstRate: import("@prisma/client/runtime/library").Decimal | null;
                parcelAvailable: boolean;
                useCustomParcelCharge: boolean;
                parcelCharge: import("@prisma/client/runtime/library").Decimal | null;
                preparationTime: number | null;
                foodGrade: import(".prisma/client").$Enums.FoodGrade;
                isAvailable: boolean;
                isDisplayed: boolean;
                isPopular: boolean;
                isSpecial: boolean;
                hasLimitedStock: boolean;
                availableQuantity: number;
                displayOrder: number;
                subcategoryId: string;
                kitchenStationId: string | null;
                isBundle: boolean;
                maxBundleSelections: number | null;
            };
            variant: {
                name: string;
                id: string;
                createdAt: Date;
                updatedAt: Date;
                shortDescription: string | null;
                isAvailable: boolean;
                price: import("@prisma/client/runtime/library").Decimal;
                itemId: string;
            } | null;
        } & {
            id: string;
            status: import(".prisma/client").$Enums.OrderItemStatus;
            createdAt: Date;
            updatedAt: Date;
            notes: string | null;
            gstRate: import("@prisma/client/runtime/library").Decimal;
            itemId: string;
            orderId: string;
            quantity: number;
            unitPrice: import("@prisma/client/runtime/library").Decimal;
            totalPrice: import("@prisma/client/runtime/library").Decimal;
            gstAmount: import("@prisma/client/runtime/library").Decimal;
            variantId: string | null;
            menuId: string | null;
            bundleId: string | null;
            sequenceNumber: number | null;
        })[];
        payments: {
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
        }[];
    } & {
        id: string;
        status: import(".prisma/client").$Enums.OrderStatus;
        outletId: string;
        createdAt: Date;
        updatedAt: Date;
        orderNumber: string;
        tokenNumber: number | null;
        isParcel: boolean;
        isPostpaid: boolean;
        billRequestedAt: Date | null;
        notes: string | null;
        subtotal: import("@prisma/client/runtime/library").Decimal;
        taxAmount: import("@prisma/client/runtime/library").Decimal;
        sgstAmount: import("@prisma/client/runtime/library").Decimal;
        cgstAmount: import("@prisma/client/runtime/library").Decimal;
        parcelAmount: import("@prisma/client/runtime/library").Decimal;
        discountAmount: import("@prisma/client/runtime/library").Decimal;
        totalAmount: import("@prisma/client/runtime/library").Decimal;
        sectionId: string | null;
        tableId: string | null;
        customerId: string | null;
        staffId: string | null;
        clusterOrderId: string | null;
        activeSequence: number;
        sequenceLabels: import("@prisma/client/runtime/library").JsonValue | null;
    })[]>;
    add(outletId: string, body: {
        name?: string;
        phone: string;
    }): Promise<{
        name: string;
        phone: string;
        email: string | null;
        id: string;
    }>;
    setTag(outletId: string, userId: string, body: {
        tagId: string | null;
    }): Promise<{
        success: boolean;
        tag: null;
    } | {
        success: boolean;
        tag: {
            name: string;
            id: string;
            outletId: string;
            createdAt: Date;
            updatedAt: Date;
            color: string;
        };
    }>;
}
