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
exports.IntegrationsService = exports.UpsertIntegrationDto = void 0;
const common_1 = require("@nestjs/common");
const class_validator_1 = require("class-validator");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../../config/prisma/prisma.service");
class UpsertIntegrationDto {
}
exports.UpsertIntegrationDto = UpsertIntegrationDto;
__decorate([
    (0, class_validator_1.IsEnum)(client_1.IntegrationChannel),
    __metadata("design:type", String)
], UpsertIntegrationDto.prototype, "channel", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpsertIntegrationDto.prototype, "providerKey", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpsertIntegrationDto.prototype, "providerName", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], UpsertIntegrationDto.prototype, "isDefault", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], UpsertIntegrationDto.prototype, "isActive", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], UpsertIntegrationDto.prototype, "config", void 0);
let IntegrationsService = class IntegrationsService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    list(channel) {
        return this.prisma.integrationConfig.findMany({
            where: channel ? { channel } : undefined,
            orderBy: [{ channel: 'asc' }, { isDefault: 'desc' }, { providerName: 'asc' }],
        });
    }
    async upsert(dto) {
        const { channel, providerKey, providerName, isDefault, isActive, config } = dto;
        return this.prisma.$transaction(async (tx) => {
            if (isDefault) {
                await tx.integrationConfig.updateMany({
                    where: { channel, isDefault: true, NOT: { providerKey } },
                    data: { isDefault: false },
                });
            }
            return tx.integrationConfig.upsert({
                where: { channel_providerKey: { channel, providerKey } },
                create: {
                    channel,
                    providerKey,
                    providerName,
                    isDefault: !!isDefault,
                    isActive: isActive ?? true,
                    config: config ?? {},
                },
                update: {
                    providerName,
                    ...(isDefault !== undefined ? { isDefault } : {}),
                    ...(isActive !== undefined ? { isActive } : {}),
                    ...(config !== undefined ? { config } : {}),
                },
            });
        });
    }
    async remove(id) {
        const existing = await this.prisma.integrationConfig.findUnique({ where: { id } });
        if (!existing)
            throw new common_1.NotFoundException('Integration not found');
        if (existing.isDefault) {
            throw new common_1.BadRequestException('Cannot delete the default provider. Mark another as default first.');
        }
        return this.prisma.integrationConfig.delete({ where: { id } });
    }
    async setDefault(id) {
        const existing = await this.prisma.integrationConfig.findUnique({ where: { id } });
        if (!existing)
            throw new common_1.NotFoundException('Integration not found');
        return this.prisma.$transaction(async (tx) => {
            await tx.integrationConfig.updateMany({
                where: { channel: existing.channel, isDefault: true, NOT: { id } },
                data: { isDefault: false },
            });
            return tx.integrationConfig.update({ where: { id }, data: { isDefault: true } });
        });
    }
    async activePaymentGateway() {
        const provider = await this.prisma.integrationConfig.findFirst({
            where: { channel: 'PAYMENT_GATEWAY', isActive: true, isDefault: true },
            select: { providerKey: true, providerName: true, config: true },
        });
        if (!provider)
            return null;
        const cfg = provider.config || {};
        const charges = cfg.charges || {};
        return {
            providerKey: provider.providerKey,
            providerName: provider.providerName,
            charges: {
                UPI: Number(charges.UPI ?? 0),
                DEBIT_CARD: Number(charges.DEBIT_CARD ?? 0),
                CREDIT_CARD: Number(charges.CREDIT_CARD ?? 0),
                NET_BANKING: Number(charges.NET_BANKING ?? 0),
                WALLET: Number(charges.WALLET ?? 0),
            },
        };
    }
};
exports.IntegrationsService = IntegrationsService;
exports.IntegrationsService = IntegrationsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], IntegrationsService);
//# sourceMappingURL=integrations.service.js.map