import { TableTypesService } from './table-types.service';
export declare class TableTypesController {
    private service;
    constructor(service: TableTypesService);
    list(outletId: string): Promise<{
        disabledMenuIds: string[];
        menus: undefined;
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
        name: string;
        id: string;
        outletId: string;
        createdAt: Date;
        updatedAt: Date;
        color: string;
    }[]>;
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
    remove(id: string): import(".prisma/client").Prisma.Prisma__TableTypeClient<{
        name: string;
        id: string;
        outletId: string;
        createdAt: Date;
        updatedAt: Date;
        color: string;
    }, never, import("@prisma/client/runtime/library").DefaultArgs>;
    setItemPrice(tableTypeId: string, itemId: string, variantId: string | undefined, body: {
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
        tableTypeId: string;
    }>;
    clearItemPrice(tableTypeId: string, itemId: string, variantId: string | undefined): Promise<{
        success: boolean;
    }>;
    addTable(outletId: string, tableTypeId: string, body: {
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
    listMenus(tableTypeId: string): Promise<{
        id: string;
        name: string;
        isDefault: boolean;
        isLocked: boolean;
        isEnabled: boolean;
    }[]>;
    toggleMenu(tableTypeId: string, menuId: string, body: {
        isEnabled: boolean;
    }): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        isEnabled: boolean;
        menuId: string;
        tableTypeId: string;
    }>;
}
