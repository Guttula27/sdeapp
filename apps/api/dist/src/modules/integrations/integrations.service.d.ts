import { IntegrationChannel } from '@prisma/client';
import { PrismaService } from '../../config/prisma/prisma.service';
export declare class UpsertIntegrationDto {
    channel: IntegrationChannel;
    providerKey: string;
    providerName: string;
    isDefault?: boolean;
    isActive?: boolean;
    config?: Record<string, any>;
}
export declare class IntegrationsService {
    private prisma;
    constructor(prisma: PrismaService);
    list(channel?: IntegrationChannel): import(".prisma/client").Prisma.PrismaPromise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        isActive: boolean;
        isDefault: boolean;
        channel: import(".prisma/client").$Enums.IntegrationChannel;
        providerKey: string;
        providerName: string;
        config: import("@prisma/client/runtime/library").JsonValue;
    }[]>;
    upsert(dto: UpsertIntegrationDto): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        isActive: boolean;
        isDefault: boolean;
        channel: import(".prisma/client").$Enums.IntegrationChannel;
        providerKey: string;
        providerName: string;
        config: import("@prisma/client/runtime/library").JsonValue;
    }>;
    remove(id: string): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        isActive: boolean;
        isDefault: boolean;
        channel: import(".prisma/client").$Enums.IntegrationChannel;
        providerKey: string;
        providerName: string;
        config: import("@prisma/client/runtime/library").JsonValue;
    }>;
    setDefault(id: string): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        isActive: boolean;
        isDefault: boolean;
        channel: import(".prisma/client").$Enums.IntegrationChannel;
        providerKey: string;
        providerName: string;
        config: import("@prisma/client/runtime/library").JsonValue;
    }>;
    activePaymentGateway(): Promise<{
        providerKey: string;
        providerName: string;
        charges: {
            UPI: number;
            DEBIT_CARD: number;
            CREDIT_CARD: number;
            NET_BANKING: number;
            WALLET: number;
        };
    } | null>;
}
