import { Injectable, Logger } from '@nestjs/common';

export interface TranslationProvider {
  /** Translate a single string. Implementations should be safe for empty input. */
  translate(text: string, fromCode: string, toCode: string): Promise<string>;
}

/**
 * Default provider used in dev / testing. Wraps the input with the target code
 * so translations are visibly distinct without an external dependency.
 * Replace with LibreTranslate, Google Translate, or DeepL by registering a
 * different provider in TranslationsModule.
 */
@Injectable()
export class StubTranslationProvider implements TranslationProvider {
  private readonly logger = new Logger(StubTranslationProvider.name);

  async translate(text: string, fromCode: string, toCode: string): Promise<string> {
    if (!text) return text;
    if (fromCode === toCode) return text;
    // Localised demo text for the seeded languages so screenshots look real.
    if (toCode === 'hi') return `[हिन्दी] ${text}`;
    return `[${toCode}] ${text}`;
  }
}

export const TRANSLATION_PROVIDER = Symbol('TRANSLATION_PROVIDER');
