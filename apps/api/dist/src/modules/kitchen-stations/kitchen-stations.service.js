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
exports.KitchenStationsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../config/prisma/prisma.service");
let KitchenStationsService = class KitchenStationsService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    list(outletId) {
        return this.prisma.kitchenStation.findMany({
            where: { outletId, isActive: true },
            orderBy: { createdAt: 'asc' },
            include: {
                currentWorker: { select: { id: true, name: true, phone: true } },
                items: { select: { id: true, name: true } },
            },
        });
    }
    create(outletId, data) {
        return this.prisma.kitchenStation.create({
            data: { name: data.name, outletId },
            include: { currentWorker: { select: { id: true, name: true, phone: true } } },
        });
    }
    async update(id, data) {
        const station = await this.prisma.kitchenStation.findUnique({ where: { id } });
        if (!station)
            throw new common_1.NotFoundException('Station not found');
        return this.prisma.kitchenStation.update({
            where: { id },
            data,
            include: {
                currentWorker: { select: { id: true, name: true, phone: true } },
                items: { select: { id: true, name: true } },
            },
        });
    }
    async delete(id) {
        await this.prisma.item.updateMany({
            where: { kitchenStationId: id },
            data: { kitchenStationId: null },
        });
        return this.prisma.kitchenStation.update({
            where: { id },
            data: { isActive: false, currentWorkerId: null },
        });
    }
    async setItems(stationId, itemIds) {
        const station = await this.prisma.kitchenStation.findUnique({ where: { id: stationId } });
        if (!station)
            throw new common_1.NotFoundException('Station not found');
        await this.prisma.$transaction([
            this.prisma.item.updateMany({
                where: { kitchenStationId: stationId, id: { notIn: itemIds } },
                data: { kitchenStationId: null },
            }),
            this.prisma.item.updateMany({
                where: { id: { in: itemIds } },
                data: { kitchenStationId: stationId },
            }),
        ]);
        return this.prisma.kitchenStation.findUnique({
            where: { id: stationId },
            include: {
                currentWorker: { select: { id: true, name: true, phone: true } },
                items: { select: { id: true, name: true } },
            },
        });
    }
    findMine(outletId, userId) {
        return this.prisma.kitchenStation.findFirst({
            where: { outletId, isActive: true, currentWorkerId: userId },
            include: { items: { select: { id: true, name: true } } },
        });
    }
    listOutletStaff(outletId) {
        return this.prisma.user.findMany({
            where: { outletId, status: 'ACTIVE' },
            select: { id: true, name: true, phone: true, role: { select: { name: true } } },
            orderBy: { name: 'asc' },
        });
    }
};
exports.KitchenStationsService = KitchenStationsService;
exports.KitchenStationsService = KitchenStationsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], KitchenStationsService);
//# sourceMappingURL=kitchen-stations.service.js.map