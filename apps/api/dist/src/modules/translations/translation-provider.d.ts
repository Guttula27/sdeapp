export interface TranslationProvider {
    translate(text: string, fromCode: string, toCode: string): Promise<string>;
}
export declare class StubTranslationProvider implements TranslationProvider {
    private readonly logger;
    translate(text: string, fromCode: string, toCode: string): Promise<string>;
}
export declare const TRANSLATION_PROVIDER: unique symbol;
