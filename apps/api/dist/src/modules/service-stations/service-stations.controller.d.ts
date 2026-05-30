import { ServiceStationsService } from './service-stations.service';
export declare class ServiceStationsController {
    private service;
    constructor(service: ServiceStationsService);
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
    listStaff(outletId: string): import(".prisma/client").Prisma.PrismaPromise<{
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
    listTables(outletId: string, tableTypeId: string): import(".prisma/client").Prisma.PrismaPromise<({
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
    create(outletId: string, body: {
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
    update(id: string, body: {
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
    setWorkers(id: string, body: {
        userIds: string[];
    }): Promise<({
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
    setTables(id: string, body: {
        tableIds: string[];
    }): Promise<({
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
}
