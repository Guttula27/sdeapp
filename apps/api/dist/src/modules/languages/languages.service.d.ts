import { PrismaService } from '../../config/prisma/prisma.service';
export interface UpsertLanguageDto {
    code: string;
    name: string;
    nativeName: string;
    isEnabled?: boolean;
}
export declare class LanguagesService {
    private prisma;
    constructor(prisma: PrismaService);
    private assertPlatform;
    listEnabled(): import(".prisma/client").Prisma.PrismaPromise<{
        name: string;
        createdAt: Date;
        updatedAt: Date;
        code: string;
        nativeName: string;
        isEnabled: boolean;
    }[]>;
    listAll(user: any): import(".prisma/client").Prisma.PrismaPromise<{
        name: string;
        createdAt: Date;
        updatedAt: Date;
        code: string;
        nativeName: string;
        isEnabled: boolean;
    }[]>;
    create(user: any, dto: UpsertLanguageDto): Promise<{
        name: string;
        createdAt: Date;
        updatedAt: Date;
        code: string;
        nativeName: string;
        isEnabled: boolean;
    }>;
    update(user: any, code: string, dto: Partial<UpsertLanguageDto>): Promise<{
        name: string;
        createdAt: Date;
        updatedAt: Date;
        code: string;
        nativeName: string;
        isEnabled: boolean;
    }>;
    remove(user: any, code: string): Promise<{
        message: string;
    }>;
}
