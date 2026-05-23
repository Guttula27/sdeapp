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
Object.defineProperty(exports, "__esModule", { value: true });
exports.LanguagesService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../config/prisma/prisma.service");
const scope_1 = require("../../common/permissions/scope");
let LanguagesService = class LanguagesService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    assertPlatform(user) {
        if ((0, scope_1.scopeFor)(user).kind !== 'platform') {
            throw new common_1.ForbiddenException('Only platform admins can manage languages');
        }
    }
    listEnabled() {
        return this.prisma.language.findMany({
            where: { isEnabled: true },
            orderBy: { code: 'asc' },
        });
    }
    listAll(user) {
        this.assertPlatform(user);
        return this.prisma.language.findMany({ orderBy: { code: 'asc' } });
    }
    async create(user, dto) {
        this.assertPlatform(user);
        const code = (dto.code || '').trim().toLowerCase();
        if (!/^[a-z]{2,3}(-[a-z]{2,4})?$/i.test(code)) {
            throw new common_1.BadRequestException('Code must be an ISO 639-1/3 code, optionally with a region (e.g. "hi" or "pt-BR")');
        }
        if (!dto.name?.trim() || !dto.nativeName?.trim()) {
            throw new common_1.BadRequestException('Name and native name are required');
        }
        const existing = await this.prisma.language.findUnique({ where: { code } });
        if (existing)
            throw new common_1.ConflictException('Language already exists');
        return this.prisma.language.create({
            data: {
                code,
                name: dto.name.trim(),
                nativeName: dto.nativeName.trim(),
                isEnabled: dto.isEnabled ?? true,
            },
        });
    }
    async update(user, code, dto) {
        this.assertPlatform(user);
        const existing = await this.prisma.language.findUnique({ where: { code } });
        if (!existing)
            throw new common_1.NotFoundException('Language not found');
        return this.prisma.language.update({
            where: { code },
            data: {
                name: dto.name?.trim() ?? existing.name,
                nativeName: dto.nativeName?.trim() ?? existing.nativeName,
                isEnabled: dto.isEnabled ?? existing.isEnabled,
            },
        });
    }
    async remove(user, code) {
        this.assertPlatform(user);
        if (code === 'en')
            throw new common_1.BadRequestException('The source language (English) cannot be removed');
        const existing = await this.prisma.language.findUnique({ where: { code } });
        if (!existing)
            throw new common_1.NotFoundException('Language not found');
        await this.prisma.language.delete({ where: { code } });
        return { message: 'Language deleted' };
    }
};
exports.LanguagesService = LanguagesService;
exports.LanguagesService = LanguagesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], LanguagesService);
//# sourceMappingURL=languages.service.js.map