"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TranslationsModule = void 0;
const common_1 = require("@nestjs/common");
const translations_service_1 = require("./translations.service");
const translation_provider_1 = require("./translation-provider");
const bhashini_translation_provider_1 = require("./bhashini-translation-provider");
const lingva_translation_provider_1 = require("./lingva-translation-provider");
const logger = new common_1.Logger('TranslationsModule');
function buildProvider() {
    const explicit = (process.env.TRANSLATION_PROVIDER_NAME || '').trim().toLowerCase();
    const hasBhashini = !!(process.env.BHASHINI_USER_ID && process.env.BHASHINI_API_KEY);
    const stub = new translation_provider_1.StubTranslationProvider();
    const lingva = new lingva_translation_provider_1.LingvaTranslationProvider();
    const bhashini = new bhashini_translation_provider_1.BhashiniTranslationProvider();
    const order = [];
    if (explicit === 'bhashini') {
        if (!hasBhashini)
            logger.warn('TRANSLATION_PROVIDER_NAME=bhashini but credentials missing — falling back to Lingva then stub');
        order.push(bhashini, lingva, stub);
    }
    else if (explicit === 'lingva') {
        order.push(lingva, stub);
    }
    else if (explicit === 'stub') {
        order.push(stub);
    }
    else if (hasBhashini) {
        logger.log('Using Bhashini (with Lingva → stub fallback)');
        order.push(bhashini, lingva, stub);
    }
    else {
        logger.warn('Bhashini credentials not set — using Lingva (free public Google proxy). Set BHASHINI_USER_ID and BHASHINI_API_KEY to switch.');
        order.push(lingva, stub);
    }
    return {
        async translate(text, from, to) {
            let lastError = null;
            for (const p of order) {
                try {
                    return await p.translate(text, from, to);
                }
                catch (e) {
                    lastError = e;
                    logger.warn(`${p.constructor.name} failed for ${from}→${to}: ${e?.message ?? e}`);
                }
            }
            throw lastError instanceof Error ? lastError : new Error('All translation providers failed');
        },
    };
}
let TranslationsModule = class TranslationsModule {
};
exports.TranslationsModule = TranslationsModule;
exports.TranslationsModule = TranslationsModule = __decorate([
    (0, common_1.Global)(),
    (0, common_1.Module)({
        providers: [
            translations_service_1.TranslationsService,
            translation_provider_1.StubTranslationProvider,
            bhashini_translation_provider_1.BhashiniTranslationProvider,
            lingva_translation_provider_1.LingvaTranslationProvider,
            { provide: translation_provider_1.TRANSLATION_PROVIDER, useFactory: buildProvider },
        ],
        exports: [translations_service_1.TranslationsService],
    })
], TranslationsModule);
//# sourceMappingURL=translations.module.js.map