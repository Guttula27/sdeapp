import { KitchenStationsService } from './kitchen-stations.service';
export declare class KitchenStationsController {
    private service;
    constructor(service: KitchenStationsService);
    list(outletId: string): import(".prisma/client").Prisma.PrismaPromise<({
        printer: {
            name: string;
            id: string;
            address: string | null;
            connection: string;
        } | null;
        items: {
            name: string;
            id: string;
        }[];
        currentWorker: {
            name: string;
            phone: string;
            id: string;
        } | null;
    } & {
        name: string;
        id: string;
        outletId: string;
        createdAt: Date;
        updatedAt: Date;
        isActive: boolean;
        isMaster: boolean;
        currentWorkerId: string | null;
        printerId: string | null;
    })[]>;
    listStaff(outletId: string): import(".prisma/client").Prisma.PrismaPromise<{
        role: {
            name: string;
        } | null;
        name: string;
        phone: string;
        id: string;
    }[]>;
    mine(outletId: string, userId: string): import(".prisma/client").Prisma.Prisma__KitchenStationClient<({
        items: {
            name: string;
            id: string;
        }[];
    } & {
        name: string;
        id: string;
        outletId: string;
        createdAt: Date;
        updatedAt: Date;
        isActive: boolean;
        isMaster: boolean;
        currentWorkerId: string | null;
        printerId: string | null;
    }) | null, null, import("@prisma/client/runtime/library").DefaultArgs>;
    create(outletId: string, body: {
        name: string;
    }): import(".prisma/client").Prisma.Prisma__KitchenStationClient<{
        currentWorker: {
            name: string;
            phone: string;
            id: string;
        } | null;
    } & {
        name: string;
        id: string;
        outletId: string;
        createdAt: Date;
        updatedAt: Date;
        isActive: boolean;
        isMaster: boolean;
        currentWorkerId: string | null;
        printerId: string | null;
    }, never, import("@prisma/client/runtime/library").DefaultArgs>;
    update(id: string, body: {
        name?: string;
        currentWorkerId?: string | null;
        isMaster?: boolean;
        printerId?: string | null;
    }): Promise<{
        printer: {
            name: string;
            id: string;
            address: string | null;
            connection: string;
        } | null;
        items: {
            name: string;
            id: string;
        }[];
        currentWorker: {
            name: string;
            phone: string;
            id: string;
        } | null;
    } & {
        name: string;
        id: string;
        outletId: string;
        createdAt: Date;
        updatedAt: Date;
        isActive: boolean;
        isMaster: boolean;
        currentWorkerId: string | null;
        printerId: string | null;
    }>;
    setItems(id: string, body: {
        itemIds: string[];
    }): Promise<({
        items: {
            name: string;
            id: string;
        }[];
        currentWorker: {
            name: string;
            phone: string;
            id: string;
        } | null;
    } & {
        name: string;
        id: string;
        outletId: string;
        createdAt: Date;
        updatedAt: Date;
        isActive: boolean;
        isMaster: boolean;
        currentWorkerId: string | null;
        printerId: string | null;
    }) | null>;
    delete(id: string): Promise<{
        name: string;
        id: string;
        outletId: string;
        createdAt: Date;
        updatedAt: Date;
        isActive: boolean;
        isMaster: boolean;
        currentWorkerId: string | null;
        printerId: string | null;
    }>;
}
