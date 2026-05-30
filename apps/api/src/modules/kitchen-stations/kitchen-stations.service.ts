import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../config/prisma/prisma.service';

@Injectable()
export class KitchenStationsService {
  constructor(private prisma: PrismaService) {}

  list(outletId: string) {
    return this.prisma.kitchenStation.findMany({
      where: { outletId, isActive: true },
      orderBy: { createdAt: 'asc' },
      include: {
        currentWorker: { select: { id: true, name: true, phone: true } },
        items: { select: { id: true, name: true } },
        printer: { select: { id: true, name: true, connection: true, address: true } },
      },
    });
  }

  create(outletId: string, data: { name: string }) {
    return this.prisma.kitchenStation.create({
      data: { name: data.name, outletId },
      include: { currentWorker: { select: { id: true, name: true, phone: true } } },
    });
  }

  async update(
    id: string,
    data: { name?: string; currentWorkerId?: string | null; isMaster?: boolean; printerId?: string | null },
  ) {
    const station = await this.prisma.kitchenStation.findUnique({ where: { id } });
    if (!station) throw new NotFoundException('Station not found');
    return this.prisma.kitchenStation.update({
      where: { id },
      data,
      include: {
        currentWorker: { select: { id: true, name: true, phone: true } },
        items: { select: { id: true, name: true } },
        printer: { select: { id: true, name: true, connection: true, address: true } },
      },
    });
  }

  async delete(id: string) {
    await this.prisma.item.updateMany({
      where: { kitchenStationId: id },
      data: { kitchenStationId: null },
    });
    return this.prisma.kitchenStation.update({
      where: { id },
      data: { isActive: false, currentWorkerId: null },
    });
  }

  async setItems(stationId: string, itemIds: string[]) {
    const station = await this.prisma.kitchenStation.findUnique({ where: { id: stationId } });
    if (!station) throw new NotFoundException('Station not found');
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

  findMine(outletId: string, userId: string) {
    return this.prisma.kitchenStation.findFirst({
      where: { outletId, isActive: true, currentWorkerId: userId },
      include: { items: { select: { id: true, name: true } } },
    });
  }

  listOutletStaff(outletId: string) {
    return this.prisma.user.findMany({
      where: { outletId, status: 'ACTIVE' },
      select: { id: true, name: true, phone: true, role: { select: { name: true } } },
      orderBy: { name: 'asc' },
    });
  }
}
