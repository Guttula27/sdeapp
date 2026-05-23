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
exports.MessageTemplatesService = exports.ApproveProviderDto = exports.RejectTemplateDto = exports.UpsertTemplateDto = void 0;
const common_1 = require("@nestjs/common");
const class_validator_1 = require("class-validator");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../../config/prisma/prisma.service");
class UpsertTemplateDto {
}
exports.UpsertTemplateDto = UpsertTemplateDto;
__decorate([
    (0, class_validator_1.IsEnum)(client_1.TemplateChannel),
    __metadata("design:type", String)
], UpsertTemplateDto.prototype, "channel", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpsertTemplateDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpsertTemplateDto.prototype, "body", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(client_1.TemplateCategory),
    __metadata("design:type", String)
], UpsertTemplateDto.prototype, "category", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpsertTemplateDto.prototype, "trigger", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpsertTemplateDto.prototype, "language", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(client_1.TemplateScope),
    __metadata("design:type", String)
], UpsertTemplateDto.prototype, "scope", void 0);
class RejectTemplateDto {
}
exports.RejectTemplateDto = RejectTemplateDto;
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], RejectTemplateDto.prototype, "reason", void 0);
class ApproveProviderDto {
}
exports.ApproveProviderDto = ApproveProviderDto;
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ApproveProviderDto.prototype, "providerKey", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ApproveProviderDto.prototype, "providerTemplateId", void 0);
const VAR_RE = /\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g;
function extractVariables(body) {
    const set = new Set();
    let m;
    while ((m = VAR_RE.exec(body)) !== null)
        set.add(m[1]);
    return [...set];
}
let MessageTemplatesService = class MessageTemplatesService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    scopeForCaller(caller, requested) {
        if (requested === client_1.TemplateScope.PLATFORM) {
            if (caller.businessId || caller.outletId) {
                throw new common_1.ForbiddenException('Only platform admin can create PLATFORM templates');
            }
            return { scope: 'PLATFORM', businessId: null, outletId: null };
        }
        if (caller.outletId)
            return { scope: 'OUTLET', businessId: caller.businessId ?? null, outletId: caller.outletId };
        if (caller.businessId)
            return { scope: 'BUSINESS', businessId: caller.businessId, outletId: null };
        return { scope: 'PLATFORM', businessId: null, outletId: null };
    }
    list(caller, opts = {}) {
        const where = {};
        if (opts.channel)
            where.channel = opts.channel;
        if (opts.status)
            where.approvalStatus = opts.status;
        const scopeFilter = [{ scope: 'PLATFORM' }];
        if (caller.businessId)
            scopeFilter.push({ scope: 'BUSINESS', businessId: caller.businessId });
        if (caller.outletId)
            scopeFilter.push({ scope: 'OUTLET', outletId: caller.outletId });
        if (!caller.businessId && !caller.outletId) {
        }
        else {
            where.OR = scopeFilter;
        }
        if (opts.scope)
            where.scope = opts.scope;
        return this.prisma.messageTemplate.findMany({
            where,
            orderBy: [{ updatedAt: 'desc' }],
        });
    }
    pendingQueue() {
        return this.prisma.messageTemplate.findMany({
            where: { approvalStatus: { in: ['PENDING_PLATFORM', 'PENDING_PROVIDER'] } },
            orderBy: [{ submittedAt: 'asc' }],
            include: {
                business: { select: { id: true, name: true } },
                outlet: { select: { id: true, name: true } },
            },
        });
    }
    async create(caller, dto) {
        const scope = this.scopeForCaller(caller, dto.scope);
        if (!dto.name?.trim())
            throw new common_1.BadRequestException('Template name is required');
        if (!dto.body?.trim())
            throw new common_1.BadRequestException('Template body is required');
        const variables = extractVariables(dto.body);
        return this.prisma.messageTemplate.create({
            data: {
                scope: scope.scope,
                channel: dto.channel,
                name: dto.name.trim(),
                body: dto.body,
                category: dto.category ?? 'TRANSACTIONAL',
                trigger: dto.trigger,
                language: dto.language ?? 'en',
                variables,
                businessId: scope.businessId,
                outletId: scope.outletId,
                createdById: caller.id,
                approvalStatus: 'DRAFT',
            },
        });
    }
    async loadOwned(id, caller) {
        const t = await this.prisma.messageTemplate.findUnique({ where: { id } });
        if (!t)
            throw new common_1.NotFoundException('Template not found');
        const isPlatform = !caller.businessId && !caller.outletId;
        if (!isPlatform) {
            if (t.scope === 'OUTLET' && t.outletId !== caller.outletId) {
                throw new common_1.ForbiddenException();
            }
            if (t.scope === 'BUSINESS' && t.businessId !== caller.businessId) {
                throw new common_1.ForbiddenException();
            }
            if (t.scope === 'PLATFORM') {
                throw new common_1.ForbiddenException('Cannot modify platform templates');
            }
        }
        return t;
    }
    async update(id, caller, dto) {
        const t = await this.loadOwned(id, caller);
        if (t.approvalStatus === 'APPROVED' || t.approvalStatus === 'PENDING_PROVIDER') {
            throw new common_1.BadRequestException('Approved or provider-pending templates cannot be edited. Clone and resubmit instead.');
        }
        const newBody = dto.body ?? t.body;
        return this.prisma.messageTemplate.update({
            where: { id },
            data: {
                ...(dto.channel ? { channel: dto.channel } : {}),
                ...(dto.name ? { name: dto.name.trim() } : {}),
                ...(dto.body ? { body: dto.body, variables: extractVariables(newBody) } : {}),
                ...(dto.category ? { category: dto.category } : {}),
                ...(dto.trigger !== undefined ? { trigger: dto.trigger } : {}),
                ...(dto.language ? { language: dto.language } : {}),
                approvalStatus: 'DRAFT',
                rejectionReason: null,
                submittedAt: null,
                reviewedAt: null,
            },
        });
    }
    async remove(id, caller) {
        await this.loadOwned(id, caller);
        return this.prisma.messageTemplate.delete({ where: { id } });
    }
    async submit(id, caller) {
        const t = await this.loadOwned(id, caller);
        if (t.approvalStatus !== 'DRAFT' && t.approvalStatus !== 'REJECTED') {
            throw new common_1.BadRequestException('Only drafts or rejected templates can be submitted');
        }
        return this.prisma.messageTemplate.update({
            where: { id },
            data: {
                approvalStatus: 'PENDING_PLATFORM',
                submittedAt: new Date(),
                reviewedAt: null,
                rejectionReason: null,
            },
        });
    }
    async forwardToProvider(id, dto) {
        const t = await this.prisma.messageTemplate.findUnique({ where: { id } });
        if (!t)
            throw new common_1.NotFoundException('Template not found');
        if (t.approvalStatus !== 'PENDING_PLATFORM') {
            throw new common_1.BadRequestException('Only platform-pending templates can be forwarded');
        }
        return this.prisma.messageTemplate.update({
            where: { id },
            data: {
                approvalStatus: 'PENDING_PROVIDER',
                providerKey: dto.providerKey,
                providerTemplateId: dto.providerTemplateId ?? null,
                reviewedAt: new Date(),
                rejectionReason: null,
            },
        });
    }
    async markApproved(id, dto) {
        const t = await this.prisma.messageTemplate.findUnique({ where: { id } });
        if (!t)
            throw new common_1.NotFoundException('Template not found');
        if (t.approvalStatus === 'APPROVED')
            return t;
        return this.prisma.messageTemplate.update({
            where: { id },
            data: {
                approvalStatus: 'APPROVED',
                ...(dto.providerKey ? { providerKey: dto.providerKey } : {}),
                ...(dto.providerTemplateId ? { providerTemplateId: dto.providerTemplateId } : {}),
                reviewedAt: new Date(),
                rejectionReason: null,
            },
        });
    }
    async reject(id, dto) {
        const t = await this.prisma.messageTemplate.findUnique({ where: { id } });
        if (!t)
            throw new common_1.NotFoundException('Template not found');
        return this.prisma.messageTemplate.update({
            where: { id },
            data: {
                approvalStatus: 'REJECTED',
                rejectionReason: dto.reason,
                reviewedAt: new Date(),
            },
        });
    }
};
exports.MessageTemplatesService = MessageTemplatesService;
exports.MessageTemplatesService = MessageTemplatesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], MessageTemplatesService);
//# sourceMappingURL=message-templates.service.js.map