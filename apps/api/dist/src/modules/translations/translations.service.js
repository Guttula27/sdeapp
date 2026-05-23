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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var TranslationsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.TranslationsService = exports.SOURCE_LANGUAGE = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../config/prisma/prisma.service");
const translation_provider_1 = require("./translation-provider");
exports.SOURCE_LANGUAGE = 'en';
let TranslationsService = TranslationsService_1 = class TranslationsService {
    constructor(prisma, provider) {
        this.prisma = prisma;
        this.provider = provider;
        this.logger = new common_1.Logger(TranslationsService_1.name);
    }
    async enabledLanguages() {
        const rows = await this.prisma.language.findMany({
            where: { isEnabled: true },
            select: { code: true },
        });
        return rows.map((r) => r.code);
    }
    async upsertAll(entityType, entityId, fields) {
        const cleanFields = {};
        for (const [k, v] of Object.entries(fields)) {
            if (typeof v === 'string' && v.trim())
                cleanFields[k] = v;
        }
        if (Object.keys(cleanFields).length === 0)
            return;
        const languages = await this.enabledLanguages();
        const rows = [];
        const jobs = [];
        for (const [fieldName, sourceText] of Object.entries(cleanFields)) {
            for (const lang of languages) {
                jobs.push((async () => {
                    const value = lang === exports.SOURCE_LANGUAGE
                        ? sourceText
                        : await this.provider.translate(sourceText, exports.SOURCE_LANGUAGE, lang).catch((e) => {
                            this.logger.warn(`translate failed (${entityType}.${fieldName} → ${lang}): ${e.message}`);
                            return sourceText;
                        });
                    return { entityType, entityId, fieldName, languageCode: lang, value };
                })());
            }
        }
        rows.push(...(await Promise.all(jobs)));
        await this.prisma.$transaction(rows.map((r) => this.prisma.translation.upsert({
            where: {
                entityType_entityId_fieldName_languageCode: {
                    entityType: r.entityType,
                    entityId: r.entityId,
                    fieldName: r.fieldName,
                    languageCode: r.languageCode,
                },
            },
            update: { value: r.value, source: 'auto' },
            create: r,
        })));
    }
    async deleteAll(entityType, entityId) {
        await this.prisma.translation.deleteMany({ where: { entityType, entityId } });
    }
    async lookup(entityType, entityIds, languageCode) {
        const map = new Map();
        if (entityIds.length === 0 || !languageCode)
            return map;
        const rows = await this.prisma.translation.findMany({
            where: { entityType, entityId: { in: entityIds }, languageCode },
        });
        for (const r of rows) {
            const existing = map.get(r.entityId) ?? {};
            existing[r.fieldName] = r.value;
            map.set(r.entityId, existing);
        }
        return map;
    }
    async hydrate(entityType, rows, fields, languageCode) {
        if (!rows || !languageCode || languageCode === exports.SOURCE_LANGUAGE)
            return rows;
        const list = Array.isArray(rows) ? rows : [rows];
        if (list.length === 0)
            return rows;
        const ids = list.map((r) => r.id).filter(Boolean);
        const map = await this.lookup(entityType, ids, languageCode);
        for (const row of list) {
            const t = map.get(row.id);
            if (!t)
                continue;
            for (const f of fields) {
                if (t[f] != null)
                    row[f] = t[f];
            }
        }
        return rows;
    }
};
exports.TranslationsService = TranslationsService;
exports.TranslationsService = TranslationsService = TranslationsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(1, (0, common_1.Inject)(translation_provider_1.TRANSLATION_PROVIDER)),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService, Object])
], TranslationsService);
//# sourceMappingURL=translations.service.js.map