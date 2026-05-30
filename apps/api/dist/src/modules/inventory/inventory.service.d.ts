import { PrismaService } from '../../config/prisma/prisma.service';
export declare class InventoryService {
    private prisma;
    constructor(prisma: PrismaService);
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
    createMaterial(businessId: string, data: any): Promise<{
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
    updateStock(materialId: string, quantity: number, operation: 'ADD' | 'SUBTRACT'): Promise<{
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
    logConsumption(materialId: string, data: {
        quantity: number;
        purpose?: string;
        issuedBy?: string;
    }): Promise<{
        id: string;
        createdAt: Date;
        quantity: import("@prisma/client/runtime/library").Decimal;
        purpose: string | null;
        issuedBy: string | null;
        materialId: string;
    }>;
    getLowStockAlerts(businessId: string): Promise<{
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
    getPurchaseOrders(businessId: string): Promise<({
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
        paymentStatus: string;
        quantity: import("@prisma/client/runtime/library").Decimal;
        unitPrice: import("@prisma/client/runtime/library").Decimal;
        materialId: string;
        poNumber: string;
        vendorId: string;
    })[]>;
    createPurchaseOrder(data: {
        vendorId: string;
        materialId: string;
        quantity: number;
        unitPrice: number;
    }): Promise<{
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
        paymentStatus: string;
        quantity: import("@prisma/client/runtime/library").Decimal;
        unitPrice: import("@prisma/client/runtime/library").Decimal;
        materialId: string;
        poNumber: string;
        vendorId: string;
    }>;
    receivePurchaseOrder(poId: string): Promise<{
        message: string;
    }>;
}
