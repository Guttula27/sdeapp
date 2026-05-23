import { PrismaService } from '../../config/prisma/prisma.service';
import { TranslationProvider } from './translation-provider';
export declare const SOURCE_LANGUAGE = "en";
export declare class TranslationsService {
    private prisma;
    private provider;
    private readonly logger;
    constructor(prisma: PrismaService, provider: TranslationProvider);
    enabledLanguages(): Promise<string[]>;
    upsertAll(entityType: string, entityId: string, fields: Record<string, string | null | undefined>): Promise<void>;
    deleteAll(entityType: string, entityId: string): Promise<void>;
    lookup(entityType: string, entityIds: string[], languageCode: string): Promise<Map<string, Record<string, string>>>;
    hydrate<T extends {
        id: string;
    }>(entityType: string, rows: T | T[] | null | undefined, fields: Array<keyof T & string>, languageCode: string | null | undefined): Promise<T | T[] | null | undefined>;
}
