import { IntegrationChannel } from '@prisma/client';
import { IntegrationsService, UpsertIntegrationDto } from './integrations.service';
export declare class IntegrationsController {
    private service;
    constructor(service: IntegrationsService);
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
}
