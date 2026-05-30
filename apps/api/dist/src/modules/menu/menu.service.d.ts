import { PrismaService } from '../../config/prisma/prisma.service';
import { TranslationsService } from '../translations/translations.service';
export declare class MenuService {
    private prisma;
    private translations;
    constructor(prisma: PrismaService, translations: TranslationsService);
    private hydrateMenu;
    getMenu(outletId: string, viewerUserId?: string, tableId?: string, lang?: string | null, opts?: {
        includeHidden?: boolean;
    }): Promise<{
        subcategories: {
            items: {
                variants: any[];
                effectivePrice: number;
                appliedTagId: string | null;
                appliedTableTypeId: string | null;
                isPopular: boolean;
                isFavorite: boolean;
                ratingAvg: number;
                ratingCount: number;
                images: {
                    id: string;
                    displayOrder: number;
                    createdAt: Date;
                    itemId: string;
                    url: string;
                }[];
                options: {
                    id: string;
                    name: string;
                    createdAt: Date;
                    updatedAt: Date;
                    price: import("@prisma/client/runtime/library").Decimal;
                    itemId: string;
                }[];
                tags: {
                    id: string;
                    name: string;
                    itemId: string;
                }[];
                customerTagPrices: ({
                    customerTag: {
                        id: string;
                        name: string;
                        outletId: string;
                        createdAt: Date;
                        updatedAt: Date;
                        color: string;
                    };
                } & {
                    id: string;
                    createdAt: Date;
                    updatedAt: Date;
                    gstRate: import("@prisma/client/runtime/library").Decimal | null;
                    price: import("@prisma/client/runtime/library").Decimal;
                    itemId: string;
                    customerTagId: string;
                    variantId: string | null;
                })[];
                tableTypePrices: ({
                    tableType: {
                        id: string;
                        name: string;
                        outletId: string;
                        createdAt: Date;
                        updatedAt: Date;
                        color: string;
                    };
                } & {
                    id: string;
                    createdAt: Date;
                    updatedAt: Date;
                    gstRate: import("@prisma/client/runtime/library").Decimal | null;
                    price: import("@prisma/client/runtime/library").Decimal;
                    itemId: string;
                    tableTypeId: string;
                    variantId: string | null;
                })[];
                itemToppings: ({
                    topping: {
                        options: {
                            id: string;
                            name: string;
                            displayOrder: number;
                            createdAt: Date;
                            updatedAt: Date;
                            toppingId: string;
                            priceAdd: import("@prisma/client/runtime/library").Decimal;
                        }[];
                    } & {
                        id: string;
                        name: string;
                        outletId: string;
                        createdAt: Date;
                        updatedAt: Date;
                        basePriceAdd: import("@prisma/client/runtime/library").Decimal;
                    };
                } & {
                    id: string;
                    createdAt: Date;
                    itemId: string;
                    toppingId: string;
                    priceAdd: import("@prisma/client/runtime/library").Decimal | null;
                    isRequired: boolean;
                })[];
                bundleChildren: ({
                    variant: {
                        id: string;
                        name: string;
                    } | null;
                    childItem: {
                        id: string;
                        name: string;
                    };
                } & {
                    id: string;
                    displayOrder: number;
                    createdAt: Date;
                    quantity: number;
                    variantId: string | null;
                    parentItemId: string;
                    childItemId: string;
                })[];
                id: string;
                name: string;
                imageUrl: string | null;
                displayOrder: number;
                createdAt: Date;
                updatedAt: Date;
                description: string | null;
                isDisplayed: boolean;
                shortDescription: string | null;
                longDescription: string | null;
                thumbnailUrl: string | null;
                basePrice: import("@prisma/client/runtime/library").Decimal;
                gstRate: import("@prisma/client/runtime/library").Decimal | null;
                parcelAvailable: boolean;
                useCustomParcelCharge: boolean;
                parcelCharge: import("@prisma/client/runtime/library").Decimal | null;
                preparationTime: number | null;
                foodGrade: import(".prisma/client").$Enums.FoodGrade;
                isAvailable: boolean;
                isSpecial: boolean;
                hasLimitedStock: boolean;
                availableQuantity: number;
                subcategoryId: string;
                kitchenStationId: string | null;
                isBundle: boolean;
                maxBundleSelections: number | null;
            }[];
            id: string;
            name: string;
            imageUrl: string | null;
            displayOrder: number;
            isActive: boolean;
            createdAt: Date;
            updatedAt: Date;
            categoryId: string;
        }[];
        id: string;
        name: string;
        imageUrl: string | null;
        displayOrder: number;
        isActive: boolean;
        outletId: string | null;
        businessId: string | null;
        menuId: string | null;
        createdAt: Date;
        updatedAt: Date;
    }[]>;
    createCategory(outletId: string, data: {
        name: string;
        imageUrl?: string;
        menuId?: string;
    }): Promise<{
        id: string;
        name: string;
        imageUrl: string | null;
        displayOrder: number;
        isActive: boolean;
        outletId: string | null;
        businessId: string | null;
        menuId: string | null;
        createdAt: Date;
        updatedAt: Date;
    }>;
    updateCategory(id: string, data: Partial<{
        name: string;
        imageUrl: string;
        displayOrder: number;
        isActive: boolean;
    }>): Promise<{
        id: string;
        name: string;
        imageUrl: string | null;
        displayOrder: number;
        isActive: boolean;
        outletId: string | null;
        businessId: string | null;
        menuId: string | null;
        createdAt: Date;
        updatedAt: Date;
    }>;
    deleteCategory(id: string): Promise<{
        id: string;
        name: string;
        imageUrl: string | null;
        displayOrder: number;
        isActive: boolean;
        outletId: string | null;
        businessId: string | null;
        menuId: string | null;
        createdAt: Date;
        updatedAt: Date;
    }>;
    createSubcategory(categoryId: string, data: {
        name: string;
        imageUrl?: string | null;
    }): Promise<{
        id: string;
        name: string;
        imageUrl: string | null;
        displayOrder: number;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        categoryId: string;
    }>;
    updateSubcategory(id: string, data: Partial<{
        name: string;
        imageUrl: string | null;
        displayOrder: number;
        isActive: boolean;
    }>): Promise<{
        id: string;
        name: string;
        imageUrl: string | null;
        displayOrder: number;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        categoryId: string;
    }>;
    createItem(subcategoryId: string, data: any): Promise<{
        variants: {
            id: string;
            name: string;
            createdAt: Date;
            updatedAt: Date;
            shortDescription: string | null;
            isAvailable: boolean;
            price: import("@prisma/client/runtime/library").Decimal;
            itemId: string;
        }[];
        options: {
            id: string;
            name: string;
            createdAt: Date;
            updatedAt: Date;
            price: import("@prisma/client/runtime/library").Decimal;
            itemId: string;
        }[];
    } & {
        id: string;
        name: string;
        imageUrl: string | null;
        displayOrder: number;
        createdAt: Date;
        updatedAt: Date;
        description: string | null;
        isDisplayed: boolean;
        shortDescription: string | null;
        longDescription: string | null;
        thumbnailUrl: string | null;
        basePrice: import("@prisma/client/runtime/library").Decimal;
        gstRate: import("@prisma/client/runtime/library").Decimal | null;
        parcelAvailable: boolean;
        useCustomParcelCharge: boolean;
        parcelCharge: import("@prisma/client/runtime/library").Decimal | null;
        preparationTime: number | null;
        foodGrade: import(".prisma/client").$Enums.FoodGrade;
        isAvailable: boolean;
        isPopular: boolean;
        isSpecial: boolean;
        hasLimitedStock: boolean;
        availableQuantity: number;
        subcategoryId: string;
        kitchenStationId: string | null;
        isBundle: boolean;
        maxBundleSelections: number | null;
    }>;
    updateItem(id: string, data: any): Promise<{
        variants: {
            id: string;
            name: string;
            createdAt: Date;
            updatedAt: Date;
            shortDescription: string | null;
            isAvailable: boolean;
            price: import("@prisma/client/runtime/library").Decimal;
            itemId: string;
        }[];
        options: {
            id: string;
            name: string;
            createdAt: Date;
            updatedAt: Date;
            price: import("@prisma/client/runtime/library").Decimal;
            itemId: string;
        }[];
    } & {
        id: string;
        name: string;
        imageUrl: string | null;
        displayOrder: number;
        createdAt: Date;
        updatedAt: Date;
        description: string | null;
        isDisplayed: boolean;
        shortDescription: string | null;
        longDescription: string | null;
        thumbnailUrl: string | null;
        basePrice: import("@prisma/client/runtime/library").Decimal;
        gstRate: import("@prisma/client/runtime/library").Decimal | null;
        parcelAvailable: boolean;
        useCustomParcelCharge: boolean;
        parcelCharge: import("@prisma/client/runtime/library").Decimal | null;
        preparationTime: number | null;
        foodGrade: import(".prisma/client").$Enums.FoodGrade;
        isAvailable: boolean;
        isPopular: boolean;
        isSpecial: boolean;
        hasLimitedStock: boolean;
        availableQuantity: number;
        subcategoryId: string;
        kitchenStationId: string | null;
        isBundle: boolean;
        maxBundleSelections: number | null;
    }>;
    private replaceBundleChildren;
    toggleItemAvailability(id: string): Promise<{
        id: string;
        name: string;
        imageUrl: string | null;
        displayOrder: number;
        createdAt: Date;
        updatedAt: Date;
        description: string | null;
        isDisplayed: boolean;
        shortDescription: string | null;
        longDescription: string | null;
        thumbnailUrl: string | null;
        basePrice: import("@prisma/client/runtime/library").Decimal;
        gstRate: import("@prisma/client/runtime/library").Decimal | null;
        parcelAvailable: boolean;
        useCustomParcelCharge: boolean;
        parcelCharge: import("@prisma/client/runtime/library").Decimal | null;
        preparationTime: number | null;
        foodGrade: import(".prisma/client").$Enums.FoodGrade;
        isAvailable: boolean;
        isPopular: boolean;
        isSpecial: boolean;
        hasLimitedStock: boolean;
        availableQuantity: number;
        subcategoryId: string;
        kitchenStationId: string | null;
        isBundle: boolean;
        maxBundleSelections: number | null;
    }>;
    toggleItemVisibility(id: string): Promise<{
        id: string;
        name: string;
        imageUrl: string | null;
        displayOrder: number;
        createdAt: Date;
        updatedAt: Date;
        description: string | null;
        isDisplayed: boolean;
        shortDescription: string | null;
        longDescription: string | null;
        thumbnailUrl: string | null;
        basePrice: import("@prisma/client/runtime/library").Decimal;
        gstRate: import("@prisma/client/runtime/library").Decimal | null;
        parcelAvailable: boolean;
        useCustomParcelCharge: boolean;
        parcelCharge: import("@prisma/client/runtime/library").Decimal | null;
        preparationTime: number | null;
        foodGrade: import(".prisma/client").$Enums.FoodGrade;
        isAvailable: boolean;
        isPopular: boolean;
        isSpecial: boolean;
        hasLimitedStock: boolean;
        availableQuantity: number;
        subcategoryId: string;
        kitchenStationId: string | null;
        isBundle: boolean;
        maxBundleSelections: number | null;
    }>;
    adjustItemStock(id: string, body: {
        addQuantity?: number;
        setQuantity?: number;
    }): Promise<{
        id: string;
        name: string;
        imageUrl: string | null;
        displayOrder: number;
        createdAt: Date;
        updatedAt: Date;
        description: string | null;
        isDisplayed: boolean;
        shortDescription: string | null;
        longDescription: string | null;
        thumbnailUrl: string | null;
        basePrice: import("@prisma/client/runtime/library").Decimal;
        gstRate: import("@prisma/client/runtime/library").Decimal | null;
        parcelAvailable: boolean;
        useCustomParcelCharge: boolean;
        parcelCharge: import("@prisma/client/runtime/library").Decimal | null;
        preparationTime: number | null;
        foodGrade: import(".prisma/client").$Enums.FoodGrade;
        isAvailable: boolean;
        isPopular: boolean;
        isSpecial: boolean;
        hasLimitedStock: boolean;
        availableQuantity: number;
        subcategoryId: string;
        kitchenStationId: string | null;
        isBundle: boolean;
        maxBundleSelections: number | null;
    }>;
    deleteItem(id: string): Promise<{
        id: string;
        name: string;
        imageUrl: string | null;
        displayOrder: number;
        createdAt: Date;
        updatedAt: Date;
        description: string | null;
        isDisplayed: boolean;
        shortDescription: string | null;
        longDescription: string | null;
        thumbnailUrl: string | null;
        basePrice: import("@prisma/client/runtime/library").Decimal;
        gstRate: import("@prisma/client/runtime/library").Decimal | null;
        parcelAvailable: boolean;
        useCustomParcelCharge: boolean;
        parcelCharge: import("@prisma/client/runtime/library").Decimal | null;
        preparationTime: number | null;
        foodGrade: import(".prisma/client").$Enums.FoodGrade;
        isAvailable: boolean;
        isPopular: boolean;
        isSpecial: boolean;
        hasLimitedStock: boolean;
        availableQuantity: number;
        subcategoryId: string;
        kitchenStationId: string | null;
        isBundle: boolean;
        maxBundleSelections: number | null;
    }>;
    createVariant(itemId: string, data: {
        name: string;
        price: number;
        shortDescription?: string;
    }): Promise<{
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        shortDescription: string | null;
        isAvailable: boolean;
        price: import("@prisma/client/runtime/library").Decimal;
        itemId: string;
    }>;
    addItemImage(itemId: string, url: string): Promise<{
        id: string;
        displayOrder: number;
        createdAt: Date;
        itemId: string;
        url: string;
    }>;
    removeItemImage(imageId: string): Promise<{
        id: string;
        displayOrder: number;
        createdAt: Date;
        itemId: string;
        url: string;
    }>;
    reorderItemImages(itemId: string, orderedIds: string[]): Promise<{
        id: string;
        displayOrder: number;
        createdAt: Date;
        itemId: string;
        url: string;
    }[]>;
    updateVariant(id: string, data: Partial<{
        name: string;
        shortDescription: string | null;
        price: number;
        isAvailable: boolean;
    }>): Promise<{
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        shortDescription: string | null;
        isAvailable: boolean;
        price: import("@prisma/client/runtime/library").Decimal;
        itemId: string;
    }>;
    deleteVariant(id: string): Promise<{
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        shortDescription: string | null;
        isAvailable: boolean;
        price: import("@prisma/client/runtime/library").Decimal;
        itemId: string;
    }>;
    createOption(itemId: string, data: {
        name: string;
        price: number;
    }): Promise<{
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        price: import("@prisma/client/runtime/library").Decimal;
        itemId: string;
    }>;
    getPopularItems(outletId: string): Promise<({
        variants: {
            id: string;
            name: string;
            createdAt: Date;
            updatedAt: Date;
            shortDescription: string | null;
            isAvailable: boolean;
            price: import("@prisma/client/runtime/library").Decimal;
            itemId: string;
        }[];
    } & {
        id: string;
        name: string;
        imageUrl: string | null;
        displayOrder: number;
        createdAt: Date;
        updatedAt: Date;
        description: string | null;
        isDisplayed: boolean;
        shortDescription: string | null;
        longDescription: string | null;
        thumbnailUrl: string | null;
        basePrice: import("@prisma/client/runtime/library").Decimal;
        gstRate: import("@prisma/client/runtime/library").Decimal | null;
        parcelAvailable: boolean;
        useCustomParcelCharge: boolean;
        parcelCharge: import("@prisma/client/runtime/library").Decimal | null;
        preparationTime: number | null;
        foodGrade: import(".prisma/client").$Enums.FoodGrade;
        isAvailable: boolean;
        isPopular: boolean;
        isSpecial: boolean;
        hasLimitedStock: boolean;
        availableQuantity: number;
        subcategoryId: string;
        kitchenStationId: string | null;
        isBundle: boolean;
        maxBundleSelections: number | null;
    })[]>;
    importFromOutlet(targetOutletId: string, sourceOutletId: string): Promise<{
        categories: number;
        subcategories: number;
        items: number;
    }>;
    getBusinessMenu(businessId: string, lang?: string | null): Promise<any[]>;
    createBusinessCategory(businessId: string, dto: {
        name: string;
        imageUrl?: string;
        displayOrder?: number;
        menuId?: string;
    }): Promise<{
        id: string;
        name: string;
        imageUrl: string | null;
        displayOrder: number;
        isActive: boolean;
        outletId: string | null;
        businessId: string | null;
        menuId: string | null;
        createdAt: Date;
        updatedAt: Date;
    }>;
    updateBusinessCategory(id: string, dto: {
        name?: string;
        imageUrl?: string;
        displayOrder?: number;
        isActive?: boolean;
    }): Promise<{
        id: string;
        name: string;
        imageUrl: string | null;
        displayOrder: number;
        isActive: boolean;
        outletId: string | null;
        businessId: string | null;
        menuId: string | null;
        createdAt: Date;
        updatedAt: Date;
    }>;
    deleteBusinessCategory(id: string): Promise<{
        id: string;
        name: string;
        imageUrl: string | null;
        displayOrder: number;
        isActive: boolean;
        outletId: string | null;
        businessId: string | null;
        menuId: string | null;
        createdAt: Date;
        updatedAt: Date;
    }>;
    createBusinessSubcategory(categoryId: string, dto: {
        name: string;
        displayOrder?: number;
    }): Promise<{
        id: string;
        name: string;
        imageUrl: string | null;
        displayOrder: number;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        categoryId: string;
    }>;
    createBusinessItem(subcategoryId: string, dto: any): Promise<{
        id: string;
        name: string;
        imageUrl: string | null;
        displayOrder: number;
        createdAt: Date;
        updatedAt: Date;
        description: string | null;
        isDisplayed: boolean;
        shortDescription: string | null;
        longDescription: string | null;
        thumbnailUrl: string | null;
        basePrice: import("@prisma/client/runtime/library").Decimal;
        gstRate: import("@prisma/client/runtime/library").Decimal | null;
        parcelAvailable: boolean;
        useCustomParcelCharge: boolean;
        parcelCharge: import("@prisma/client/runtime/library").Decimal | null;
        preparationTime: number | null;
        foodGrade: import(".prisma/client").$Enums.FoodGrade;
        isAvailable: boolean;
        isPopular: boolean;
        isSpecial: boolean;
        hasLimitedStock: boolean;
        availableQuantity: number;
        subcategoryId: string;
        kitchenStationId: string | null;
        isBundle: boolean;
        maxBundleSelections: number | null;
    }>;
    importFromBusiness(targetOutletId: string, sourceBusinessId: string, itemIds?: string[]): Promise<{
        categories: number;
        subcategories: number;
        items: number;
    }>;
}
