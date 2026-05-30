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
exports.QrService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../config/prisma/prisma.service");
const QRCode = require("qrcode");
const uuid_1 = require("uuid");
const client_1 = require("@prisma/client");
let QrService = class QrService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async resolveQrDestination(customerUrl, outletId, tableId, qrCode) {
        const membership = await this.prisma.clusterMember.findUnique({
            where: { outletId },
            select: { clusterBusiness: { select: { publicCode: true } } },
        });
        const base = customerUrl.replace(/\/$/, '');
        if (membership?.clusterBusiness?.publicCode) {
            const params = new URLSearchParams({
                outletId,
                qr: qrCode,
                ...(tableId ? { tableId } : {}),
            });
            return `${base}/cluster/${membership.clusterBusiness.publicCode}?${params.toString()}`;
        }
        const params = new URLSearchParams({
            outlet: outletId,
            qr: qrCode,
            ...(tableId ? { table: tableId } : {}),
        });
        return `${base}/order?${params.toString()}`;
    }
    async generateTableQR(tableId, outletId, customerUrl) {
        const code = (0, uuid_1.v4)();
        const url = await this.resolveQrDestination(customerUrl, outletId, tableId, code);
        const imageUrl = await QRCode.toDataURL(url);
        const qr = await this.prisma.qRCode.upsert({
            where: { tableId },
            create: { type: client_1.QRType.TABLE, code, imageUrl, outletId, tableId },
            update: { code, imageUrl },
        });
        return { ...qr, url };
    }
    async generateOutletQR(outletId, customerUrl) {
        const code = (0, uuid_1.v4)();
        const url = await this.resolveQrDestination(customerUrl, outletId, undefined, code);
        const imageUrl = await QRCode.toDataURL(url);
        return this.prisma.qRCode.create({
            data: { type: client_1.QRType.OUTLET, code, imageUrl, outletId },
        });
    }
    async validateQR(code) {
        const qr = await this.prisma.qRCode.findUnique({
            where: { code },
            include: { outlet: true, table: true },
        });
        if (!qr || !qr.isActive)
            return null;
        return qr;
    }
    async getOutletQRs(outletId) {
        return this.prisma.qRCode.findMany({ where: { outletId }, include: { table: true } });
    }
};
exports.QrService = QrService;
exports.QrService = QrService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], QrService);
//# sourceMappingURL=qr.service.js.map