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
                    createdAt: Date;
                    displayOrder: number;
                    itemId: string;
                    url: string;
                }[];
                options: {
                    name: string;
                    id: string;
                    createdAt: Date;
                    updatedAt: Date;
                    price: import("@prisma/client/runtime/library").Decimal;
                    itemId: string;
                }[];
                tags: {
                    name: string;
                    id: string;
                    itemId: string;
                }[];
                customerTagPrices: ({
                    customerTag: {
                        name: string;
                        id: string;
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
                    variantId: string | null;
                    customerTagId: string;
                })[];
                tableTypePrices: ({
                    tableType: {
                        name: string;
                        id: string;
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
                    variantId: string | null;
                    tableTypeId: string;
                })[];
                itemToppings: ({
                    topping: {
                        options: {
                            name: string;
                            id: string;
                            createdAt: Date;
                            updatedAt: Date;
                            displayOrder: number;
                            toppingId: string;
                            priceAdd: import("@prisma/client/runtime/library").Decimal;
                        }[];
                    } & {
                        name: string;
                        id: string;
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
                        name: string;
                        id: string;
                    } | null;
                    childItem: {
                        name: string;
                        id: string;
                    };
                } & {
                    id: string;
                    createdAt: Date;
                    displayOrder: number;
                    quantity: number;
                    variantId: string | null;
                    parentItemId: string;
                    childItemId: string;
                })[];
                name: string;
                description: string | null;
                id: string;
                createdAt: Date;
                updatedAt: Date;
                thumbnailUrl: string | null;
                shortDescription: string | null;
                longDescription: string | null;
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
                isSpecial: boolean;
                hasLimitedStock: boolean;
                availableQuantity: number;
                displayOrder: number;
                subcategoryId: string;
                kitchenStationId: string | null;
                isBundle: boolean;
                maxBundleSelections: number | null;
            }[];
            name: string;
            id: string;
            createdAt: Date;
            updatedAt: Date;
            isActive: boolean;
            imageUrl: string | null;
            displayOrder: number;
            categoryId: string;
        }[];
        name: string;
        id: string;
        businessId: string | null;
        outletId: string | null;
        createdAt: Date;
        updatedAt: Date;
        isActive: boolean;
        imageUrl: string | null;
        displayOrder: number;
        menuId: string | null;
    }[]>;
    createCategory(outletId: string, data: {
        name: string;
        imageUrl?: string;
        menuId?: string;
    }): Promise<{
        name: string;
        id: string;
        businessId: string | null;
        outletId: string | null;
        createdAt: Date;
        updatedAt: Date;
        isActive: boolean;
        imageUrl: string | null;
        displayOrder: number;
        menuId: string | null;
    }>;
    updateCategory(id: string, data: Partial<{
        name: string;
        imageUrl: string;
        displayOrder: number;
        isActive: boolean;
    }>): Promise<{
        name: string;
        id: string;
        businessId: string | null;
        outletId: string | null;
        createdAt: Date;
        updatedAt: Date;
        isActive: boolean;
        imageUrl: string | null;
        displayOrder: number;
        menuId: string | null;
    }>;
    deleteCategory(id: string): Promise<{
        name: string;
        id: string;
        businessId: string | null;
        outletId: string | null;
        createdAt: Date;
        updatedAt: Date;
        isActive: boolean;
        imageUrl: string | null;
        displayOrder: number;
        menuId: string | null;
    }>;
    createSubcategory(categoryId: string, data: {
        name: string;
        imageUrl?: string | null;
    }): Promise<{
        name: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        isActive: boolean;
        imageUrl: string | null;
        displayOrder: number;
        categoryId: string;
    }>;
    updateSubcategory(id: string, data: Partial<{
        name: string;
        imageUrl: string | null;
        displayOrder: number;
        isActive: boolean;
    }>): Promise<{
        name: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        isActive: boolean;
        imageUrl: string | null;
        displayOrder: number;
        categoryId: string;
    }>;
    createItem(subcategoryId: string, data: any): Promise<{
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
        options: {
            name: string;
            id: string;
            createdAt: Date;
            updatedAt: Date;
            price: import("@prisma/client/runtime/library").Decimal;
            itemId: string;
        }[];
    } & {
        name: string;
        description: string | null;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        thumbnailUrl: string | null;
        shortDescription: string | null;
        longDescription: string | null;
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
        isBundle: boolean;
        maxBundleSelections: number | null;
    }>;
    updateItem(id: string, data: any): Promise<{
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
        options: {
            name: string;
            id: string;
            createdAt: Date;
            updatedAt: Date;
            price: import("@prisma/client/runtime/library").Decimal;
            itemId: string;
        }[];
    } & {
        name: string;
        description: string | null;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        thumbnailUrl: string | null;
        shortDescription: string | null;
        longDescription: string | null;
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
        isBundle: boolean;
        maxBundleSelections: number | null;
    }>;
    private replaceBundleChildren;
    toggleItemAvailability(id: string): Promise<{
        name: string;
        description: string | null;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        thumbnailUrl: string | null;
        shortDescription: string | null;
        longDescription: string | null;
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
        isBundle: boolean;
        maxBundleSelections: number | null;
    }>;
    toggleItemVisibility(id: string): Promise<{
        name: string;
        description: string | null;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        thumbnailUrl: string | null;
        shortDescription: string | null;
        longDescription: string | null;
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
        isBundle: boolean;
        maxBundleSelections: number | null;
    }>;
    adjustItemStock(id: string, body: {
        addQuantity?: number;
        setQuantity?: number;
    }): Promise<{
        name: string;
        description: string | null;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        thumbnailUrl: string | null;
        shortDescription: string | null;
        longDescription: string | null;
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
        isBundle: boolean;
        maxBundleSelections: number | null;
    }>;
    deleteItem(id: string): Promise<{
        name: string;
        description: string | null;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        thumbnailUrl: string | null;
        shortDescription: string | null;
        longDescription: string | null;
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
        isBundle: boolean;
        maxBundleSelections: number | null;
    }>;
    createVariant(itemId: string, data: {
        name: string;
        price: number;
        shortDescription?: string;
    }): Promise<{
        name: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        shortDescription: string | null;
        isAvailable: boolean;
        price: import("@prisma/client/runtime/library").Decimal;
        itemId: string;
    }>;
    addItemImage(itemId: string, url: string): Promise<{
        id: string;
        createdAt: Date;
        displayOrder: number;
        itemId: string;
        url: string;
    }>;
    removeItemImage(imageId: string): Promise<{
        id: string;
        createdAt: Date;
        displayOrder: number;
        itemId: string;
        url: string;
    }>;
    reorderItemImages(itemId: string, orderedIds: string[]): Promise<{
        id: string;
        createdAt: Date;
        displayOrder: number;
        itemId: string;
        url: string;
    }[]>;
    updateVariant(id: string, data: Partial<{
        name: string;
        shortDescription: string | null;
        price: number;
        isAvailable: boolean;
    }>): Promise<{
        name: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        shortDescription: string | null;
        isAvailable: boolean;
        price: import("@prisma/client/runtime/library").Decimal;
        itemId: string;
    }>;
    deleteVariant(id: string): Promise<{
        name: string;
        id: string;
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
        name: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        price: import("@prisma/client/runtime/library").Decimal;
        itemId: string;
    }>;
    getPopularItems(outletId: string): Promise<({
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
        thumbnailUrl: string | null;
        shortDescription: string | null;
        longDescription: string | null;
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
        name: string;
        id: string;
        businessId: string | null;
        outletId: string | null;
        createdAt: Date;
        updatedAt: Date;
        isActive: boolean;
        imageUrl: string | null;
        displayOrder: number;
        menuId: string | null;
    }>;
    updateBusinessCategory(id: string, dto: {
        name?: string;
        imageUrl?: string;
        displayOrder?: number;
        isActive?: boolean;
    }): Promise<{
        name: string;
        id: string;
        businessId: string | null;
        outletId: string | null;
        createdAt: Date;
        updatedAt: Date;
        isActive: boolean;
        imageUrl: string | null;
        displayOrder: number;
        menuId: string | null;
    }>;
    deleteBusinessCategory(id: string): Promise<{
        name: string;
        id: string;
        businessId: string | null;
        outletId: string | null;
        createdAt: Date;
        updatedAt: Date;
        isActive: boolean;
        imageUrl: string | null;
        displayOrder: number;
        menuId: string | null;
    }>;
    createBusinessSubcategory(categoryId: string, dto: {
        name: string;
        displayOrder?: number;
    }): Promise<{
        name: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        isActive: boolean;
        imageUrl: string | null;
        displayOrder: number;
        categoryId: string;
    }>;
    createBusinessItem(subcategoryId: string, dto: any): Promise<{
        name: string;
        description: string | null;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        thumbnailUrl: string | null;
        shortDescription: string | null;
        longDescription: string | null;
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
        isBundle: boolean;
        maxBundleSelections: number | null;
    }>;
    importFromBusiness(targetOutletId: string, sourceBusinessId: string, itemIds?: string[]): Promise<{
        categories: number;
        subcategories: number;
        items: number;
    }>;
}
