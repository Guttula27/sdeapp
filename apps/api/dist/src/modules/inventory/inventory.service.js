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
exports.InventoryService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../config/prisma/prisma.service");
let InventoryService = class InventoryService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async getMaterials(businessId) {
        return this.prisma.material.findMany({
            where: { businessId },
            include: { category: true },
            orderBy: { name: 'asc' },
        });
    }
    async createMaterial(businessId, data) {
        return this.prisma.material.create({ data: { ...data, businessId } });
    }
    async updateStock(materialId, quantity, operation) {
        const material = await this.prisma.material.findUnique({ where: { id: materialId } });
        if (!material)
            throw new common_1.NotFoundException('Material not found');
        const newStock = operation === 'ADD'
            ? Number(material.currentStock) + quantity
            : Number(material.currentStock) - quantity;
        return this.prisma.material.update({
            where: { id: materialId },
            data: { currentStock: Math.max(0, newStock) },
        });
    }
    async logConsumption(materialId, data) {
        await this.updateStock(materialId, data.quantity, 'SUBTRACT');
        return this.prisma.consumptionLog.create({ data: { ...data, materialId } });
    }
    async getLowStockAlerts(businessId) {
        const materials = await this.prisma.material.findMany({ where: { businessId } });
        return materials.filter((m) => m.reorderLevel && Number(m.currentStock) <= Number(m.reorderLevel));
    }
    async getPurchaseOrders(businessId) {
        return this.prisma.purchaseOrder.findMany({
            where: { vendor: { businessId } },
            include: { vendor: true, material: true },
            orderBy: { createdAt: 'desc' },
        });
    }
    async createPurchaseOrder(data) {
        const poNumber = `PO-${Date.now()}`;
        const totalAmount = data.quantity * data.unitPrice;
        return this.prisma.purchaseOrder.create({
            data: { ...data, poNumber, totalAmount },
            include: { vendor: true, material: true },
        });
    }
    async receivePurchaseOrder(poId) {
        const po = await this.prisma.purchaseOrder.findUnique({ where: { id: poId } });
        if (!po)
            throw new common_1.NotFoundException('PO not found');
        await Promise.all([
            this.prisma.purchaseOrder.update({ where: { id: poId }, data: { status: 'RECEIVED' } }),
            this.updateStock(po.materialId, Number(po.quantity), 'ADD'),
        ]);
        return { message: 'Stock updated successfully' };
    }
};
exports.InventoryService = InventoryService;
exports.InventoryService = InventoryService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], InventoryService);
//# sourceMappingURL=inventory.service.js.map