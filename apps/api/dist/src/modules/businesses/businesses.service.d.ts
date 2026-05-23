import { PrismaService } from '../../config/prisma/prisma.service';
import { BusinessType } from '@prisma/client';
import { TranslationsService } from '../translations/translations.service';
export declare class CreateBusinessDto {
    name: string;
    description?: string;
    address?: string;
    addressLine1?: string;
    addressLine2?: string;
    city?: string;
    state?: string;
    pincode?: string;
    country?: string;
    mapsLocation?: string;
    gstNumber?: string;
    upiId?: string;
    businessType: BusinessType;
    logoUrl?: string;
    primaryImageUrl?: string;
    adminPhone?: string;
    adminName?: string;
}
export declare class BusinessesService {
    private prisma;
    private translations;
    constructor(prisma: PrismaService, translations: TranslationsService);
    private translatableBusinessFields;
    create(data: CreateBusinessDto): Promise<{
        admin: {
            name: string;
            phone: string;
            id: string;
        };
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
    }>;
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
            logoUrl: string | null;
            primaryImageUrl: string | null;
            businessType: import(".prisma/client").$Enums.BusinessType;
            subscriptionId: string | null;
        })[];
        total: number;
        page: number;
        limit: number;
    }>;
    findOne(id: string, lang?: string | null): Promise<{
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
            users: number;
            outlets: number;
        };
        images: {
            id: string;
            businessId: string;
            createdAt: Date;
            displayOrder: number;
            url: string;
        }[];
        outlets: {
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
        logoUrl: string | null;
        primaryImageUrl: string | null;
        businessType: import(".prisma/client").$Enums.BusinessType;
        subscriptionId: string | null;
    }>;
    findAdmin(businessId: string): Promise<{
        name: string;
        phone: string;
        email: string | null;
        id: string;
    } | null>;
    addImage(businessId: string, url: string): Promise<{
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
    update(id: string, data: Partial<CreateBusinessDto>): Promise<{
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
        logoUrl: string | null;
        primaryImageUrl: string | null;
        businessType: import(".prisma/client").$Enums.BusinessType;
        subscriptionId: string | null;
    }>;
    getRoles(businessId: string): Promise<{
        name: string;
        id: string;
        isSystem: boolean;
    }[]>;
    getDashboard(id: string): Promise<{
        activeOutlets: number;
        todayOrders: number;
        todayCustomers: number;
        todayRevenue: number | import("@prisma/client/runtime/library").Decimal;
    }>;
}
