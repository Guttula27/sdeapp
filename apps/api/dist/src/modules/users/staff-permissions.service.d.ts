import { PrismaService } from '../../config/prisma/prisma.service';
export interface SetOverridesDto {
    grants?: string[];
    revokes?: string[];
}
export declare class StaffPermissionsService {
    private prisma;
    constructor(prisma: PrismaService);
    private canManage;
    private assertCanManage;
    getForUser(actor: any, targetId: string): Promise<{
        userId: string;
        userName: string;
        role: {
            id: string;
            name: string;
            isSystem: boolean;
        } | null;
        effective: string[];
        permissions: {
            id: string;
            name: string;
            module: string;
            description: string | null;
            inRole: boolean;
            granted: boolean;
            revoked: boolean;
            effective: boolean;
            grantable: boolean;
        }[];
    }>;
    setOverrides(actor: any, targetId: string, dto: SetOverridesDto): Promise<{
        userId: string;
        userName: string;
        role: {
            id: string;
            name: string;
            isSystem: boolean;
        } | null;
        effective: string[];
        permissions: {
            id: string;
            name: string;
            module: string;
            description: string | null;
            inRole: boolean;
            granted: boolean;
            revoked: boolean;
            effective: boolean;
            grantable: boolean;
        }[];
    }>;
}
