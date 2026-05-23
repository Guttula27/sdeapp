import { OrderStatus } from '@prisma/client';
import { OrdersService } from './orders.service';
export declare class OrdersBrowseController {
    private ordersService;
    constructor(ordersService: OrdersService);
    findAll(lang: string | null, businessId?: string, outletId?: string, status?: OrderStatus, page?: number, limit?: number): Promise<{
        orders: ({
            outlet: {
                business: {
                    name: string;
                    id: string;
                };
                name: string;
                id: string;
                outletType: import(".prisma/client").$Enums.OutletType;
            };
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
                    shortDescription: string | null;
                    longDescription: string | null;
                    thumbnailUrl: string | null;
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
            })[];
            customer: {
                name: string;
                phone: string;
                id: string;
                customerTagAssignments: ({
                    customerTag: {
                        name: string;
                        id: string;
                        outletId: string;
                        createdAt: Date;
                        updatedAt: Date;
                        color: string;
                    };
                } & {
                    id: string;
                    outletId: string;
                    createdAt: Date;
                    updatedAt: Date;
                    userId: string;
                    customerTagId: string;
                })[];
            } | null;
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
        })[];
        total: number;
        page: number;
        limit: number;
    }>;
    findOne(id: string, lang: string | null): Promise<{
        outlet: {
            name: string;
            phone: string | null;
            id: string;
            address: string | null;
            outletType: import(".prisma/client").$Enums.OutletType;
            gstNumber: string | null;
            upiId: string | null;
            logoUrl: string | null;
        };
        section: {
            name: string;
            id: string;
            outletId: string;
            createdAt: Date;
            updatedAt: Date;
            isActive: boolean;
        } | null;
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
                shortDescription: string | null;
                longDescription: string | null;
                thumbnailUrl: string | null;
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
            review: ({
                replyBy: {
                    name: string;
                    id: string;
                } | null;
                paybackPayment: {
                    id: string;
                    status: import(".prisma/client").$Enums.PaymentStatus;
                    createdAt: Date;
                    amount: import("@prisma/client/runtime/library").Decimal;
                    mode: import(".prisma/client").$Enums.PaymentMode;
                } | null;
            } & {
                id: string;
                createdAt: Date;
                updatedAt: Date;
                customerId: string;
                itemId: string;
                orderItemId: string;
                rating: number;
                comment: string | null;
                replyText: string | null;
                replyByUserId: string | null;
                repliedAt: Date | null;
                paybackAmount: import("@prisma/client/runtime/library").Decimal | null;
                paybackPaymentId: string | null;
            }) | null;
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
        })[];
        customer: {
            name: string;
            phone: string;
            id: string;
            customerTagAssignments: ({
                customerTag: {
                    name: string;
                    id: string;
                    outletId: string;
                    createdAt: Date;
                    updatedAt: Date;
                    color: string;
                };
            } & {
                id: string;
                outletId: string;
                createdAt: Date;
                updatedAt: Date;
                userId: string;
                customerTagId: string;
            })[];
        } | null;
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
        statusHistory: {
            id: string;
            status: import(".prisma/client").$Enums.OrderStatus;
            createdAt: Date;
            notes: string | null;
            orderId: string;
            changedBy: string | null;
        }[];
        disputes: {
            description: string;
            id: string;
            status: string;
            createdAt: Date;
            updatedAt: Date;
            orderId: string;
            claimAmount: import("@prisma/client/runtime/library").Decimal | null;
            resolution: string | null;
            attachments: import("@prisma/client/runtime/library").JsonValue;
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
    }>;
}
