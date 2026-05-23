import { MenuService } from './menu.service';
export declare class MenuController {
    private menuService;
    constructor(menuService: MenuService);
    getMenu(outletId: string, req: any, lang: string | null, tableId?: string): Promise<{
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
                isSpecial: boolean;
                hasLimitedStock: boolean;
                availableQuantity: number;
                displayOrder: number;
                subcategoryId: string;
                kitchenStationId: string | null;
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
    }[]>;
    getPopular(outletId: string): Promise<({
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
    })[]>;
    createCategory(outletId: string, body: any): Promise<{
        name: string;
        id: string;
        businessId: string | null;
        outletId: string | null;
        createdAt: Date;
        updatedAt: Date;
        isActive: boolean;
        imageUrl: string | null;
        displayOrder: number;
    }>;
    updateCategory(id: string, body: any): Promise<{
        name: string;
        id: string;
        businessId: string | null;
        outletId: string | null;
        createdAt: Date;
        updatedAt: Date;
        isActive: boolean;
        imageUrl: string | null;
        displayOrder: number;
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
    }>;
    createSubcategory(categoryId: string, body: any): Promise<{
        name: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        isActive: boolean;
        imageUrl: string | null;
        displayOrder: number;
        categoryId: string;
    }>;
    updateSubcategory(id: string, body: any): Promise<{
        name: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        isActive: boolean;
        imageUrl: string | null;
        displayOrder: number;
        categoryId: string;
    }>;
    createItem(subcategoryId: string, body: any): Promise<{
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
    }>;
    updateItem(id: string, body: any): Promise<{
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
    }>;
    toggleAvailability(id: string): Promise<{
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
    }>;
    adjustStock(id: string, body: {
        addQuantity?: number;
        setQuantity?: number;
    }): Promise<{
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
    }>;
    deleteItem(id: string): Promise<{
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
    }>;
    createVariant(itemId: string, body: any): Promise<{
        name: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        shortDescription: string | null;
        isAvailable: boolean;
        price: import("@prisma/client/runtime/library").Decimal;
        itemId: string;
    }>;
    updateVariant(id: string, body: any): Promise<{
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
    reorderItemImages(itemId: string, body: {
        orderedIds: string[];
    }): Promise<{
        id: string;
        createdAt: Date;
        displayOrder: number;
        itemId: string;
        url: string;
    }[]>;
}
