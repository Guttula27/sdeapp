import { PrismaService } from '../../config/prisma/prisma.service';
export declare class TableTypesService {
    private prisma;
    constructor(prisma: PrismaService);
    private assertOutletAllowsSeating;
    list(outletId: string): import(".prisma/client").Prisma.PrismaPromise<({
        _count: {
            tables: number;
            prices: number;
        };
        tables: ({
            qrCode: {
                type: import(".prisma/client").$Enums.QRType;
                id: string;
                outletId: string | null;
                createdAt: Date;
                updatedAt: Date;
                code: string;
                isActive: boolean;
                tableId: string | null;
                imageUrl: string | null;
            } | null;
        } & {
            number: string;
            id: string;
            outletId: string;
            createdAt: Date;
            updatedAt: Date;
            isActive: boolean;
            sectionId: string | null;
            capacity: number;
            tableTypeId: string | null;
        })[];
    } & {
        name: string;
        id: string;
        outletId: string;
        createdAt: Date;
        updatedAt: Date;
        color: string;
    })[]>;
    addTable(outletId: string, tableTypeId: string, data: {
        number: string;
        capacity?: number;
    }): Promise<{
        qrCode: {
            type: import(".prisma/client").$Enums.QRType;
            id: string;
            outletId: string | null;
            createdAt: Date;
            updatedAt: Date;
            code: string;
            isActive: boolean;
            tableId: string | null;
            imageUrl: string | null;
        } | null;
    } & {
        number: string;
        id: string;
        outletId: string;
        createdAt: Date;
        updatedAt: Date;
        isActive: boolean;
        sectionId: string | null;
        capacity: number;
        tableTypeId: string | null;
    }>;
    removeTable(tableId: string): Promise<{
        number: string;
        id: string;
        outletId: string;
        createdAt: Date;
        updatedAt: Date;
        isActive: boolean;
        sectionId: string | null;
        capacity: number;
        tableTypeId: string | null;
    }>;
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
    remove(id: string): import(".prisma/client").Prisma.Prisma__TableTypeClient<{
        name: string;
        id: string;
        outletId: string;
        createdAt: Date;
        updatedAt: Date;
        color: string;
    }, never, import("@prisma/client/runtime/library").DefaultArgs>;
    setItemPrice(tableTypeId: string, itemId: string, price: number, variantId?: string, gstRate?: number | null): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        gstRate: import("@prisma/client/runtime/library").Decimal | null;
        price: import("@prisma/client/runtime/library").Decimal;
        itemId: string;
        variantId: string | null;
        tableTypeId: string;
    }>;
    clearItemPrice(tableTypeId: string, itemId: string, variantId?: string): Promise<{
        success: boolean;
    }>;
}
