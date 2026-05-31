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
exports.LeadsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../config/prisma/prisma.service");
let LeadsService = class LeadsService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    create(data) {
        return this.prisma.lead.create({
            data: { ...data, source: data.source || 'landing-page' },
        });
    }
    findAll(status, take, skip) {
        const t = Number.isFinite(Number(take)) ? Number(take) : 50;
        const s = Number.isFinite(Number(skip)) ? Number(skip) : 0;
        const where = status ? { status: status } : {};
        return this.prisma.lead.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            take: t,
            skip: s,
        });
    }
    async findOne(id) {
        const lead = await this.prisma.lead.findUnique({ where: { id } });
        if (!lead)
            throw new common_1.NotFoundException('Lead not found');
        return lead;
    }
    async updateStatus(id, status, notes) {
        await this.findOne(id);
        return this.prisma.lead.update({
            where: { id },
            data: { status: status, ...(notes !== undefined && { notes }) },
        });
    }
    async stats() {
        const [total, byStatus] = await Promise.all([
            this.prisma.lead.count(),
            this.prisma.lead.groupBy({ by: ['status'], _count: { id: true } }),
        ]);
        return {
            total,
            byStatus: byStatus.reduce((acc, r) => {
                acc[r.status] = r._count.id;
                return acc;
            }, {}),
        };
    }
};
exports.LeadsService = LeadsService;
exports.LeadsService = LeadsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], LeadsService);
//# sourceMappingURL=leads.service.js.map