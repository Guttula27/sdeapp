import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../config/prisma/prisma.service';

@Injectable()
export class InventoryService {
  constructor(private prisma: PrismaService) {}

  async getMaterials(businessId: string) {
    return this.prisma.material.findMany({
      where: { businessId },
      include: { category: true },
      orderBy: { name: 'asc' },
    });
  }

  async createMaterial(businessId: string, data: any) {
    return this.prisma.material.create({ data: { ...data, businessId } });
  }

  async updateStock(materialId: string, quantity: number, operation: 'ADD' | 'SUBTRACT') {
    const material = await this.prisma.material.findUnique({ where: { id: materialId } });
    if (!material) throw new NotFoundException('Material not found');

    const newStock = operation === 'ADD'
      ? Number(material.currentStock) + quantity
      : Number(material.currentStock) - quantity;

    return this.prisma.material.update({
      where: { id: materialId },
      data: { currentStock: Math.max(0, newStock) },
    });
  }

  async logConsumption(materialId: string, data: { quantity: number; purpose?: string; issuedBy?: string }) {
    await this.updateStock(materialId, data.quantity, 'SUBTRACT');
    return this.prisma.consumptionLog.create({ data: { ...data, materialId } });
  }

  async getLowStockAlerts(businessId: string) {
    const materials = await this.prisma.material.findMany({ where: { businessId } });
    return materials.filter(
      (m) => m.reorderLevel && Number(m.currentStock) <= Number(m.reorderLevel),
    );
  }

  async getPurchaseOrders(businessId: string) {
    return this.prisma.purchaseOrder.findMany({
      where: { vendor: { businessId } },
      include: { vendor: true, material: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createPurchaseOrder(data: {
    vendorId: string;
    materialId: string;
    quantity: number;
    unitPrice: number;
  }) {
    const poNumber = `PO-${Date.now()}`;
    const totalAmount = data.quantity * data.unitPrice;
    return this.prisma.purchaseOrder.create({
      data: { ...data, poNumber, totalAmount },
      include: { vendor: true, material: true },
    });
  }

  async receivePurchaseOrder(poId: string) {
    const po = await this.prisma.purchaseOrder.findUnique({ where: { id: poId } });
    if (!po) throw new NotFoundException('PO not found');

    await Promise.all([
      this.prisma.purchaseOrder.update({ where: { id: poId }, data: { status: 'RECEIVED' } }),
      this.updateStock(po.materialId, Number(po.quantity), 'ADD'),
    ]);

    return { message: 'Stock updated successfully' };
  }
}
