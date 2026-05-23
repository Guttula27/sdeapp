import { MessageTemplate, Prisma, TemplateApprovalStatus, TemplateCategory, TemplateChannel, TemplateScope } from '@prisma/client';
import { PrismaService } from '../../config/prisma/prisma.service';
export declare class UpsertTemplateDto {
    channel: TemplateChannel;
    name: string;
    body: string;
    category?: TemplateCategory;
    trigger?: string;
    language?: string;
    scope?: TemplateScope;
}
export declare class RejectTemplateDto {
    reason: string;
}
export declare class ApproveProviderDto {
    providerKey: string;
    providerTemplateId?: string;
}
type Caller = {
    id: string;
    businessId?: string | null;
    outletId?: string | null;
};
export declare class MessageTemplatesService {
    private prisma;
    constructor(prisma: PrismaService);
    private scopeForCaller;
    list(caller: Caller, opts?: {
        channel?: TemplateChannel;
        status?: TemplateApprovalStatus;
        scope?: TemplateScope;
    }): Prisma.PrismaPromise<{
        language: string;
        category: import(".prisma/client").$Enums.TemplateCategory;
        name: string;
        id: string;
        businessId: string | null;
        outletId: string | null;
        createdAt: Date;
        updatedAt: Date;
        scope: import(".prisma/client").$Enums.TemplateScope;
        channel: import(".prisma/client").$Enums.TemplateChannel;
        trigger: string | null;
        body: string;
        variables: Prisma.JsonValue;
        approvalStatus: import(".prisma/client").$Enums.TemplateApprovalStatus;
        providerKey: string | null;
        providerTemplateId: string | null;
        submittedAt: Date | null;
        reviewedAt: Date | null;
        rejectionReason: string | null;
        createdById: string | null;
    }[]>;
    pendingQueue(): Prisma.PrismaPromise<({
        business: {
            name: string;
            id: string;
        } | null;
        outlet: {
            name: string;
            id: string;
        } | null;
    } & {
        language: string;
        category: import(".prisma/client").$Enums.TemplateCategory;
        name: string;
        id: string;
        businessId: string | null;
        outletId: string | null;
        createdAt: Date;
        updatedAt: Date;
        scope: import(".prisma/client").$Enums.TemplateScope;
        channel: import(".prisma/client").$Enums.TemplateChannel;
        trigger: string | null;
        body: string;
        variables: Prisma.JsonValue;
        approvalStatus: import(".prisma/client").$Enums.TemplateApprovalStatus;
        providerKey: string | null;
        providerTemplateId: string | null;
        submittedAt: Date | null;
        reviewedAt: Date | null;
        rejectionReason: string | null;
        createdById: string | null;
    })[]>;
    create(caller: Caller, dto: UpsertTemplateDto): Promise<MessageTemplate>;
    private loadOwned;
    update(id: string, caller: Caller, dto: Partial<UpsertTemplateDto>): Promise<MessageTemplate>;
    remove(id: string, caller: Caller): Promise<{
        language: string;
        category: import(".prisma/client").$Enums.TemplateCategory;
        name: string;
        id: string;
        businessId: string | null;
        outletId: string | null;
        createdAt: Date;
        updatedAt: Date;
        scope: import(".prisma/client").$Enums.TemplateScope;
        channel: import(".prisma/client").$Enums.TemplateChannel;
        trigger: string | null;
        body: string;
        variables: Prisma.JsonValue;
        approvalStatus: import(".prisma/client").$Enums.TemplateApprovalStatus;
        providerKey: string | null;
        providerTemplateId: string | null;
        submittedAt: Date | null;
        reviewedAt: Date | null;
        rejectionReason: string | null;
        createdById: string | null;
    }>;
    submit(id: string, caller: Caller): Promise<{
        language: string;
        category: import(".prisma/client").$Enums.TemplateCategory;
        name: string;
        id: string;
        businessId: string | null;
        outletId: string | null;
        createdAt: Date;
        updatedAt: Date;
        scope: import(".prisma/client").$Enums.TemplateScope;
        channel: import(".prisma/client").$Enums.TemplateChannel;
        trigger: string | null;
        body: string;
        variables: Prisma.JsonValue;
        approvalStatus: import(".prisma/client").$Enums.TemplateApprovalStatus;
        providerKey: string | null;
        providerTemplateId: string | null;
        submittedAt: Date | null;
        reviewedAt: Date | null;
        rejectionReason: string | null;
        createdById: string | null;
    }>;
    forwardToProvider(id: string, dto: ApproveProviderDto): Promise<{
        language: string;
        category: import(".prisma/client").$Enums.TemplateCategory;
        name: string;
        id: string;
        businessId: string | null;
        outletId: string | null;
        createdAt: Date;
        updatedAt: Date;
        scope: import(".prisma/client").$Enums.TemplateScope;
        channel: import(".prisma/client").$Enums.TemplateChannel;
        trigger: string | null;
        body: string;
        variables: Prisma.JsonValue;
        approvalStatus: import(".prisma/client").$Enums.TemplateApprovalStatus;
        providerKey: string | null;
        providerTemplateId: string | null;
        submittedAt: Date | null;
        reviewedAt: Date | null;
        rejectionReason: string | null;
        createdById: string | null;
    }>;
    markApproved(id: string, dto: Partial<ApproveProviderDto>): Promise<{
        language: string;
        category: import(".prisma/client").$Enums.TemplateCategory;
        name: string;
        id: string;
        businessId: string | null;
        outletId: string | null;
        createdAt: Date;
        updatedAt: Date;
        scope: import(".prisma/client").$Enums.TemplateScope;
        channel: import(".prisma/client").$Enums.TemplateChannel;
        trigger: string | null;
        body: string;
        variables: Prisma.JsonValue;
        approvalStatus: import(".prisma/client").$Enums.TemplateApprovalStatus;
        providerKey: string | null;
        providerTemplateId: string | null;
        submittedAt: Date | null;
        reviewedAt: Date | null;
        rejectionReason: string | null;
        createdById: string | null;
    }>;
    reject(id: string, dto: RejectTemplateDto): Promise<{
        language: string;
        category: import(".prisma/client").$Enums.TemplateCategory;
        name: string;
        id: string;
        businessId: string | null;
        outletId: string | null;
        createdAt: Date;
        updatedAt: Date;
        scope: import(".prisma/client").$Enums.TemplateScope;
        channel: import(".prisma/client").$Enums.TemplateChannel;
        trigger: string | null;
        body: string;
        variables: Prisma.JsonValue;
        approvalStatus: import(".prisma/client").$Enums.TemplateApprovalStatus;
        providerKey: string | null;
        providerTemplateId: string | null;
        submittedAt: Date | null;
        reviewedAt: Date | null;
        rejectionReason: string | null;
        createdById: string | null;
    }>;
}
export {};
