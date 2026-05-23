"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var StubTranslationProvider_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.TRANSLATION_PROVIDER = exports.StubTranslationProvider = void 0;
const common_1 = require("@nestjs/common");
let StubTranslationProvider = StubTranslationProvider_1 = class StubTranslationProvider {
    constructor() {
        this.logger = new common_1.Logger(StubTranslationProvider_1.name);
    }
    async translate(text, fromCode, toCode) {
        if (!text)
            return text;
        if (fromCode === toCode)
            return text;
        if (toCode === 'hi')
            return `[हिन्दी] ${text}`;
        return `[${toCode}] ${text}`;
    }
};
exports.StubTranslationProvider = StubTranslationProvider;
exports.StubTranslationProvider = StubTranslationProvider = StubTranslationProvider_1 = __decorate([
    (0, common_1.Injectable)()
], StubTranslationProvider);
exports.TRANSLATION_PROVIDER = Symbol('TRANSLATION_PROVIDER');
//# sourceMappingURL=translation-provider.js.map