import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { IsBoolean, IsEnum, IsInt, IsNumber, IsOptional, IsString, ValidateIf } from 'class-validator';
import { PrismaService } from '../../config/prisma/prisma.service';
import { OutletType } from '@prisma/client';
import { TranslationsService } from '../translations/translations.service';
import { allowsSeating } from '../../common/outlet-type';

const DEFAULT_OUTLET_ADMIN_PASSWORD = 'abc@123';

// 8 random hex chars (16^8 ≈ 4B combinations) prefixed with OL-. Plenty
// of space for retries if uniqueness collides.
function generateOutletCode(): string {
  return 'OL-' + crypto.randomBytes(4).toString('hex').toUpperCase();
}

export class CreateOutletDto {
  @IsString() name!: string;
  @IsString() businessId!: string;
  @IsString() @IsOptional() facilityId?: string;
  @IsEnum(OutletType) outletType!: OutletType;
  @IsString() @IsOptional() address?: string;
  @IsString() @IsOptional() addressLine1?: string;
  @IsString() @IsOptional() addressLine2?: string;
  @IsString() @IsOptional() city?: string;
  @IsString() @IsOptional() state?: string;
  @IsString() @IsOptional() pincode?: string;
  @IsString() @IsOptional() country?: string;
  @IsString() @IsOptional() mapsLocation?: string;
  @IsString() @IsOptional() description?: string;
  @IsString() @IsOptional() phone?: string;
  @IsString() @IsOptional() gstNumber?: string;
  @IsString() @IsOptional() upiId?: string;
  @IsString() @IsOptional() logoUrl?: string;
  @IsString() @IsOptional() primaryImageUrl?: string;
  @IsInt() @IsOptional() defaultPrepTime?: number;
  @IsBoolean() @IsOptional() parcelChargeEnabled?: boolean;
  @IsNumber() @IsOptional() defaultParcelCharge?: number;
  @IsBoolean() @IsOptional() gstApplicable?: boolean;
  @IsNumber() @IsOptional() gstPercent?: number;
  @IsBoolean() @IsOptional() priceIncludesGst?: boolean;
  @IsBoolean() @IsOptional() multipleMenusEnabled?: boolean;
  @IsBoolean() @IsOptional() acceptRewardRedemption?: boolean;
  @IsBoolean() @IsOptional() kitchenAutoPrint?: boolean;
  @IsBoolean() @IsOptional() kitchenAllowManualPrint?: boolean;
  @IsString() @IsOptional() adminPhone?: string;
  @IsString() @IsOptional() adminName?: string;
}

export class CreateSectionDto {
  @IsString() name!: string;
}

export class CreateTableDto {
  @IsString() number!: string;
  @IsInt() capacity!: number;
  @ValidateIf((o) => o.sectionId != null) @IsString() sectionId?: string | null;
  @ValidateIf((o) => o.tableTypeId != null) @IsString() tableTypeId?: string | null;
}

@Injectable()
export class OutletsService {
  constructor(
    private prisma: PrismaService,
    private translations: TranslationsService,
  ) {}

  private translatableOutletFields(o: any): Record<string, string | null | undefined> {
    return {
      name: o.name,
      description: o.description,
      address: o.address,
      addressLine1: o.addressLine1,
      addressLine2: o.addressLine2,
    };
  }

  async create(data: CreateOutletDto) {
    const { adminPhone, adminName, ...outletData } = data;
    if (!adminPhone) throw new BadRequestException('Outlet admin phone is required');

    const existing = await this.prisma.user.findUnique({ where: { phone: adminPhone } });
    if (existing) throw new BadRequestException(`Phone ${adminPhone} is already registered`);

    // Stamp a publicCode. The column is UNIQUE, so on the extremely rare
    // collision we re-roll a few times before giving up.
    let outlet: any = null;
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        outlet = await this.prisma.outlet.create({
          data: { ...outletData, publicCode: generateOutletCode() },
          include: { business: true },
        });
        break;
      } catch (e: any) {
        if (e?.code !== 'P2002' || !`${e?.message ?? ''}`.includes('publicCode')) throw e;
      }
    }
    if (!outlet) throw new BadRequestException('Could not allocate outlet code');
    await this.translations.upsertAll('Outlet', outlet.id, this.translatableOutletFields(outlet));

    // Reuse or create the 'Outlet Admin' role for this business
    let outletAdminRole = await this.prisma.role.findFirst({
      where: { businessId: outlet.businessId, name: 'Outlet Admin' },
    });
    if (!outletAdminRole) {
      outletAdminRole = await this.prisma.role.create({
        data: { name: 'Outlet Admin', businessId: outlet.businessId, isSystem: false },
      });
    }

    const passwordHash = await bcrypt.hash(DEFAULT_OUTLET_ADMIN_PASSWORD, 12);
    const adminUser = await this.prisma.user.create({
      data: {
        name: adminName?.trim() || `${outlet.name} Admin`,
        phone: adminPhone.trim(),
        passwordHash,
        businessId: outlet.businessId,
        outletId: outlet.id,
        roleId: outletAdminRole.id,
        status: 'ACTIVE',
        mustChangePassword: true,
      },
      select: { id: true, name: true, phone: true },
    });

    // TODO(notifications): send SMS with the default password to adminUser.phone
    return { ...outlet, admin: adminUser };
  }

  async findByBusiness(businessId: string, lang?: string | null) {
    const outlets = await this.prisma.outlet.findMany({
      where: { businessId },
      include: { _count: { select: { orders: true, tables: true } } },
    });
    await this.translations.hydrate('Outlet', outlets, ['name', 'description', 'address', 'addressLine1', 'addressLine2'], lang);
    return outlets;
  }

  async findOne(id: string, lang?: string | null) {
    const outlet = await this.prisma.outlet.findUnique({
      where: { id },
      include: {
        sections: { include: { tables: true } },
        images: { orderBy: { displayOrder: 'asc' } },
        hours: { orderBy: [{ dayOfWeek: 'asc' }, { openTime: 'asc' }] },
        _count: { select: { orders: true, tables: true } },
      },
    });
    if (!outlet) throw new NotFoundException('Outlet not found');
    await this.translations.hydrate('Outlet', outlet, ['name', 'description', 'address', 'addressLine1', 'addressLine2'], lang);
    return outlet;
  }

  async update(id: string, data: Partial<CreateOutletDto>) {
    // Switching to a self-service type only makes sense when no seating
    // artefacts exist on the outlet. Block the change otherwise so we
    // don't strand sections/tables/table-types in an inconsistent state.
    if (data.outletType && !allowsSeating(data.outletType)) {
      const [tables, sections, tableTypes] = await Promise.all([
        this.prisma.table.count({ where: { outletId: id } }),
        this.prisma.section.count({ where: { outletId: id } }),
        this.prisma.tableType.count({ where: { outletId: id } }),
      ]);
      if (tables + sections + tableTypes > 0) {
        throw new BadRequestException(
          'Remove all sections, tables, and table types before switching this outlet to a self-service type.',
        );
      }
    }
    const outlet = await this.prisma.outlet.update({ where: { id }, data });
    const touchedTextFields = ['name', 'description', 'address', 'addressLine1', 'addressLine2']
      .some((f) => (data as any)[f] !== undefined);
    if (touchedTextFields) {
      await this.translations.upsertAll('Outlet', outlet.id, this.translatableOutletFields(outlet));
    }
    return outlet;
  }

  /** Throw 400 if the outlet's type doesn't permit seating artefacts. */
  private async assertOutletAllowsSeating(outletId: string) {
    const outlet = await this.prisma.outlet.findUnique({
      where: { id: outletId },
      select: { outletType: true },
    });
    if (!outlet) throw new NotFoundException('Outlet not found');
    if (!allowsSeating(outlet.outletType)) {
      throw new BadRequestException(
        'This outlet is self-service; sections, tables, and table types do not apply.',
      );
    }
  }

  // ─── Outlet admin lookup ─────────────────────────────────
  async findAdmin(outletId: string) {
    return this.prisma.user.findFirst({
      where: { outletId },
      orderBy: { createdAt: 'asc' },
      select: { id: true, name: true, phone: true, email: true },
    });
  }

  // ─── Imagery gallery ─────────────────────────────────────
  async addImage(outletId: string, url: string) {
    const max = await this.prisma.outletImage.aggregate({
      where: { outletId },
      _max: { displayOrder: true },
    });
    return this.prisma.outletImage.create({
      data: { outletId, url, displayOrder: (max._max.displayOrder ?? -1) + 1 },
    });
  }

  removeImage(imageId: string) {
    return this.prisma.outletImage.delete({ where: { id: imageId } });
  }

  /**
   * Public roster — outlets a customer can browse without a QR. Returns
   * minimal display fields only; intended for the customer app's outlet picker.
   */
  listPublic() {
    return this.prisma.outlet.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        city: true,
        address: true,
        primaryImageUrl: true,
        logoUrl: true,
        business: { select: { name: true } },
      },
    });
  }

  /**
   * Whether the outlet is currently accepting orders.
   * - `isActive` controls the admin master switch.
   * - `hours` defines opening windows per day-of-week. No rows for today = closed today.
   */
  async getOpenStatus(outletId: string) {
    const outlet = await this.prisma.outlet.findUnique({
      where: { id: outletId },
      select: {
        id: true, isActive: true, name: true, outletType: true, hours: true,
        // Cluster membership signals the customer app to redirect a standalone
        // QR scan into the cluster shell. Public — no PII.
        clusterMembership: {
          select: {
            clusterBusiness: { select: { id: true, publicCode: true, name: true } },
          },
        },
      },
    });
    if (!outlet) throw new NotFoundException('Outlet not found');

    // outletType is included in the response so the customer PWA can decide
    // whether to use the open-tab postpaid UX without needing an auth'd call
    // to /outlets/:id.
    const base = {
      outletType: outlet.outletType,
      clusterMembership: outlet.clusterMembership?.clusterBusiness
        ? {
            clusterBusinessId: outlet.clusterMembership.clusterBusiness.id,
            clusterPublicCode: outlet.clusterMembership.clusterBusiness.publicCode,
            clusterName: outlet.clusterMembership.clusterBusiness.name,
          }
        : null,
    };

    if (!outlet.isActive) {
      return { ...base, isOpen: false, isActive: false, reason: 'Outlet is currently closed' };
    }

    const now = new Date();
    const day = now.getDay();
    const hm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const todays = outlet.hours.filter((h) => h.dayOfWeek === day);

    if (todays.length === 0) {
      return { ...base, isOpen: false, isActive: true, reason: 'Closed today' };
    }
    const within = todays.find((h) => hm >= h.openTime && hm < h.closeTime);
    if (within) {
      return { ...base, isOpen: true, isActive: true, reason: null };
    }
    const next = todays.find((h) => hm < h.openTime);
    return {
      ...base,
      isOpen: false,
      isActive: true,
      reason: next ? `Opens at ${next.openTime}` : 'Closed for the day',
    };
  }

  /**
   * Token counter config. tokenStartNumber is the value reset() snaps to;
   * nextTokenNumber is the value the next order will be tagged with.
   */
  async getTokenCounter(outletId: string) {
    const o = await this.prisma.outlet.findUnique({
      where: { id: outletId },
      select: { tokenStartNumber: true, nextTokenNumber: true, nextOrderSequence: true },
    });
    if (!o) throw new NotFoundException('Outlet not found');
    return o;
  }

  async setTokenCounter(outletId: string, body: { startNumber?: number; currentNumber?: number }) {
    if (body.startNumber != null && (!Number.isInteger(body.startNumber) || body.startNumber < 1)) {
      throw new BadRequestException('startNumber must be a positive integer');
    }
    if (body.currentNumber != null && (!Number.isInteger(body.currentNumber) || body.currentNumber < 1)) {
      throw new BadRequestException('currentNumber must be a positive integer');
    }
    return this.prisma.outlet.update({
      where: { id: outletId },
      data: {
        ...(body.startNumber != null   ? { tokenStartNumber: body.startNumber }   : {}),
        ...(body.currentNumber != null ? { nextTokenNumber: body.currentNumber } : {}),
      },
      select: { tokenStartNumber: true, nextTokenNumber: true },
    });
  }

  async resetTokenCounter(outletId: string) {
    const o = await this.prisma.outlet.findUnique({
      where: { id: outletId },
      select: { tokenStartNumber: true },
    });
    if (!o) throw new NotFoundException('Outlet not found');
    return this.prisma.outlet.update({
      where: { id: outletId },
      data: { nextTokenNumber: o.tokenStartNumber },
      select: { tokenStartNumber: true, nextTokenNumber: true },
    });
  }

  // ─── Hours (per-day, multi-range) ────────────────────────
  getHours(outletId: string) {
    return this.prisma.outletHour.findMany({
      where: { outletId },
      orderBy: [{ dayOfWeek: 'asc' }, { openTime: 'asc' }],
    });
  }

  // Replace the entire week's schedule in one call.
  // `ranges`: [{ dayOfWeek, openTime, closeTime }, …]. Days absent from the list are treated as CLOSED.
  async setHours(outletId: string, ranges: { dayOfWeek: number; openTime: string; closeTime: string }[]) {
    // Light validation
    for (const r of ranges) {
      if (r.dayOfWeek < 0 || r.dayOfWeek > 6) throw new BadRequestException('dayOfWeek must be 0-6');
      if (!/^\d{2}:\d{2}$/.test(r.openTime) || !/^\d{2}:\d{2}$/.test(r.closeTime)) {
        throw new BadRequestException('Times must be HH:MM');
      }
      if (r.closeTime <= r.openTime) throw new BadRequestException('Close time must be after open time');
    }
    return this.prisma.$transaction(async (tx) => {
      await tx.outletHour.deleteMany({ where: { outletId } });
      if (ranges.length) {
        await tx.outletHour.createMany({
          data: ranges.map(r => ({
            outletId,
            dayOfWeek: r.dayOfWeek,
            openTime: r.openTime,
            closeTime: r.closeTime,
          })),
        });
      }
      return tx.outletHour.findMany({
        where: { outletId },
        orderBy: [{ dayOfWeek: 'asc' }, { openTime: 'asc' }],
      });
    });
  }

  async createSection(outletId: string, data: CreateSectionDto) {
    await this.assertOutletAllowsSeating(outletId);
    return this.prisma.section.create({ data: { ...data, outletId } });
  }

  async getSections(outletId: string) {
    return this.prisma.section.findMany({
      where: { outletId },
      include: { tables: true },
    });
  }

  async createTable(outletId: string, data: CreateTableDto) {
    await this.assertOutletAllowsSeating(outletId);
    return this.prisma.table.create({ data: { ...data, outletId } });
  }

  async getDashboard(outletId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [todayOrders, activeOrders, revenue, topItems, paymentSplit, distinctCustomers] = await Promise.all([
      this.prisma.order.count({ where: { outletId, createdAt: { gte: today } } }),
      this.prisma.order.count({
        where: { outletId, status: { in: ['CREATED', 'QUEUED', 'PREPARING', 'READY', 'OUT_FOR_SERVICE'] } },
      }),
      this.prisma.order.aggregate({
        where: { outletId, status: 'SERVED', createdAt: { gte: today } },
        _sum: { totalAmount: true },
        _avg: { totalAmount: true },
      }),
      this.prisma.orderItem.groupBy({
        by: ['itemId'],
        where: { order: { outletId, createdAt: { gte: today } } },
        _sum: { quantity: true },
        orderBy: { _sum: { quantity: 'desc' } },
        take: 5,
      }),
      // Today's successful payments grouped by mode. We sum on payments (not
      // order totals) so multi-tender or partial payments are counted correctly.
      this.prisma.payment.groupBy({
        by: ['mode'],
        where: {
          status: 'SUCCESS',
          createdAt: { gte: today },
          order: { outletId },
        },
        _sum: { amount: true },
        _count: { id: true },
      }),
      // Distinct customers who placed at least one order today at this outlet.
      // Guest / walk-in orders (customerId = null) are excluded — they're
      // covered by the todayOrders count.
      this.prisma.order.findMany({
        where: { outletId, createdAt: { gte: today }, customerId: { not: null } },
        distinct: ['customerId'],
        select: { customerId: true },
      }),
    ]);

    // Normalize into a fixed map so the UI doesn't have to handle missing keys.
    const splitMap: Record<string, { amount: number; count: number }> = {
      CASH: { amount: 0, count: 0 },
      UPI: { amount: 0, count: 0 },
      CARD: { amount: 0, count: 0 },
      WALLET: { amount: 0, count: 0 },
      NET_BANKING: { amount: 0, count: 0 },
    };
    paymentSplit.forEach((g) => {
      splitMap[g.mode] = { amount: Number(g._sum.amount || 0), count: g._count.id };
    });

    return {
      todayOrders,
      todayCustomers: distinctCustomers.length,
      activeOrders,
      todayRevenue: revenue._sum.totalAmount || 0,
      avgOrderValue: revenue._avg.totalAmount || 0,
      topItems,
      paymentSplit: splitMap,
    };
  }
}
