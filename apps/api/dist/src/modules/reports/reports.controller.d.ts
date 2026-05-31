import { ReportsService } from './reports.service';
export declare class ReportsController {
    private service;
    constructor(service: ReportsService);
    revenue(outletId: string, from?: string, to?: string): Promise<{
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
    itemSales(outletId: string, from?: string, to?: string): Promise<(import(".prisma/client").Prisma.PickEnumerable<import(".prisma/client").Prisma.OrderItemGroupByOutputType, "itemId"[]> & {
        _sum: {
            quantity: number | null;
            totalPrice: import("@prisma/client/runtime/library").Decimal | null;
        };
    })[]>;
    kitchen(outletId: string, from?: string, to?: string): Promise<{
        avgPreparationMinutes: number;
        sampleSize: number;
    }>;
    hourly(outletId: string, date?: string): Promise<{
        hour: number;
        orders: number;
        revenue: number;
    }[]>;
    platformSummary(user: any, date?: string): Promise<{
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
    platformHourly(user: any, date?: string): Promise<{
        hour: number;
        orders: number;
        revenue: number;
    }[]>;
}
