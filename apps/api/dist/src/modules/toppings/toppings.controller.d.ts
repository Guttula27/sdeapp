import { ToppingsService } from './toppings.service';
export declare class ToppingsController {
    private service;
    constructor(service: ToppingsService);
    list(outletId: string, lang: string | null): Promise<({
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
    })[]>;
    create(outletId: string, body: any): Promise<{
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
    }>;
    update(id: string, body: any): Promise<{
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
    }>;
    remove(id: string): import(".prisma/client").Prisma.Prisma__ToppingClient<{
        name: string;
        id: string;
        outletId: string;
        createdAt: Date;
        updatedAt: Date;
        basePriceAdd: import("@prisma/client/runtime/library").Decimal;
    }, never, import("@prisma/client/runtime/library").DefaultArgs>;
    setItemToppings(itemId: string, body: {
        links: {
            toppingId: string;
            priceAdd?: number;
            isRequired?: boolean;
        }[];
    }): Promise<({
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
    })[]>;
}
