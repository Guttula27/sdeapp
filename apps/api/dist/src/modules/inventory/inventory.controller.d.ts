import { InventoryService } from './inventory.service';
export declare class InventoryController {
    private service;
    constructor(service: InventoryService);
    getMaterials(businessId: string): Promise<({
        category: {
            name: string;
            id: string;
            businessId: string;
            parentId: string | null;
        } | null;
    } & {
        name: string;
        id: string;
        businessId: string;
        createdAt: Date;
        updatedAt: Date;
        categoryId: string | null;
        unit: string;
        currentStock: import("@prisma/client/runtime/library").Decimal;
        reorderLevel: import("@prisma/client/runtime/library").Decimal | null;
        costPerUnit: import("@prisma/client/runtime/library").Decimal | null;
    })[]>;
    createMaterial(businessId: string, body: any): Promise<{
        name: string;
        id: string;
        businessId: string;
        createdAt: Date;
        updatedAt: Date;
        categoryId: string | null;
        unit: string;
        currentStock: import("@prisma/client/runtime/library").Decimal;
        reorderLevel: import("@prisma/client/runtime/library").Decimal | null;
        costPerUnit: import("@prisma/client/runtime/library").Decimal | null;
    }>;
    getLowStock(businessId: string): Promise<{
        name: string;
        id: string;
        businessId: string;
        createdAt: Date;
        updatedAt: Date;
        categoryId: string | null;
        unit: string;
        currentStock: import("@prisma/client/runtime/library").Decimal;
        reorderLevel: import("@prisma/client/runtime/library").Decimal | null;
        costPerUnit: import("@prisma/client/runtime/library").Decimal | null;
    }[]>;
    logConsumption(id: string, body: any): Promise<{
        id: string;
        createdAt: Date;
        quantity: import("@prisma/client/runtime/library").Decimal;
        purpose: string | null;
        issuedBy: string | null;
        materialId: string;
    }>;
    getPOs(businessId: string): Promise<({
        material: {
            name: string;
            id: string;
            businessId: string;
            createdAt: Date;
            updatedAt: Date;
            categoryId: string | null;
            unit: string;
            currentStock: import("@prisma/client/runtime/library").Decimal;
            reorderLevel: import("@prisma/client/runtime/library").Decimal | null;
            costPerUnit: import("@prisma/client/runtime/library").Decimal | null;
        };
        vendor: {
            name: string;
            phone: string | null;
            email: string | null;
            id: string;
            businessId: string;
            createdAt: Date;
            updatedAt: Date;
            address: string | null;
            gstNumber: string | null;
            isActive: boolean;
        };
    } & {
        id: string;
        status: string;
        createdAt: Date;
        updatedAt: Date;
        totalAmount: import("@prisma/client/runtime/library").Decimal;
        quantity: import("@prisma/client/runtime/library").Decimal;
        unitPrice: import("@prisma/client/runtime/library").Decimal;
        materialId: string;
        poNumber: string;
        paymentStatus: string;
        vendorId: string;
    })[]>;
    createPO(body: any): Promise<{
        material: {
            name: string;
            id: string;
            businessId: string;
            createdAt: Date;
            updatedAt: Date;
            categoryId: string | null;
            unit: string;
            currentStock: import("@prisma/client/runtime/library").Decimal;
            reorderLevel: import("@prisma/client/runtime/library").Decimal | null;
            costPerUnit: import("@prisma/client/runtime/library").Decimal | null;
        };
        vendor: {
            name: string;
            phone: string | null;
            email: string | null;
            id: string;
            businessId: string;
            createdAt: Date;
            updatedAt: Date;
            address: string | null;
            gstNumber: string | null;
            isActive: boolean;
        };
    } & {
        id: string;
        status: string;
        createdAt: Date;
        updatedAt: Date;
        totalAmount: import("@prisma/client/runtime/library").Decimal;
        quantity: import("@prisma/client/runtime/library").Decimal;
        unitPrice: import("@prisma/client/runtime/library").Decimal;
        materialId: string;
        poNumber: string;
        paymentStatus: string;
        vendorId: string;
    }>;
    receivePO(id: string): Promise<{
        message: string;
    }>;
}
