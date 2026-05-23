import { TranslationProvider } from './translation-provider';
export declare class BhashiniTranslationProvider implements TranslationProvider {
    private readonly logger;
    private readonly authUrl;
    private readonly pipelineId;
    private readonly cache;
    translate(text: string, fromCode: string, toCode: string): Promise<string>;
    private getPipeline;
}
