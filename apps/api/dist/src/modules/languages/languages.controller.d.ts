import { LanguagesService, UpsertLanguageDto } from './languages.service';
export declare class LanguagesController {
    private service;
    constructor(service: LanguagesService);
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
