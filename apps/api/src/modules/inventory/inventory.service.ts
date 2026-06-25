import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
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
    // Push the (currentStock <= reorderLevel) predicate into MySQL so
    // we don't pull every material into Node and filter in JS — that
    // was O(N) on every dashboard refresh. Prisma's typed `where`
    // can't compare two columns of the same row, so this is the
    // straightforward raw-SQL form. The `Prisma.sql` template tag
    // keeps the businessId parameterised — no string interpolation
    // into the query body.
    return this.prisma.$queryRaw<
      Array<Prisma.MaterialGetPayload<Record<string, never>>>
    >(Prisma.sql`
      SELECT *
      FROM paynpik_materials
      WHERE businessId = ${businessId}
        AND reorderLevel IS NOT NULL
        AND currentStock <= reorderLevel
      ORDER BY name ASC
    `);
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
