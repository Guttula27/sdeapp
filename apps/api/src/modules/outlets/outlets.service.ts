import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { IsBoolean, IsEnum, IsInt, IsNumber, IsOptional, IsString, ValidateIf } from 'class-validator';
import { PrismaService } from '../../config/prisma/prisma.service';
import { OutletType, SplitFeeAbsorption } from '@prisma/client';
import { TranslationsService } from '../translations/translations.service';
import { EncryptionService } from '../../config/crypto/encryption.service';
import { UserLookupService } from '../../config/crypto/user-lookup.service';
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
  @IsString() @IsOptional() fssaiNumber?: string;
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
  @IsBoolean() @IsOptional() receiptAutoPrint?: boolean;
  @IsBoolean() @IsOptional() receiptAllowManualPrint?: boolean;
  @IsString()  @IsOptional() receiptPrinterId?: string | null;
  @IsString() @IsOptional() adminPhone?: string;
  @IsString() @IsOptional() adminName?: string;
  // Razorpay Route — Linked Account id (acc_xxxxx). When set, single-
  // outlet card/UPI payments are routed to this account on capture so
  // settlement happens directly into the outlet's Razorpay account
  // (platform retains the gateway fee). Leave blank to disable Razorpay
  // for this outlet entirely — the customer PWA hides the option.
  @IsString() @IsOptional() razorpayLinkedAccountId?: string;

  // Split-bill Phase B knobs. Edited from the Outlet profile page;
  // the sweep in SplitBillsService reads them per share.
  @IsEnum(SplitFeeAbsorption) @IsOptional() splitFeesAbsorbedBy?: SplitFeeAbsorption;
  @IsInt() @IsOptional() splitReminderEveryMinutes?: number;
  @IsInt() @IsOptional() splitMaxReminders?: number;
  @IsInt() @IsOptional() splitExpireAfterMinutes?: number;

  // Per-outlet feature toggle owned by the business admin. Drives
  // sidebar visibility of the Aggregators settings page on the
  // outlet-tier nav.
  @IsBoolean() @IsOptional() aggregatorEnabled?: boolean;
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

export class UpdateTableDto {
  @IsString() @IsOptional() number?: string;
  @IsInt() @IsOptional() capacity?: number;
  @ValidateIf((o) => o.sectionId !== undefined) @IsOptional() sectionId?: string | null;
  @ValidateIf((o) => o.tableTypeId !== undefined) @IsOptional() tableTypeId?: string | null;
  @IsOptional() isActive?: boolean;
}

@Injectable()
export class OutletsService {
  constructor(
    private prisma: PrismaService,
    private translations: TranslationsService,
    private encryption: EncryptionService,
    private userLookup: UserLookupService,
  ) {}

  // Encrypt the Razorpay Linked Account id before persistence. Called
  // from create() and update() so the column at rest never holds the
  // plaintext `acc_...` id. Reads decrypt at the consuming service
  // (payments, clusters) — see razorpayLinkedAccountId callsites.
  private maskRouteId<T extends { razorpayLinkedAccountId?: string | null }>(data: T): T {
    if (data.razorpayLinkedAccountId === undefined) return data;
    return {
      ...data,
      razorpayLinkedAccountId: this.encryption.encrypt(data.razorpayLinkedAccountId),
    };
  }

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

    const existing = await this.userLookup.findByPhone(adminPhone);
    if (existing) throw new BadRequestException(`Phone ${adminPhone} is already registered`);

    // Stamp a publicCode. The column is UNIQUE, so on the extremely rare
    // collision we re-roll a few times before giving up.
    let outlet: any = null;
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        outlet = await this.prisma.outlet.create({
          data: this.maskRouteId({ ...outletData, publicCode: generateOutletCode() }),
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
        ...this.encryption.buildPhoneFields(adminPhone),
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
    // Decrypt sensitive at-rest fields before responding so admin UI
    // sees the cleartext acc_... id when pre-filling the form. The
    // customer-facing getOpenStatus never reads this field plaintext.
    (outlet as any).razorpayLinkedAccountId = this.encryption.decrypt(outlet.razorpayLinkedAccountId);
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
    const outlet = await this.prisma.outlet.update({ where: { id }, data: this.maskRouteId(data) });
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
        id: true, isActive: true, name: true, logoUrl: true, outletType: true, hours: true,
        // razorpayLinkedAccountId selected only to derive razorpayEnabled
        // (a boolean) below — we never echo the actual LA id to the
        // customer PWA; that's an internal Razorpay reference.
        razorpayLinkedAccountId: true,
        // Parcel config travels with open-status so the customer PWA's
        // cart preview can mirror the server's parcel-charge math
        // without an extra round-trip to /outlets/:id.
        parcelChargeEnabled: true,
        defaultParcelCharge: true,
        // Business name + logo travel alongside so the customer menu
        // header can show the brand identity (logo + name) without an
        // extra round-trip to /businesses/:id.
        business: { select: { name: true, logoUrl: true } },
        clusterMembership: {
          select: {
            clusterBusiness: { select: { id: true, publicCode: true, name: true } },
          },
        },
      },
    });
    if (!outlet) throw new NotFoundException('Outlet not found');

    const base = {
      outletName: outlet.name,
      outletLogoUrl: outlet.logoUrl,
      businessName: outlet.business?.name ?? null,
      businessLogoUrl: outlet.business?.logoUrl ?? null,
      outletType: outlet.outletType,
      parcelChargeEnabled: outlet.parcelChargeEnabled,
      defaultParcelCharge: Number(outlet.defaultParcelCharge ?? 0),
      // Razorpay routing is enabled for this outlet iff a Linked Account
      // is configured. The customer PWA uses this to hide the Razorpay
      // payment option when the outlet hasn't onboarded for Route — no
      // point letting the customer pick a method that will fail.
      razorpayEnabled: !!outlet.razorpayLinkedAccountId,
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

    // Hours are stored as IST wall-clock (openTime/closeTime are HH:MM
    // strings the admin typed in their local timezone — and the product
    // is India-only). The API container typically runs UTC, so using
    // now.getHours() / getDay() directly would read 09:25 IST as 03:55
    // UTC and show "Opens at 07:00" while the outlet is actually open.
    // Round-trip through toLocaleString to coerce wall-clock to IST.
    // India doesn't observe DST so the round-trip is unambiguous.
    const now = new Date();
    const ist = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
    const day = ist.getDay();
    const hm = `${String(ist.getHours()).padStart(2, '0')}:${String(ist.getMinutes()).padStart(2, '0')}`;
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
    // deleteMany+createMany on OutletHour takes next-key locks on the
    // outletId secondary index. The admin profile page auto-saves on
    // every time-picker change, so two rapid PUTs can race and deadlock
    // (Prisma P2034). Retry a small number of times with jitter before
    // surfacing the failure — by then the contention has cleared.
    let attempt = 0;
    while (true) {
      try {
        return await this.prisma.$transaction(async (tx) => {
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
      } catch (e: any) {
        const code = e?.code;
        // P2034 = "Transaction failed due to a write conflict or a deadlock".
        // 1213 / 1205 are the raw InnoDB codes Prisma sometimes wraps as P2010.
        const isDeadlock = code === 'P2034'
          || (code === 'P2010' && [1213, 1205].includes(Number(e?.meta?.code)));
        if (!isDeadlock || attempt >= 3) throw e;
        attempt += 1;
        // 50ms, 150ms, 350ms with jitter
        const delay = 50 * 2 ** (attempt - 1) + Math.floor(Math.random() * 50);
        await new Promise((r) => setTimeout(r, delay));
      }
    }
    // unreachable — exits via return or throw above
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

  // List every menu available in the section's business and whether it
  // is currently enabled in this section. Default is "enabled" — only
  // explicit exclusion rows hide a menu. The outlet's default menu is
  // always reported as locked-on; an admin can't disable it.
  async listSectionMenus(sectionId: string) {
    const section = await this.prisma.section.findUnique({
      where: { id: sectionId },
      include: { outlet: { select: { businessId: true } } },
    });
    if (!section) throw new NotFoundException('Section not found');

    const [menus, exclusions] = await Promise.all([
      this.prisma.menu.findMany({
        where: { businessId: section.outlet.businessId },
        orderBy: [{ isDefault: 'desc' }, { displayOrder: 'asc' }, { createdAt: 'asc' }],
      }),
      this.prisma.menuSectionExclusion.findMany({ where: { sectionId } }),
    ]);
    const excluded = new Set(exclusions.map((e) => e.menuId));
    return menus.map((m) => ({
      id: m.id,
      name: m.name,
      isDefault: m.isDefault,
      isLocked: m.isDefault,
      isEnabled: m.isDefault ? true : !excluded.has(m.id),
    }));
  }

  async setSectionMenuEnabled(sectionId: string, menuId: string, isEnabled: boolean) {
    const [section, menu] = await Promise.all([
      this.prisma.section.findUnique({
        where: { id: sectionId },
        include: { outlet: { select: { businessId: true } } },
      }),
      this.prisma.menu.findUnique({ where: { id: menuId } }),
    ]);
    if (!section) throw new NotFoundException('Section not found');
    if (!menu) throw new NotFoundException('Menu not found');
    if (menu.businessId !== section.outlet.businessId) {
      throw new BadRequestException("Menu does not belong to this section's business");
    }
    if (menu.isDefault && !isEnabled) {
      throw new BadRequestException('The default menu cannot be disabled');
    }
    if (isEnabled) {
      await this.prisma.menuSectionExclusion.deleteMany({ where: { sectionId, menuId } });
    } else {
      await this.prisma.menuSectionExclusion.upsert({
        where: { menuId_sectionId: { menuId, sectionId } },
        update: {},
        create: { menuId, sectionId },
      });
    }
    return { sectionId, menuId, isEnabled };
  }

  async createTable(outletId: string, data: CreateTableDto) {
    await this.assertOutletAllowsSeating(outletId);
    return this.prisma.table.create({ data: { ...data, outletId } });
  }

  async updateTable(id: string, data: UpdateTableDto) {
    const existing = await this.prisma.table.findUnique({
      where: { id },
      select: { id: true, outletId: true, sectionId: true },
    });
    if (!existing) throw new NotFoundException('Table not found');

    // If the table number changed, guard against duplicates within the
    // same outlet+section combo — otherwise two "T01"s under one
    // section would silently collide and confuse staff. Same-name in
    // a *different* section is fine (sections are the natural scope).
    if (data.number !== undefined) {
      const nextSection = data.sectionId !== undefined
        ? data.sectionId ?? null
        : existing.sectionId ?? null;
      const collision = await this.prisma.table.findFirst({
        where: {
          outletId: existing.outletId,
          sectionId: nextSection,
          number: data.number,
          id: { not: id },
        },
        select: { id: true },
      });
      if (collision) {
        throw new BadRequestException(
          `Another table in this section already uses the number "${data.number}"`,
        );
      }
    }

    return this.prisma.table.update({
      where: { id },
      data: {
        ...(data.number !== undefined ? { number: data.number } : {}),
        ...(data.capacity !== undefined ? { capacity: data.capacity } : {}),
        ...(data.sectionId !== undefined ? { sectionId: data.sectionId ?? null } : {}),
        ...(data.tableTypeId !== undefined ? { tableTypeId: data.tableTypeId ?? null } : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
      },
    });
  }

  async deleteTable(id: string) {
    const table = await this.prisma.table.findUnique({
      where: { id },
      select: { id: true, number: true },
    });
    if (!table) throw new NotFoundException('Table not found');

    // Block hard-delete when historical orders reference this table —
    // dropping the row would orphan those orders. Mirror the
    // category/item soft-delete pattern: flip isActive instead so
    // the table disappears from QR scans and table pickers while the
    // historical orders still resolve cleanly.
    const orderCount = await this.prisma.order.count({ where: { tableId: id } });
    if (orderCount > 0) {
      return this.prisma.table.update({
        where: { id },
        data: { isActive: false },
      });
    }
    // QR (1:1 FK with onDelete behaviour) needs to go first.
    return this.prisma.$transaction(async (tx) => {
      await tx.qRCode.deleteMany({ where: { tableId: id } });
      return tx.table.delete({ where: { id } });
    });
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
