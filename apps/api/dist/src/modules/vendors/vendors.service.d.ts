import { PrismaService } from '../../config/prisma/prisma.service';
export declare class VendorsService {
    private prisma;
    constructor(prisma: PrismaService);
    findAll(businessId: string, search?: string): Promise<{
        vendors: ({
            _count: {
                purchaseOrders: number;
            };
        } & {
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
        })[];
        total: number;
    }>;
    findOne(id: string): Promise<{
        _count: {
            purchaseOrders: number;
        };
        purchaseOrders: ({
            material: {
                name: string;
                id: string;
                unit: string;
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
        })[];
    } & {
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
    }>;
    create(businessId: string, data: {
        name: string;
        gstNumber?: string;
        phone?: string;
        email?: string;
        address?: string;
    }): Promise<{
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
    }>;
    update(id: string, data: {
        name?: string;
        gstNumber?: string;
        phone?: string;
        email?: string;
        address?: string;
    }): Promise<{
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
    }>;
    toggleStatus(id: string): Promise<{
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
    }>;
    remove(id: string): Promise<{
        message: string;
    }>;
    getStats(businessId: string): Promise<{
        totalVendors: number;
        activeVendors: number;
        totalPOs: number;
        totalSpend: number | import("@prisma/client/runtime/library").Decimal;
        topVendors: (import(".prisma/client").Prisma.PickEnumerable<import(".prisma/client").Prisma.PurchaseOrderGroupByOutputType, "vendorId"[]> & {
            _count: {
                id: number;
            };
            _sum: {
                totalAmount: import("@prisma/client/runtime/library").Decimal | null;
            };
        })[];
    }>;
}
