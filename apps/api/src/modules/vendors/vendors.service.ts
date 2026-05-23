import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../config/prisma/prisma.service';

@Injectable()
export class VendorsService {
  constructor(private prisma: PrismaService) {}

  async findAll(businessId: string, search?: string) {
    const where = {
      businessId,
      // MySQL's utf8mb4_unicode_ci collation makes LIKE comparisons
      // case-insensitive by default, so no `mode` clause is needed (Prisma
      // doesn't accept `mode` on the MySQL connector).
      ...(search && {
        OR: [
          { name:      { contains: search } },
          { phone:     { contains: search } },
          { email:     { contains: search } },
          { gstNumber: { contains: search } },
        ],
      }),
    };

    const [vendors, total] = await Promise.all([
      this.prisma.vendor.findMany({
        where,
        orderBy: { name: 'asc' },
        include: {
          _count: { select: { purchaseOrders: true } },
        },
      }),
      this.prisma.vendor.count({ where }),
    ]);

    return { vendors, total };
  }

  async findOne(id: string) {
    const vendor = await this.prisma.vendor.findUnique({
      where: { id },
      include: {
        purchaseOrders: {
          include: { material: { select: { id: true, name: true, unit: true } } },
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
        _count: { select: { purchaseOrders: true } },
      },
    });
    if (!vendor) throw new NotFoundException('Vendor not found');
    return vendor;
  }

  async create(businessId: string, data: {
    name: string;
    gstNumber?: string;
    phone?: string;
    email?: string;
    address?: string;
  }) {
    return this.prisma.vendor.create({
      data: { ...data, businessId },
    });
  }

  async update(id: string, data: {
    name?: string;
    gstNumber?: string;
    phone?: string;
    email?: string;
    address?: string;
  }) {
    const vendor = await this.prisma.vendor.findUnique({ where: { id } });
    if (!vendor) throw new NotFoundException('Vendor not found');
    return this.prisma.vendor.update({ where: { id }, data });
  }

  async toggleStatus(id: string) {
    const vendor = await this.prisma.vendor.findUnique({ where: { id } });
    if (!vendor) throw new NotFoundException('Vendor not found');
    return this.prisma.vendor.update({
      where: { id },
      data: { isActive: !vendor.isActive },
    });
  }

  async remove(id: string) {
    const vendor = await this.prisma.vendor.findUnique({
      where: { id },
      include: { _count: { select: { purchaseOrders: true } } },
    });
    if (!vendor) throw new NotFoundException('Vendor not found');
    if (vendor._count.purchaseOrders > 0) {
      throw new ConflictException(
        `Cannot delete vendor with ${vendor._count.purchaseOrders} purchase order(s). Deactivate instead.`,
      );
    }
    await this.prisma.vendor.delete({ where: { id } });
    return { message: 'Vendor deleted' };
  }

  async getStats(businessId: string) {
    const [total, active, pos] = await Promise.all([
      this.prisma.vendor.count({ where: { businessId } }),
      this.prisma.vendor.count({ where: { businessId, isActive: true } }),
      this.prisma.purchaseOrder.aggregate({
        where: { vendor: { businessId } },
        _sum: { totalAmount: true },
        _count: { id: true },
      }),
    ]);

    const topVendors = await this.prisma.purchaseOrder.groupBy({
      by: ['vendorId'],
      where: { vendor: { businessId } },
      _sum: { totalAmount: true },
      _count: { id: true },
      orderBy: { _sum: { totalAmount: 'desc' } },
      take: 5,
    });

    return {
      totalVendors: total,
      activeVendors: active,
      totalPOs: pos._count.id,
      totalSpend: pos._sum.totalAmount || 0,
      topVendors,
    };
  }
}
