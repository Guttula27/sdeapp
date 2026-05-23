import { TranslationProvider } from './translation-provider';
export declare class LingvaTranslationProvider implements TranslationProvider {
    private readonly logger;
    private readonly hosts;
    constructor();
    private static readonly FETCH_TIMEOUT_MS;
    private static readonly HOST_BLOCK_MS;
    private static blockedHosts;
    translate(text: string, fromCode: string, toCode: string): Promise<string>;
}
