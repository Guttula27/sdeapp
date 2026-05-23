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
exports.ServiceStationsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../config/prisma/prisma.service");
let ServiceStationsService = class ServiceStationsService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    list(outletId) {
        return this.prisma.serviceStation.findMany({
            where: { outletId, isActive: true },
            orderBy: { createdAt: 'asc' },
            include: {
                tableType: { select: { id: true, name: true, color: true } },
                workers: {
                    include: { user: { select: { id: true, name: true, phone: true, role: { select: { name: true } } } } },
                },
                tables: {
                    include: { table: { select: { id: true, number: true, sectionId: true, tableTypeId: true } } },
                },
            },
        });
    }
    async create(outletId, data) {
        if (data.tableTypeId) {
            const tt = await this.prisma.tableType.findUnique({ where: { id: data.tableTypeId } });
            if (!tt || tt.outletId !== outletId) {
                throw new common_1.BadRequestException('Table type does not belong to this outlet');
            }
        }
        return this.prisma.serviceStation.create({
            data: { name: data.name.trim(), outletId, tableTypeId: data.tableTypeId ?? null },
            include: {
                tableType: { select: { id: true, name: true, color: true } },
                workers: { include: { user: { select: { id: true, name: true, phone: true } } } },
                tables: { include: { table: true } },
            },
        });
    }
    async update(id, data) {
        const station = await this.prisma.serviceStation.findUnique({ where: { id } });
        if (!station)
            throw new common_1.NotFoundException('Service station not found');
        if (data.tableTypeId !== undefined && data.tableTypeId !== null) {
            const tt = await this.prisma.tableType.findUnique({ where: { id: data.tableTypeId } });
            if (!tt || tt.outletId !== station.outletId) {
                throw new common_1.BadRequestException('Table type does not belong to this outlet');
            }
            await this.prisma.serviceStationTable.deleteMany({ where: { stationId: id } });
        }
        return this.prisma.serviceStation.update({
            where: { id },
            data: {
                ...(data.name !== undefined ? { name: data.name.trim() } : {}),
                ...(data.tableTypeId !== undefined ? { tableTypeId: data.tableTypeId } : {}),
            },
            include: {
                tableType: { select: { id: true, name: true, color: true } },
                workers: { include: { user: { select: { id: true, name: true, phone: true } } } },
                tables: { include: { table: true } },
            },
        });
    }
    async remove(id) {
        const station = await this.prisma.serviceStation.findUnique({ where: { id } });
        if (!station)
            throw new common_1.NotFoundException('Service station not found');
        return this.prisma.serviceStation.update({
            where: { id },
            data: { isActive: false },
        });
    }
    async setWorkers(stationId, userIds) {
        const station = await this.prisma.serviceStation.findUnique({ where: { id: stationId } });
        if (!station)
            throw new common_1.NotFoundException('Service station not found');
        if (userIds.length) {
            const valid = await this.prisma.user.count({
                where: { id: { in: userIds }, outletId: station.outletId, status: 'ACTIVE' },
            });
            if (valid !== userIds.length) {
                throw new common_1.BadRequestException('One or more users do not belong to this outlet');
            }
        }
        await this.prisma.$transaction([
            this.prisma.serviceStationWorker.deleteMany({ where: { stationId } }),
            ...(userIds.length
                ? [this.prisma.serviceStationWorker.createMany({
                        data: userIds.map((userId) => ({ stationId, userId })),
                        skipDuplicates: true,
                    })]
                : []),
        ]);
        return this.list(station.outletId).then((all) => all.find((s) => s.id === stationId));
    }
    async setTables(stationId, tableIds) {
        const station = await this.prisma.serviceStation.findUnique({ where: { id: stationId } });
        if (!station)
            throw new common_1.NotFoundException('Service station not found');
        if (tableIds.length) {
            const valid = await this.prisma.table.findMany({
                where: { id: { in: tableIds }, outletId: station.outletId },
                select: { id: true, tableTypeId: true },
            });
            if (valid.length !== tableIds.length) {
                throw new common_1.BadRequestException('One or more tables do not belong to this outlet');
            }
            if (station.tableTypeId) {
                const wrong = valid.filter((t) => t.tableTypeId !== station.tableTypeId);
                if (wrong.length) {
                    throw new common_1.BadRequestException('All assigned tables must belong to the station\'s table type');
                }
            }
        }
        await this.prisma.$transaction([
            this.prisma.serviceStationTable.deleteMany({ where: { stationId } }),
            ...(tableIds.length
                ? [this.prisma.serviceStationTable.createMany({
                        data: tableIds.map((tableId) => ({ stationId, tableId })),
                        skipDuplicates: true,
                    })]
                : []),
        ]);
        return this.list(station.outletId).then((all) => all.find((s) => s.id === stationId));
    }
    listTablesForType(outletId, tableTypeId) {
        return this.prisma.table.findMany({
            where: { outletId, tableTypeId, isActive: true },
            orderBy: [{ sectionId: 'asc' }, { number: 'asc' }],
            include: { section: { select: { id: true, name: true } } },
        });
    }
    listOutletStaff(outletId) {
        return this.prisma.user.findMany({
            where: { outletId, status: 'ACTIVE' },
            select: { id: true, name: true, phone: true, role: { select: { name: true } } },
            orderBy: { name: 'asc' },
        });
    }
    mine(outletId, userId) {
        return this.prisma.serviceStation.findMany({
            where: { outletId, isActive: true, workers: { some: { userId } } },
            include: {
                tableType: { select: { id: true, name: true, color: true } },
                tables: { include: { table: { select: { id: true, number: true } } } },
            },
        });
    }
};
exports.ServiceStationsService = ServiceStationsService;
exports.ServiceStationsService = ServiceStationsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], ServiceStationsService);
//# sourceMappingURL=service-stations.service.js.map