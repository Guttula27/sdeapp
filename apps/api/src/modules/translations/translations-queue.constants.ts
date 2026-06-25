// Bull queue + job constants for the translation pipeline.
// Lives in its own file so both TranslationsService (producer)
// and TranslationsProcessor (consumer) can import them without
// triggering a circular dep between the two.

export const TRANSLATIONS_QUEUE = 'translations';
export const TRANSLATE_FIELD_JOB = 'translate-field';

export interface TranslateFieldJobData {
  entityType: string;
  entityId: string;
  fieldName: string;
  sourceText: string;
  languageCode: string;
}
