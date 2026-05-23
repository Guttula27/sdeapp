import { PrismaService } from '../../config/prisma/prisma.service';
import { TranslationsService } from '../translations/translations.service';
export declare class CustomerTagsService {
    private prisma;
    private translations;
    constructor(prisma: PrismaService, translations: TranslationsService);
    list(outletId: string, lang?: string | null): Promise<({
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
    create(outletId: string, data: {
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
    update(id: string, data: {
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
    setItemPrice(tagId: string, itemId: string, price: number, variantId?: string, gstRate?: number | null): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        gstRate: import("@prisma/client/runtime/library").Decimal | null;
        price: import("@prisma/client/runtime/library").Decimal;
        itemId: string;
        variantId: string | null;
        customerTagId: string;
    }>;
    clearItemPrice(tagId: string, itemId: string, variantId?: string): Promise<{
        success: boolean;
    }>;
}
