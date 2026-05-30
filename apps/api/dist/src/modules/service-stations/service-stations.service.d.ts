import { PrismaService } from '../../config/prisma/prisma.service';
export declare class ServiceStationsService {
    private prisma;
    constructor(prisma: PrismaService);
    list(outletId: string): import(".prisma/client").Prisma.PrismaPromise<({
        tableType: {
            name: string;
            id: string;
            color: string;
        } | null;
        tables: ({
            table: {
                number: string;
                id: string;
                sectionId: string | null;
                tableTypeId: string | null;
            };
        } & {
            id: string;
            createdAt: Date;
            tableId: string;
            stationId: string;
        })[];
        workers: ({
            user: {
                role: {
                    name: string;
                } | null;
                name: string;
                phone: string;
                id: string;
            };
        } & {
            id: string;
            createdAt: Date;
            userId: string;
            stationId: string;
        })[];
    } & {
        name: string;
        id: string;
        outletId: string;
        createdAt: Date;
        updatedAt: Date;
        isActive: boolean;
        tableTypeId: string | null;
        isParcelStation: boolean;
    })[]>;
    create(outletId: string, data: {
        name: string;
        tableTypeId?: string | null;
        isParcelStation?: boolean;
    }): Promise<{
        tableType: {
            name: string;
            id: string;
            color: string;
        } | null;
        tables: ({
            table: {
                number: string;
                id: string;
                outletId: string;
                createdAt: Date;
                updatedAt: Date;
                isActive: boolean;
                sectionId: string | null;
                capacity: number;
                tableTypeId: string | null;
            };
        } & {
            id: string;
            createdAt: Date;
            tableId: string;
            stationId: string;
        })[];
        workers: ({
            user: {
                name: string;
                phone: string;
                id: string;
            };
        } & {
            id: string;
            createdAt: Date;
            userId: string;
            stationId: string;
        })[];
    } & {
        name: string;
        id: string;
        outletId: string;
        createdAt: Date;
        updatedAt: Date;
        isActive: boolean;
        tableTypeId: string | null;
        isParcelStation: boolean;
    }>;
    update(id: string, data: {
        name?: string;
        tableTypeId?: string | null;
        isParcelStation?: boolean;
    }): Promise<{
        tableType: {
            name: string;
            id: string;
            color: string;
        } | null;
        tables: ({
            table: {
                number: string;
                id: string;
                outletId: string;
                createdAt: Date;
                updatedAt: Date;
                isActive: boolean;
                sectionId: string | null;
                capacity: number;
                tableTypeId: string | null;
            };
        } & {
            id: string;
            createdAt: Date;
            tableId: string;
            stationId: string;
        })[];
        workers: ({
            user: {
                name: string;
                phone: string;
                id: string;
            };
        } & {
            id: string;
            createdAt: Date;
            userId: string;
            stationId: string;
        })[];
    } & {
        name: string;
        id: string;
        outletId: string;
        createdAt: Date;
        updatedAt: Date;
        isActive: boolean;
        tableTypeId: string | null;
        isParcelStation: boolean;
    }>;
    remove(id: string): Promise<{
        name: string;
        id: string;
        outletId: string;
        createdAt: Date;
        updatedAt: Date;
        isActive: boolean;
        tableTypeId: string | null;
        isParcelStation: boolean;
    }>;
    setWorkers(stationId: string, userIds: string[]): Promise<({
        tableType: {
            name: string;
            id: string;
            color: string;
        } | null;
        tables: ({
            table: {
                number: string;
                id: string;
                sectionId: string | null;
                tableTypeId: string | null;
            };
        } & {
            id: string;
            createdAt: Date;
            tableId: string;
            stationId: string;
        })[];
        workers: ({
            user: {
                role: {
                    name: string;
                } | null;
                name: string;
                phone: string;
                id: string;
            };
        } & {
            id: string;
            createdAt: Date;
            userId: string;
            stationId: string;
        })[];
    } & {
        name: string;
        id: string;
        outletId: string;
        createdAt: Date;
        updatedAt: Date;
        isActive: boolean;
        tableTypeId: string | null;
        isParcelStation: boolean;
    }) | undefined>;
    setTables(stationId: string, tableIds: string[]): Promise<({
        tableType: {
            name: string;
            id: string;
            color: string;
        } | null;
        tables: ({
            table: {
                number: string;
                id: string;
                sectionId: string | null;
                tableTypeId: string | null;
            };
        } & {
            id: string;
            createdAt: Date;
            tableId: string;
            stationId: string;
        })[];
        workers: ({
            user: {
                role: {
                    name: string;
                } | null;
                name: string;
                phone: string;
                id: string;
            };
        } & {
            id: string;
            createdAt: Date;
            userId: string;
            stationId: string;
        })[];
    } & {
        name: string;
        id: string;
        outletId: string;
        createdAt: Date;
        updatedAt: Date;
        isActive: boolean;
        tableTypeId: string | null;
        isParcelStation: boolean;
    }) | undefined>;
    listTablesForType(outletId: string, tableTypeId: string): import(".prisma/client").Prisma.PrismaPromise<({
        section: {
            name: string;
            id: string;
        } | null;
    } & {
        number: string;
        id: string;
        outletId: string;
        createdAt: Date;
        updatedAt: Date;
        isActive: boolean;
        sectionId: string | null;
        capacity: number;
        tableTypeId: string | null;
    })[]>;
    listOutletStaff(outletId: string): import(".prisma/client").Prisma.PrismaPromise<{
        role: {
            name: string;
        } | null;
        name: string;
        phone: string;
        id: string;
    }[]>;
    mine(outletId: string, userId: string): import(".prisma/client").Prisma.PrismaPromise<({
        tableType: {
            name: string;
            id: string;
            color: string;
        } | null;
        tables: ({
            table: {
                number: string;
                id: string;
            };
        } & {
            id: string;
            createdAt: Date;
            tableId: string;
            stationId: string;
        })[];
    } & {
        name: string;
        id: string;
        outletId: string;
        createdAt: Date;
        updatedAt: Date;
        isActive: boolean;
        tableTypeId: string | null;
        isParcelStation: boolean;
    })[]>;
    hasActiveParcelStation(outletId: string): Promise<boolean>;
}
