import { PrismaService } from '../../config/prisma/prisma.service';
export declare class ReportsService {
    private prisma;
    constructor(prisma: PrismaService);
    getRevenueReport(outletId: string, from: Date, to: Date): Promise<{
        orders: (import(".prisma/client").Prisma.PickEnumerable<import(".prisma/client").Prisma.OrderGroupByOutputType, "createdAt"[]> & {
            _count: {
                id: number;
            };
            _sum: {
                totalAmount: import("@prisma/client/runtime/library").Decimal | null;
            };
        })[];
        summary: {
            totalRevenue: number | import("@prisma/client/runtime/library").Decimal;
            totalTax: number | import("@prisma/client/runtime/library").Decimal;
            totalOrders: number;
            totalOrdersAll: number;
            totalCustomers: number;
            avgOrderValue: number | import("@prisma/client/runtime/library").Decimal;
            paymentSplit: Record<string, {
                amount: number;
                count: number;
            }>;
        };
    }>;
    getItemSalesReport(outletId: string, from: Date, to: Date): Promise<(import(".prisma/client").Prisma.PickEnumerable<import(".prisma/client").Prisma.OrderItemGroupByOutputType, "itemId"[]> & {
        _sum: {
            quantity: number | null;
            totalPrice: import("@prisma/client/runtime/library").Decimal | null;
        };
    })[]>;
    getKitchenReport(outletId: string, from: Date, to: Date): Promise<{
        avgPreparationMinutes: number;
        sampleSize: number;
    }>;
    getHourlyOrders(outletId: string, date: Date): Promise<{
        hour: number;
        orders: number;
        revenue: number;
    }[]>;
    getPlatformSummary(date: Date): Promise<{
        totalBusinesses: number;
        activeBusinesses: number;
        totalOutlets: number;
        todayOrders: number;
        todayCustomers: number;
        todayRevenue: number;
        avgOrderValue: number;
        activeOrders: number;
        topOutlets: {
            outletId: string;
            outletName: string;
            businessName: string;
            revenue: number;
            orders: number;
        }[];
    }>;
    getPlatformHourly(date: Date): Promise<{
        hour: number;
        orders: number;
        revenue: number;
    }[]>;
}
