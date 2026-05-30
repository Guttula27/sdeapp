import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../config/prisma/prisma.service';

@Injectable()
export class ServiceStationsService {
  constructor(private prisma: PrismaService) {}

  list(outletId: string) {
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

  async create(outletId: string, data: { name: string; tableTypeId?: string | null; isParcelStation?: boolean }) {
    const isParcel = !!data.isParcelStation;
    if (!isParcel && data.tableTypeId) {
      const tt = await this.prisma.tableType.findUnique({ where: { id: data.tableTypeId } });
      if (!tt || tt.outletId !== outletId) {
        throw new BadRequestException('Table type does not belong to this outlet');
      }
    }
    return this.prisma.serviceStation.create({
      data: {
        name: data.name.trim(),
        outletId,
        // Parcel stations don't bind to a table type — they handle every
        // isParcel order routed to this outlet.
        tableTypeId: isParcel ? null : (data.tableTypeId ?? null),
        isParcelStation: isParcel,
      },
      include: {
        tableType: { select: { id: true, name: true, color: true } },
        workers: { include: { user: { select: { id: true, name: true, phone: true } } } },
        tables: { include: { table: true } },
      },
    });
  }

  async update(id: string, data: { name?: string; tableTypeId?: string | null; isParcelStation?: boolean }) {
    const station = await this.prisma.serviceStation.findUnique({ where: { id } });
    if (!station) throw new NotFoundException('Service station not found');
    const becomingParcel = data.isParcelStation === true;
    if (!becomingParcel && data.tableTypeId !== undefined && data.tableTypeId !== null) {
      const tt = await this.prisma.tableType.findUnique({ where: { id: data.tableTypeId } });
      if (!tt || tt.outletId !== station.outletId) {
        throw new BadRequestException('Table type does not belong to this outlet');
      }
      // Changing the table type invalidates any previously-assigned tables;
      // drop them so the admin re-selects from the new pool.
      await this.prisma.serviceStationTable.deleteMany({ where: { stationId: id } });
    }
    if (becomingParcel) {
      // Switching to a parcel station: detach tables/section since parcel
      // stations aren't table-bound.
      await this.prisma.serviceStationTable.deleteMany({ where: { stationId: id } });
    }
    return this.prisma.serviceStation.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name.trim() } : {}),
        ...(data.isParcelStation !== undefined ? { isParcelStation: data.isParcelStation } : {}),
        ...(becomingParcel
          ? { tableTypeId: null }
          : data.tableTypeId !== undefined ? { tableTypeId: data.tableTypeId } : {}),
      },
      include: {
        tableType: { select: { id: true, name: true, color: true } },
        workers: { include: { user: { select: { id: true, name: true, phone: true } } } },
        tables: { include: { table: true } },
      },
    });
  }

  async remove(id: string) {
    const station = await this.prisma.serviceStation.findUnique({ where: { id } });
    if (!station) throw new NotFoundException('Service station not found');
    return this.prisma.serviceStation.update({
      where: { id },
      data: { isActive: false },
    });
  }

  /** Replace the full list of workers assigned to this station. */
  async setWorkers(stationId: string, userIds: string[]) {
    const station = await this.prisma.serviceStation.findUnique({ where: { id: stationId } });
    if (!station) throw new NotFoundException('Service station not found');

    // Validate every user belongs to this outlet.
    if (userIds.length) {
      const valid = await this.prisma.user.count({
        where: { id: { in: userIds }, outletId: station.outletId, status: 'ACTIVE' },
      });
      if (valid !== userIds.length) {
        throw new BadRequestException('One or more users do not belong to this outlet');
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

  /** Replace the list of tables assigned to this station (must belong to its tableType). */
  async setTables(stationId: string, tableIds: string[]) {
    const station = await this.prisma.serviceStation.findUnique({ where: { id: stationId } });
    if (!station) throw new NotFoundException('Service station not found');

    if (tableIds.length) {
      const valid = await this.prisma.table.findMany({
        where: { id: { in: tableIds }, outletId: station.outletId },
        select: { id: true, tableTypeId: true },
      });
      if (valid.length !== tableIds.length) {
        throw new BadRequestException('One or more tables do not belong to this outlet');
      }
      if (station.tableTypeId) {
        const wrong = valid.filter((t) => t.tableTypeId !== station.tableTypeId);
        if (wrong.length) {
          throw new BadRequestException(
            'All assigned tables must belong to the station\'s table type',
          );
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

  /** Outlet's tables for a given tableType — UI uses this to drive the table picker. */
  listTablesForType(outletId: string, tableTypeId: string) {
    return this.prisma.table.findMany({
      where: { outletId, tableTypeId, isActive: true },
      orderBy: [{ sectionId: 'asc' }, { number: 'asc' }],
      include: { section: { select: { id: true, name: true } } },
    });
  }

  listOutletStaff(outletId: string) {
    return this.prisma.user.findMany({
      where: { outletId, status: 'ACTIVE' },
      select: { id: true, name: true, phone: true, role: { select: { name: true } } },
      orderBy: { name: 'asc' },
    });
  }

  /** All stations the given user is assigned to at this outlet. */
  mine(outletId: string, userId: string) {
    return this.prisma.serviceStation.findMany({
      where: { outletId, isActive: true, workers: { some: { userId } } },
      include: {
        tableType: { select: { id: true, name: true, color: true } },
        tables: { include: { table: { select: { id: true, number: true } } } },
      },
    });
  }

  /**
   * Is there an *active* parcel station at this outlet — i.e. one flagged
   * isParcelStation=true with at least one assigned worker. The orders
   * service consults this to decide whether parcel orders go through the
   * dedicated parcel queue or fall back to the regular service queue.
   */
  async hasActiveParcelStation(outletId: string): Promise<boolean> {
    const count = await this.prisma.serviceStation.count({
      where: {
        outletId,
        isActive: true,
        isParcelStation: true,
        workers: { some: {} },
      },
    });
    return count > 0;
  }
}
