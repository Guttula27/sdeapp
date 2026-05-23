import { PrismaService } from '../../config/prisma/prisma.service';
export declare class KitchenStationsService {
    private prisma;
    constructor(prisma: PrismaService);
    list(outletId: string): import(".prisma/client").Prisma.PrismaPromise<({
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
    })[]>;
    create(outletId: string, data: {
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
    }, never, import("@prisma/client/runtime/library").DefaultArgs>;
    update(id: string, data: {
        name?: string;
        currentWorkerId?: string | null;
        isMaster?: boolean;
    }): Promise<{
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
    }>;
    delete(id: string): Promise<{
        name: string;
        id: string;
        outletId: string;
        createdAt: Date;
        updatedAt: Date;
        isActive: boolean;
        isMaster: boolean;
        currentWorkerId: string | null;
    }>;
    setItems(stationId: string, itemIds: string[]): Promise<({
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
    }) | null>;
    findMine(outletId: string, userId: string): import(".prisma/client").Prisma.Prisma__KitchenStationClient<({
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
    }) | null, null, import("@prisma/client/runtime/library").DefaultArgs>;
    listOutletStaff(outletId: string): import(".prisma/client").Prisma.PrismaPromise<{
        role: {
            name: string;
        } | null;
        name: string;
        phone: string;
        id: string;
    }[]>;
}
