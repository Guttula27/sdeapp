import { BusinessesService, CreateBusinessDto } from './businesses.service';
export declare class BusinessesController {
    private service;
    constructor(service: BusinessesService);
    create(dto: CreateBusinessDto): Promise<any>;
    findAll(page?: number, limit?: number, lang?: string | null): Promise<{
        businesses: ({
            subscription: ({
                plan: {
                    name: string;
                    description: string | null;
                    id: string;
                    createdAt: Date;
                    updatedAt: Date;
                    isActive: boolean;
                    monthlyCost: import("@prisma/client/runtime/library").Decimal;
                    annualCost: import("@prisma/client/runtime/library").Decimal;
                    maxOutlets: number;
                    maxUsers: number;
                    transactionLimit: number | null;
                    storageLimit: number | null;
                    features: import("@prisma/client/runtime/library").JsonValue;
                };
            } & {
                id: string;
                status: import(".prisma/client").$Enums.SubscriptionStatus;
                createdAt: Date;
                updatedAt: Date;
                startDate: Date;
                endDate: Date;
                autoRenew: boolean;
                planId: string;
            }) | null;
            _count: {
                outlets: number;
            };
        } & {
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
            businessType: import(".prisma/client").$Enums.BusinessType;
            logoUrl: string | null;
            thumbnailUrl: string | null;
            primaryImageUrl: string | null;
            publicCode: string | null;
            isCluster: boolean;
            multipleMenusEnabled: boolean;
            subscriptionId: string | null;
        })[];
        total: number;
        page: number;
        limit: number;
    }>;
    findOne(id: string, lang: string | null): Promise<{
        subscription: ({
            plan: {
                name: string;
                description: string | null;
                id: string;
                createdAt: Date;
                updatedAt: Date;
                isActive: boolean;
                monthlyCost: import("@prisma/client/runtime/library").Decimal;
                annualCost: import("@prisma/client/runtime/library").Decimal;
                maxOutlets: number;
                maxUsers: number;
                transactionLimit: number | null;
                storageLimit: number | null;
                features: import("@prisma/client/runtime/library").JsonValue;
            };
        } & {
            id: string;
            status: import(".prisma/client").$Enums.SubscriptionStatus;
            createdAt: Date;
            updatedAt: Date;
            startDate: Date;
            endDate: Date;
            autoRenew: boolean;
            planId: string;
        }) | null;
        _count: {
            outlets: number;
            users: number;
        };
        outlets: {
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
        }[];
        images: {
            id: string;
            businessId: string;
            createdAt: Date;
            displayOrder: number;
            url: string;
        }[];
    } & {
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
        businessType: import(".prisma/client").$Enums.BusinessType;
        logoUrl: string | null;
        thumbnailUrl: string | null;
        primaryImageUrl: string | null;
        publicCode: string | null;
        isCluster: boolean;
        multipleMenusEnabled: boolean;
        subscriptionId: string | null;
    }>;
    dashboard(id: string): Promise<{
        activeOutlets: number;
        todayOrders: number;
        todayCustomers: number;
        todayRevenue: number | import("@prisma/client/runtime/library").Decimal;
    }>;
    roles(id: string): Promise<{
        name: string;
        id: string;
        isSystem: boolean;
    }[]>;
    update(id: string, dto: Partial<CreateBusinessDto>): Promise<{
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
        businessType: import(".prisma/client").$Enums.BusinessType;
        logoUrl: string | null;
        thumbnailUrl: string | null;
        primaryImageUrl: string | null;
        publicCode: string | null;
        isCluster: boolean;
        multipleMenusEnabled: boolean;
        subscriptionId: string | null;
    }>;
    toggleStatus(id: string): Promise<{
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
        businessType: import(".prisma/client").$Enums.BusinessType;
        logoUrl: string | null;
        thumbnailUrl: string | null;
        primaryImageUrl: string | null;
        publicCode: string | null;
        isCluster: boolean;
        multipleMenusEnabled: boolean;
        subscriptionId: string | null;
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
        businessId: string;
        createdAt: Date;
        displayOrder: number;
        url: string;
    }>;
    removeImage(imageId: string): import(".prisma/client").Prisma.Prisma__BusinessImageClient<{
        id: string;
        businessId: string;
        createdAt: Date;
        displayOrder: number;
        url: string;
    }, never, import("@prisma/client/runtime/library").DefaultArgs>;
}
