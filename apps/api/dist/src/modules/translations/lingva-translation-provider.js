"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var LingvaTranslationProvider_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.LingvaTranslationProvider = void 0;
const common_1 = require("@nestjs/common");
let LingvaTranslationProvider = LingvaTranslationProvider_1 = class LingvaTranslationProvider {
    constructor() {
        this.logger = new common_1.Logger(LingvaTranslationProvider_1.name);
        const env = process.env.LINGVA_URL?.trim();
        this.hosts = env ? [env.replace(/\/$/, '')] : [
            'https://lingva.ml',
            'https://lingva.lunar.icu',
            'https://translate.plausibility.cloud',
        ];
    }
    async translate(text, fromCode, toCode) {
        if (!text)
            return text;
        if (fromCode === toCode)
            return text;
        const encoded = encodeURIComponent(text);
        let lastError = null;
        const now = Date.now();
        for (const host of this.hosts) {
            const blockedUntil = LingvaTranslationProvider_1.blockedHosts.get(host) ?? 0;
            if (blockedUntil > now) {
                lastError = new Error(`${host} cooling down`);
                continue;
            }
            try {
                const res = await fetch(`${host}/api/v1/${fromCode}/${toCode}/${encoded}`, {
                    method: 'GET',
                    headers: { Accept: 'application/json' },
                    signal: AbortSignal.timeout(LingvaTranslationProvider_1.FETCH_TIMEOUT_MS),
                });
                if (!res.ok) {
                    LingvaTranslationProvider_1.blockedHosts.set(host, now + LingvaTranslationProvider_1.HOST_BLOCK_MS);
                    lastError = new Error(`${host} ${res.status}`);
                    continue;
                }
                const data = await res.json();
                if (typeof data?.translation === 'string' && data.translation.trim()) {
                    return data.translation;
                }
                lastError = new Error(`${host} returned no translation`);
            }
            catch (e) {
                LingvaTranslationProvider_1.blockedHosts.set(host, now + LingvaTranslationProvider_1.HOST_BLOCK_MS);
                lastError = e;
            }
        }
        throw lastError instanceof Error ? lastError : new Error('Lingva failed');
    }
};
exports.LingvaTranslationProvider = LingvaTranslationProvider;
LingvaTranslationProvider.FETCH_TIMEOUT_MS = 1500;
LingvaTranslationProvider.HOST_BLOCK_MS = 60_000;
LingvaTranslationProvider.blockedHosts = new Map();
exports.LingvaTranslationProvider = LingvaTranslationProvider = LingvaTranslationProvider_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [])
], LingvaTranslationProvider);
//# sourceMappingURL=lingva-translation-provider.js.map