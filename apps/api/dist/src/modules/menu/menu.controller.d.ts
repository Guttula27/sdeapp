import { MenuService } from './menu.service';
export declare class MenuController {
    private menuService;
    constructor(menuService: MenuService);
    getMenu(outletId: string, req: any, lang: string | null, tableId?: string, includeHidden?: string): Promise<{
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
    getPopular(outletId: string): Promise<({
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
    createCategory(outletId: string, body: any): Promise<{
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
    updateCategory(id: string, body: any): Promise<{
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
    createSubcategory(categoryId: string, body: any): Promise<{
        id: string;
        name: string;
        imageUrl: string | null;
        displayOrder: number;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        categoryId: string;
    }>;
    updateSubcategory(id: string, body: any): Promise<{
        id: string;
        name: string;
        imageUrl: string | null;
        displayOrder: number;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        categoryId: string;
    }>;
    createItem(subcategoryId: string, body: any): Promise<{
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
    updateItem(id: string, body: any): Promise<{
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
    toggleAvailability(id: string): Promise<{
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
    toggleVisibility(id: string): Promise<{
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
    adjustStock(id: string, body: {
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
    createVariant(itemId: string, body: any): Promise<{
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        shortDescription: string | null;
        isAvailable: boolean;
        price: import("@prisma/client/runtime/library").Decimal;
        itemId: string;
    }>;
    updateVariant(id: string, body: any): Promise<{
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
    importFromOutlet(outletId: string, sourceOutletId: string): Promise<{
        categories: number;
        subcategories: number;
        items: number;
    }>;
    importFromBusiness(outletId: string, businessId: string, user: any, body?: {
        itemIds?: string[];
    }): Promise<{
        categories: number;
        subcategories: number;
        items: number;
    }>;
    addItemImage(itemId: string, body: {
        url: string;
    }): Promise<{
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
    reorderItemImages(itemId: string, body: {
        orderedIds: string[];
    }): Promise<{
        id: string;
        displayOrder: number;
        createdAt: Date;
        itemId: string;
        url: string;
    }[]>;
}
