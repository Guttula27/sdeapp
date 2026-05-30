import { PrismaService } from '../../config/prisma/prisma.service';
import { TranslationsService } from '../translations/translations.service';
export type DisputeStatus = 'OPEN' | 'REVIEWING' | 'RESOLVED' | 'CLOSED';
export declare class DisputesService {
    private prisma;
    private translations;
    constructor(prisma: PrismaService, translations: TranslationsService);
    create(orderId: string, customerId: string | null, data: {
        description: string;
        claimAmount?: number;
    }): Promise<{
        order: {
            outletId: string;
            orderNumber: string;
            totalAmount: import("@prisma/client/runtime/library").Decimal;
        };
    } & {
        description: string;
        id: string;
        status: string;
        createdAt: Date;
        updatedAt: Date;
        orderId: string;
        claimAmount: import("@prisma/client/runtime/library").Decimal | null;
        resolution: string | null;
        attachments: import("@prisma/client/runtime/library").JsonValue;
    }>;
    findByCustomer(customerId: string, lang?: string | null): Promise<({
        order: {
            outlet: {
                name: string;
                id: string;
            };
            items: ({
                item: {
                    name: string;
                    id: string;
                };
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
            id: string;
            createdAt: Date;
            orderNumber: string;
            totalAmount: import("@prisma/client/runtime/library").Decimal;
        };
    } & {
        description: string;
        id: string;
        status: string;
        createdAt: Date;
        updatedAt: Date;
        orderId: string;
        claimAmount: import("@prisma/client/runtime/library").Decimal | null;
        resolution: string | null;
        attachments: import("@prisma/client/runtime/library").JsonValue;
    })[]>;
    findOne(id: string, lang?: string | null): Promise<{
        order: {
            outlet: {
                name: string;
                id: string;
            };
            items: ({
                item: {
                    name: string;
                    id: string;
                };
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
            customer: {
                name: string;
                phone: string;
                id: string;
            } | null;
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
        };
    } & {
        description: string;
        id: string;
        status: string;
        createdAt: Date;
        updatedAt: Date;
        orderId: string;
        claimAmount: import("@prisma/client/runtime/library").Decimal | null;
        resolution: string | null;
        attachments: import("@prisma/client/runtime/library").JsonValue;
    }>;
    findByOutlet(outletId: string, status?: DisputeStatus, lang?: string | null): Promise<{
        disputes: ({
            order: {
                items: ({
                    item: {
                        name: string;
                        id: string;
                    };
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
                id: string;
                createdAt: Date;
                orderNumber: string;
                totalAmount: import("@prisma/client/runtime/library").Decimal;
                customer: {
                    name: string;
                    phone: string;
                    id: string;
                } | null;
            };
        } & {
            description: string;
            id: string;
            status: string;
            createdAt: Date;
            updatedAt: Date;
            orderId: string;
            claimAmount: import("@prisma/client/runtime/library").Decimal | null;
            resolution: string | null;
            attachments: import("@prisma/client/runtime/library").JsonValue;
        })[];
        total: number;
        stats: (import(".prisma/client").Prisma.PickEnumerable<import(".prisma/client").Prisma.DisputeGroupByOutputType, "status"[]> & {
            _count: {
                id: number;
            };
        })[];
    }>;
    update(id: string, data: {
        status: DisputeStatus;
        resolution?: string;
        refundRequested?: boolean;
    }): Promise<{
        order: {
            id: string;
            outletId: string;
            orderNumber: string;
        };
    } & {
        description: string;
        id: string;
        status: string;
        createdAt: Date;
        updatedAt: Date;
        orderId: string;
        claimAmount: import("@prisma/client/runtime/library").Decimal | null;
        resolution: string | null;
        attachments: import("@prisma/client/runtime/library").JsonValue;
    }>;
    getStats(outletId: string): Promise<{
        open: number;
        reviewing: number;
        resolved: number;
        closed: number;
        total: number;
        pendingClaimAmount: number | import("@prisma/client/runtime/library").Decimal;
    }>;
}
