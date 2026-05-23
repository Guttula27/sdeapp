import { OutletsService, CreateOutletDto, CreateSectionDto, CreateTableDto } from './outlets.service';
export declare class OutletsController {
    private service;
    constructor(service: OutletsService);
    create(dto: CreateOutletDto): Promise<{
        admin: {
            name: string;
            phone: string;
            id: string;
        };
        business: {
            name: string;
            description: string | null;
            id: string;
            status: import(".prisma/client").$Enums.UserStatus;
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
            businessType: import(".prisma/client").$Enums.BusinessType;
            subscriptionId: string | null;
        };
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
    }>;
    findByBusiness(businessId: string, lang: string | null): Promise<({
        _count: {
            orders: number;
            tables: number;
        };
    } & {
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
    })[]>;
    publicList(): import(".prisma/client").Prisma.PrismaPromise<{
        business: {
            name: string;
        };
        name: string;
        id: string;
        address: string | null;
        city: string | null;
        logoUrl: string | null;
        primaryImageUrl: string | null;
    }[]>;
    findOne(id: string, lang: string | null): Promise<{
        _count: {
            orders: number;
            tables: number;
        };
        sections: ({
            tables: {
                number: string;
                id: string;
                outletId: string;
                createdAt: Date;
                updatedAt: Date;
                isActive: boolean;
                sectionId: string | null;
                capacity: number;
                tableTypeId: string | null;
            }[];
        } & {
            name: string;
            id: string;
            outletId: string;
            createdAt: Date;
            updatedAt: Date;
            isActive: boolean;
        })[];
        images: {
            id: string;
            outletId: string;
            createdAt: Date;
            displayOrder: number;
            url: string;
        }[];
        hours: {
            id: string;
            outletId: string;
            createdAt: Date;
            updatedAt: Date;
            openTime: string;
            dayOfWeek: number;
            closeTime: string;
        }[];
    } & {
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
    }>;
    dashboard(id: string): Promise<{
        todayOrders: number;
        todayCustomers: number;
        activeOrders: number;
        todayRevenue: number | import("@prisma/client/runtime/library").Decimal;
        avgOrderValue: number | import("@prisma/client/runtime/library").Decimal;
        topItems: (import(".prisma/client").Prisma.PickEnumerable<import(".prisma/client").Prisma.OrderItemGroupByOutputType, "itemId"[]> & {
            _sum: {
                quantity: number | null;
            };
        })[];
        paymentSplit: Record<string, {
            amount: number;
            count: number;
        }>;
    }>;
    update(id: string, dto: Partial<CreateOutletDto>): Promise<{
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
    }>;
    createSection(outletId: string, dto: CreateSectionDto): Promise<{
        name: string;
        id: string;
        outletId: string;
        createdAt: Date;
        updatedAt: Date;
        isActive: boolean;
    }>;
    getSections(outletId: string): Promise<({
        tables: {
            number: string;
            id: string;
            outletId: string;
            createdAt: Date;
            updatedAt: Date;
            isActive: boolean;
            sectionId: string | null;
            capacity: number;
            tableTypeId: string | null;
        }[];
    } & {
        name: string;
        id: string;
        outletId: string;
        createdAt: Date;
        updatedAt: Date;
        isActive: boolean;
    })[]>;
    createTable(outletId: string, dto: CreateTableDto): Promise<{
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
    admin(id: string): Promise<{
        name: string;
        phone: string;
        email: string | null;
        id: string;
    } | null>;
    addImage(id: string, body: {
        url: string;
    }): Promise<{
        id: string;
        outletId: string;
        createdAt: Date;
        displayOrder: number;
        url: string;
    }>;
    removeImage(imageId: string): import(".prisma/client").Prisma.Prisma__OutletImageClient<{
        id: string;
        outletId: string;
        createdAt: Date;
        displayOrder: number;
        url: string;
    }, never, import("@prisma/client/runtime/library").DefaultArgs>;
    openStatus(id: string): Promise<{
        isOpen: boolean;
        isActive: boolean;
        reason: string;
        outletType: import(".prisma/client").$Enums.OutletType;
    } | {
        isOpen: boolean;
        isActive: boolean;
        reason: null;
        outletType: import(".prisma/client").$Enums.OutletType;
    }>;
    getTokenCounter(id: string): Promise<{
        nextOrderSequence: number;
        tokenStartNumber: number;
        nextTokenNumber: number;
    }>;
    setTokenCounter(id: string, body: {
        startNumber?: number;
        currentNumber?: number;
    }): Promise<{
        tokenStartNumber: number;
        nextTokenNumber: number;
    }>;
    resetTokenCounter(id: string): Promise<{
        tokenStartNumber: number;
        nextTokenNumber: number;
    }>;
    getHours(id: string): import(".prisma/client").Prisma.PrismaPromise<{
        id: string;
        outletId: string;
        createdAt: Date;
        updatedAt: Date;
        openTime: string;
        dayOfWeek: number;
        closeTime: string;
    }[]>;
    setHours(id: string, body: {
        ranges: {
            dayOfWeek: number;
            openTime: string;
            closeTime: string;
        }[];
    }): Promise<{
        id: string;
        outletId: string;
        createdAt: Date;
        updatedAt: Date;
        openTime: string;
        dayOfWeek: number;
        closeTime: string;
    }[]>;
}
