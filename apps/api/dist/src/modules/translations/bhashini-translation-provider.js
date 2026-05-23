"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var BhashiniTranslationProvider_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.BhashiniTranslationProvider = void 0;
const common_1 = require("@nestjs/common");
let BhashiniTranslationProvider = BhashiniTranslationProvider_1 = class BhashiniTranslationProvider {
    constructor() {
        this.logger = new common_1.Logger(BhashiniTranslationProvider_1.name);
        this.authUrl = 'https://meity-auth.ulcacontrib.org/ulca/apis/v0/model/getModelsPipeline';
        this.pipelineId = process.env.BHASHINI_PIPELINE_ID ?? '64392f96daac500b55c543cd';
        this.cache = new Map();
    }
    async translate(text, fromCode, toCode) {
        if (!text)
            return text;
        if (fromCode === toCode)
            return text;
        const cfg = await this.getPipeline(fromCode, toCode);
        const res = await fetch(cfg.callbackUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                [cfg.authKey]: cfg.authValue,
            },
            body: JSON.stringify({
                pipelineTasks: [
                    {
                        taskType: 'translation',
                        config: {
                            language: { sourceLanguage: fromCode, targetLanguage: toCode },
                            serviceId: cfg.serviceId,
                        },
                    },
                ],
                inputData: { input: [{ source: text }] },
            }),
            signal: AbortSignal.timeout(4000),
        });
        if (!res.ok) {
            const body = await res.text().catch(() => '');
            throw new Error(`Bhashini inference ${res.status}: ${body.slice(0, 200)}`);
        }
        const data = await res.json();
        const out = data?.pipelineResponse?.[0]?.output?.[0]?.target;
        if (typeof out !== 'string' || !out.trim()) {
            throw new Error(`Bhashini returned no translation: ${JSON.stringify(data).slice(0, 200)}`);
        }
        return out;
    }
    async getPipeline(from, to) {
        const key = `${from}-${to}`;
        const cached = this.cache.get(key);
        if (cached)
            return cached;
        const userId = process.env.BHASHINI_USER_ID;
        const apiKey = process.env.BHASHINI_API_KEY;
        if (!userId || !apiKey) {
            throw new Error('BHASHINI_USER_ID / BHASHINI_API_KEY are not set');
        }
        const res = await fetch(this.authUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                userID: userId,
                ulcaApiKey: apiKey,
            },
            signal: AbortSignal.timeout(4000),
            body: JSON.stringify({
                pipelineTasks: [
                    {
                        taskType: 'translation',
                        config: { language: { sourceLanguage: from, targetLanguage: to } },
                    },
                ],
                pipelineRequestConfig: { pipelineId: this.pipelineId },
            }),
        });
        if (!res.ok) {
            const body = await res.text().catch(() => '');
            throw new Error(`Bhashini pipeline ${res.status}: ${body.slice(0, 200)}`);
        }
        const data = await res.json();
        const ep = data?.pipelineInferenceAPIEndPoint;
        const serviceId = data?.pipelineResponseConfig?.[0]?.config?.[0]?.serviceId;
        if (!ep?.callbackUrl || !ep?.inferenceApiKey?.name || !ep?.inferenceApiKey?.value || !serviceId) {
            throw new Error('Bhashini pipeline response missing fields');
        }
        const cfg = {
            callbackUrl: ep.callbackUrl,
            authKey: ep.inferenceApiKey.name,
            authValue: ep.inferenceApiKey.value,
            serviceId,
        };
        this.cache.set(key, cfg);
        return cfg;
    }
};
exports.BhashiniTranslationProvider = BhashiniTranslationProvider;
exports.BhashiniTranslationProvider = BhashiniTranslationProvider = BhashiniTranslationProvider_1 = __decorate([
    (0, common_1.Injectable)()
], BhashiniTranslationProvider);
//# sourceMappingURL=bhashini-translation-provider.js.map