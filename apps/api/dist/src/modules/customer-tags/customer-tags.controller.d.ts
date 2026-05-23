import { CustomerTagsService } from './customer-tags.service';
export declare class CustomerTagsController {
    private service;
    constructor(service: CustomerTagsService);
    list(outletId: string, lang: string | null): Promise<({
        _count: {
            itemPrices: number;
            assignments: number;
        };
    } & {
        name: string;
        id: string;
        outletId: string;
        createdAt: Date;
        updatedAt: Date;
        color: string;
    })[]>;
    create(outletId: string, body: {
        name: string;
        color?: string;
    }): Promise<{
        name: string;
        id: string;
        outletId: string;
        createdAt: Date;
        updatedAt: Date;
        color: string;
    }>;
    update(id: string, body: {
        name?: string;
        color?: string;
    }): Promise<{
        name: string;
        id: string;
        outletId: string;
        createdAt: Date;
        updatedAt: Date;
        color: string;
    }>;
    remove(id: string): Promise<{
        name: string;
        id: string;
        outletId: string;
        createdAt: Date;
        updatedAt: Date;
        color: string;
    }>;
    setItemPrice(tagId: string, itemId: string, variantId: string | undefined, body: {
        price: number;
        gstRate?: number | null;
    }): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        gstRate: import("@prisma/client/runtime/library").Decimal | null;
        price: import("@prisma/client/runtime/library").Decimal;
        itemId: string;
        variantId: string | null;
        customerTagId: string;
    }>;
    clearItemPrice(tagId: string, itemId: string, variantId: string | undefined): Promise<{
        success: boolean;
    }>;
}
