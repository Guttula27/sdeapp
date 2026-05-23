import { PrismaService } from '../../config/prisma/prisma.service';
export declare class QrService {
    private prisma;
    constructor(prisma: PrismaService);
    generateTableQR(tableId: string, outletId: string, customerUrl: string): Promise<{
        url: string;
        type: import(".prisma/client").$Enums.QRType;
        id: string;
        outletId: string | null;
        createdAt: Date;
        updatedAt: Date;
        code: string;
        isActive: boolean;
        tableId: string | null;
        imageUrl: string | null;
    }>;
    generateOutletQR(outletId: string, customerUrl: string): Promise<{
        type: import(".prisma/client").$Enums.QRType;
        id: string;
        outletId: string | null;
        createdAt: Date;
        updatedAt: Date;
        code: string;
        isActive: boolean;
        tableId: string | null;
        imageUrl: string | null;
    }>;
    validateQR(code: string): Promise<({
        outlet: {
            name: string;
            description: string | null;
            phone: string | null;
            id: string;
            businessId: string;
            createdAt: Date;
            updatedAt: Date;
            address: string | null;
            outletType: import(".prisma/client").$Enums.OutletType;
            addressLine1: string | null;
            addressLine2: string | null;
            city: string | null;
            state: string | null;
            pincode: string | null;
            country: string | null;
            mapsLocation: string | null;
            gstNumber: string | null;
            upiId: string | null;
            logoUrl: string | null;
            primaryImageUrl: string | null;
            isActive: boolean;
            defaultPrepTime: number | null;
            parcelChargeEnabled: boolean;
            defaultParcelCharge: import("@prisma/client/runtime/library").Decimal;
            nextOrderSequence: number;
            tokenStartNumber: number;
            nextTokenNumber: number;
            gstApplicable: boolean;
            gstPercent: import("@prisma/client/runtime/library").Decimal;
            priceIncludesGst: boolean;
            facilityId: string | null;
        } | null;
        table: {
            number: string;
            id: string;
            outletId: string;
            createdAt: Date;
            updatedAt: Date;
            isActive: boolean;
            sectionId: string | null;
            capacity: number;
            tableTypeId: string | null;
        } | null;
    } & {
        type: import(".prisma/client").$Enums.QRType;
        id: string;
        outletId: string | null;
        createdAt: Date;
        updatedAt: Date;
        code: string;
        isActive: boolean;
        tableId: string | null;
        imageUrl: string | null;
    }) | null>;
    getOutletQRs(outletId: string): Promise<({
        table: {
            number: string;
            id: string;
            outletId: string;
            createdAt: Date;
            updatedAt: Date;
            isActive: boolean;
            sectionId: string | null;
            capacity: number;
            tableTypeId: string | null;
        } | null;
    } & {
        type: import(".prisma/client").$Enums.QRType;
        id: string;
        outletId: string | null;
        createdAt: Date;
        updatedAt: Date;
        code: string;
        isActive: boolean;
        tableId: string | null;
        imageUrl: string | null;
    })[]>;
}
