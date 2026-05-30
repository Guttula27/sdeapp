import { QrService } from './qr.service';
export declare class QrController {
    private service;
    constructor(service: QrService);
    generateOutlet(outletId: string): Promise<{
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
    generateTable(tableId: string, outletId: string): Promise<{
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
    validate(code: string): Promise<({
        outlet: {
            name: string;
            description: string | null;
            phone: string | null;
            id: string;
            businessId: string;
            createdAt: Date;
            updatedAt: Date;
            address: string | null;
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
            publicCode: string | null;
            multipleMenusEnabled: boolean;
            outletType: import(".prisma/client").$Enums.OutletType;
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
            razorpayLinkedAccountId: string | null;
            facilityId: string | null;
            acceptRewardRedemption: boolean;
            kitchenAutoPrint: boolean;
            kitchenAllowManualPrint: boolean;
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
