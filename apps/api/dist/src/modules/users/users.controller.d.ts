import { UsersService } from './users.service';
import { StaffPermissionsService, SetOverridesDto } from './staff-permissions.service';
export declare class UsersController {
    private service;
    private staffPermissions;
    constructor(service: UsersService, staffPermissions: StaffPermissionsService);
    create(body: any): Promise<{
        role: {
            name: string;
            id: string;
        } | null;
        name: string;
        phone: string;
        email: string | null;
        id: string;
        status: import(".prisma/client").$Enums.UserStatus;
    }>;
    findAll(businessId?: string, outletId?: string, page?: number, limit?: number): Promise<{
        users: {
            role: {
                name: string;
                id: string;
            } | null;
            outlet: {
                name: string;
                id: string;
            } | null;
            name: string;
            phone: string;
            email: string | null;
            id: string;
            status: import(".prisma/client").$Enums.UserStatus;
            createdAt: Date;
        }[];
        total: number;
        page: number;
        limit: number;
    }>;
    getMe(user: any): any;
    getMyOrders(userId: string, lang: string | null, page?: number, limit?: number): Promise<{
        orders: ({
            outlet: {
                name: string;
                id: string;
                logoUrl: string | null;
            };
            items: ({
                item: {
                    name: string;
                    id: string;
                    imageUrl: string | null;
                };
                variant: {
                    name: string;
                    id: string;
                } | null;
                review: {
                    id: string;
                    rating: number;
                } | null;
            } & {
                id: string;
                status: import(".prisma/client").$Enums.OrderItemStatus;
                createdAt: Date;
                updatedAt: Date;
                notes: string | null;
                gstRate: import("@prisma/client/runtime/library").Decimal;
                itemId: string;
                orderId: string;
                quantity: number;
                unitPrice: import("@prisma/client/runtime/library").Decimal;
                totalPrice: import("@prisma/client/runtime/library").Decimal;
                gstAmount: import("@prisma/client/runtime/library").Decimal;
                variantId: string | null;
            })[];
            payments: {
                id: string;
                status: import(".prisma/client").$Enums.PaymentStatus;
                amount: import("@prisma/client/runtime/library").Decimal;
                mode: import(".prisma/client").$Enums.PaymentMode;
            }[];
        } & {
            id: string;
            status: import(".prisma/client").$Enums.OrderStatus;
            outletId: string;
            createdAt: Date;
            updatedAt: Date;
            orderNumber: string;
            tokenNumber: number | null;
            isParcel: boolean;
            isPostpaid: boolean;
            billRequestedAt: Date | null;
            notes: string | null;
            subtotal: import("@prisma/client/runtime/library").Decimal;
            taxAmount: import("@prisma/client/runtime/library").Decimal;
            sgstAmount: import("@prisma/client/runtime/library").Decimal;
            cgstAmount: import("@prisma/client/runtime/library").Decimal;
            parcelAmount: import("@prisma/client/runtime/library").Decimal;
            discountAmount: import("@prisma/client/runtime/library").Decimal;
            totalAmount: import("@prisma/client/runtime/library").Decimal;
            sectionId: string | null;
            tableId: string | null;
            customerId: string | null;
            staffId: string | null;
        })[];
        total: number;
        page: number;
        limit: number;
        stats: {
            totalOrders: number;
            completedOrders: number;
            totalSpent: number | import("@prisma/client/runtime/library").Decimal;
        };
    }>;
    getMyStats(userId: string, lang: string | null, from?: string, to?: string): Promise<{
        range: {
            from: string;
            to: string;
        };
        totalOrders: number;
        totalValue: number;
        daily: {
            date: string;
            orders: number;
            value: number;
        }[];
        hourly: {
            hour: number;
            orders: number;
            value: number;
        }[];
        orders: {
            outlet: {
                name: string;
                id: string;
                logoUrl: string | null;
            };
            items: {
                item: {
                    name: string;
                    id: string;
                };
                quantity: number;
            }[];
            id: string;
            status: import(".prisma/client").$Enums.OrderStatus;
            outletId: string;
            createdAt: Date;
            orderNumber: string;
            tokenNumber: number | null;
            totalAmount: import("@prisma/client/runtime/library").Decimal;
        }[];
    }>;
    listFavorites(userId: string, lang: string | null): Promise<({
        item: {
            subcategory: {
                category: {
                    outlet: {
                        name: string;
                        id: string;
                    } | null;
                } & {
                    name: string;
                    id: string;
                    businessId: string | null;
                    outletId: string | null;
                    createdAt: Date;
                    updatedAt: Date;
                    isActive: boolean;
                    imageUrl: string | null;
                    displayOrder: number;
                };
            } & {
                name: string;
                id: string;
                createdAt: Date;
                updatedAt: Date;
                isActive: boolean;
                imageUrl: string | null;
                displayOrder: number;
                categoryId: string;
            };
            variants: {
                name: string;
                id: string;
                createdAt: Date;
                updatedAt: Date;
                shortDescription: string | null;
                isAvailable: boolean;
                price: import("@prisma/client/runtime/library").Decimal;
                itemId: string;
            }[];
        } & {
            name: string;
            description: string | null;
            id: string;
            createdAt: Date;
            updatedAt: Date;
            shortDescription: string | null;
            longDescription: string | null;
            thumbnailUrl: string | null;
            imageUrl: string | null;
            basePrice: import("@prisma/client/runtime/library").Decimal;
            gstRate: import("@prisma/client/runtime/library").Decimal | null;
            parcelAvailable: boolean;
            useCustomParcelCharge: boolean;
            parcelCharge: import("@prisma/client/runtime/library").Decimal | null;
            preparationTime: number | null;
            foodGrade: import(".prisma/client").$Enums.FoodGrade;
            isAvailable: boolean;
            isDisplayed: boolean;
            isPopular: boolean;
            isSpecial: boolean;
            hasLimitedStock: boolean;
            availableQuantity: number;
            displayOrder: number;
            subcategoryId: string;
            kitchenStationId: string | null;
        };
    } & {
        id: string;
        createdAt: Date;
        userId: string;
        itemId: string;
    })[]>;
    addFavorite(userId: string, itemId: string): Promise<{
        id: string;
        createdAt: Date;
        userId: string;
        itemId: string;
    }>;
    removeFavorite(userId: string, itemId: string): Promise<{
        success: boolean;
    }>;
    findOne(id: string): Promise<{
        role: ({
            responsibilities: ({
                responsibility: {
                    name: string;
                    description: string | null;
                    id: string;
                    module: string;
                };
            } & {
                roleId: string;
                responsibilityId: string;
            })[];
        } & {
            name: string;
            description: string | null;
            id: string;
            businessId: string | null;
            outletId: string | null;
            createdAt: Date;
            updatedAt: Date;
            isSystem: boolean;
            isTemplate: boolean;
        }) | null;
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
        } | null;
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
        name: string;
        phone: string;
        email: string | null;
        id: string;
        status: import(".prisma/client").$Enums.UserStatus;
        createdAt: Date;
        updatedAt: Date;
    }>;
    update(id: string, body: any): Promise<{
        message: string;
    }> | Promise<{
        name: string;
        phone: string;
        email: string | null;
        id: string;
        status: import(".prisma/client").$Enums.UserStatus;
        preferredUpiApp: string | null;
        profileImageUrl: string | null;
        alertRingtone: string | null;
        alertVolume: number | null;
        updatedAt: Date;
    }>;
    toggleStatus(id: string): Promise<{
        name: string;
        phone: string;
        email: string | null;
        id: string;
        passwordHash: string | null;
        status: import(".prisma/client").$Enums.UserStatus;
        avatarUrl: string | null;
        roleId: string | null;
        businessId: string | null;
        outletId: string | null;
        preferredUpiApp: string | null;
        profileImageUrl: string | null;
        alertRingtone: string | null;
        alertVolume: number | null;
        mustChangePassword: boolean;
        preferredLanguage: string | null;
        createdAt: Date;
        updatedAt: Date;
    }>;
    setMyLanguage(userId: string, body: {
        preferredLanguage: string;
    }): Promise<{
        id: string;
        preferredLanguage: string | null;
    }>;
    getPermissions(actor: any, id: string): Promise<{
        userId: string;
        userName: string;
        role: {
            id: string;
            name: string;
            isSystem: boolean;
        } | null;
        effective: string[];
        permissions: {
            id: string;
            name: string;
            module: string;
            description: string | null;
            inRole: boolean;
            granted: boolean;
            revoked: boolean;
            effective: boolean;
            grantable: boolean;
        }[];
    }>;
    setPermissions(actor: any, id: string, dto: SetOverridesDto): Promise<{
        userId: string;
        userName: string;
        role: {
            id: string;
            name: string;
            isSystem: boolean;
        } | null;
        effective: string[];
        permissions: {
            id: string;
            name: string;
            module: string;
            description: string | null;
            inRole: boolean;
            granted: boolean;
            revoked: boolean;
            effective: boolean;
            grantable: boolean;
        }[];
    }>;
}
