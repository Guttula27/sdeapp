import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { PrismaService } from '../../config/prisma/prisma.service';
import { BusinessType } from '@prisma/client';
import { TranslationsService } from '../translations/translations.service';

// Testing-phase default — replace with an SMS-delivered random password before launch
const DEFAULT_ADMIN_PASSWORD = 'abc@123';

// All fields decorated so the global ValidationPipe(whitelist:true,
// forbidNonWhitelisted:true) lets them through. Without decorators every
// property is treated as non-whitelisted and rejected.
export class CreateBusinessDto {
  @IsString() name!: string;
  @IsString() @IsOptional() description?: string;
  @IsString() @IsOptional() address?: string;
  @IsString() @IsOptional() addressLine1?: string;
  @IsString() @IsOptional() addressLine2?: string;
  @IsString() @IsOptional() city?: string;
  @IsString() @IsOptional() state?: string;
  @IsString() @IsOptional() pincode?: string;
  @IsString() @IsOptional() country?: string;
  @IsString() @IsOptional() mapsLocation?: string;
  @IsString() @IsOptional() gstNumber?: string;
  @IsString() @IsOptional() upiId?: string;
  @IsEnum(BusinessType) businessType!: BusinessType;
  @IsString() @IsOptional() logoUrl?: string;
  @IsString() @IsOptional() primaryImageUrl?: string;
  @IsString() @IsOptional() adminPhone?: string;
  @IsString() @IsOptional() adminName?: string;
}

@Injectable()
export class BusinessesService {
  constructor(
    private prisma: PrismaService,
    private translations: TranslationsService,
  ) {}

  private translatableBusinessFields(b: any): Record<string, string | null | undefined> {
    return {
      name: b.name,
      description: b.description,
      address: b.address,
      addressLine1: b.addressLine1,
      addressLine2: b.addressLine2,
    };
  }

  async create(data: CreateBusinessDto) {
    const { adminPhone, adminName, ...biz } = data;
    if (!adminPhone) throw new BadRequestException('Business admin phone is required');

    const existing = await this.prisma.user.findUnique({ where: { phone: adminPhone } });
    if (existing) throw new BadRequestException(`Phone ${adminPhone} is already registered`);

    const business = await this.prisma.business.create({ data: biz });
    await this.translations.upsertAll('Business', business.id, this.translatableBusinessFields(business));

    // Provision the Business Owner role for this business + the owner user.
    // Clone responsibilities from the platform-scoped template so the tenant
    // starts with the defaults the platform admin has configured.
    const template = await this.prisma.role.findFirst({
      where: { name: 'Business Owner', isTemplate: true, businessId: null },
      select: { responsibilities: { select: { responsibilityId: true } } },
    });
    const ownerRole = await this.prisma.role.create({
      data: {
        name: 'Business Owner',
        businessId: business.id,
        isSystem: false,
        responsibilities: template
          ? { create: template.responsibilities.map((r) => ({ responsibilityId: r.responsibilityId })) }
          : undefined,
      },
    });
    const passwordHash = await bcrypt.hash(DEFAULT_ADMIN_PASSWORD, 12);
    const adminUser = await this.prisma.user.create({
      data: {
        name: adminName?.trim() || `${business.name} Owner`,
        phone: adminPhone.trim(),
        passwordHash,
        businessId: business.id,
        roleId: ownerRole.id,
        status: 'ACTIVE',
        mustChangePassword: true,
      },
      select: { id: true, name: true, phone: true },
    });

    // TODO(notifications): send SMS with the default password to adminUser.phone
    return { ...business, admin: adminUser };
  }

  async findAll(page?: number, limit?: number, lang?: string | null) {
    const p = Number(page) || 1;
    const l = Number(limit) || 20;
    const [businesses, total] = await Promise.all([
      this.prisma.business.findMany({
        include: { subscription: { include: { plan: true } }, _count: { select: { outlets: true } } },
        skip: (p - 1) * l,
        take: l,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.business.count(),
    ]);
    await this.translations.hydrate('Business', businesses, ['name', 'description', 'address', 'addressLine1', 'addressLine2'], lang);
    return { businesses, total, page: p, limit: l };
  }

  async findOne(id: string, lang?: string | null) {
    const business = await this.prisma.business.findUnique({
      where: { id },
      include: {
        outlets: true,
        subscription: { include: { plan: true } },
        images: { orderBy: { displayOrder: 'asc' } },
        _count: { select: { outlets: true, users: true } },
      },
    });
    if (!business) throw new NotFoundException('Business not found');
    await this.translations.hydrate('Business', business, ['name', 'description', 'address', 'addressLine1', 'addressLine2'], lang);
    await this.translations.hydrate('Outlet', business.outlets as any[], ['name', 'description', 'address', 'addressLine1', 'addressLine2'], lang);
    return business;
  }

  // ─── Business admin (owner) ──────────────────────────────
  async findAdmin(businessId: string) {
    return this.prisma.user.findFirst({
      where: { businessId, outletId: null },
      orderBy: { createdAt: 'asc' },
      select: { id: true, name: true, phone: true, email: true },
    });
  }

  // ─── Business gallery ────────────────────────────────────
  async addImage(businessId: string, url: string) {
    const max = await this.prisma.businessImage.aggregate({
      where: { businessId },
      _max: { displayOrder: true },
    });
    return this.prisma.businessImage.create({
      data: { businessId, url, displayOrder: (max._max.displayOrder ?? -1) + 1 },
    });
  }

  removeImage(imageId: string) {
    return this.prisma.businessImage.delete({ where: { id: imageId } });
  }

  async update(id: string, data: Partial<CreateBusinessDto>) {
    const business = await this.prisma.business.update({ where: { id }, data });
    const touchedTextFields = ['name', 'description', 'address', 'addressLine1', 'addressLine2']
      .some((f) => (data as any)[f] !== undefined);
    if (touchedTextFields) {
      await this.translations.upsertAll('Business', business.id, this.translatableBusinessFields(business));
    }
    return business;
  }

  async toggleStatus(id: string) {
    const business = await this.prisma.business.findUnique({ where: { id } });
    if (!business) throw new NotFoundException('Business not found');
    return this.prisma.business.update({
      where: { id },
      data: { status: business.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE' },
    });
  }

  async getRoles(businessId: string) {
    return this.prisma.role.findMany({
      where: { OR: [{ businessId }, { isSystem: true }] },
      select: { id: true, name: true, isSystem: true },
    });
  }

  async getDashboard(id: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [outlets, todayOrders, revenue, distinctCustomers] = await Promise.all([
      this.prisma.outlet.count({ where: { businessId: id, isActive: true } }),
      this.prisma.order.count({
        where: { outlet: { businessId: id }, createdAt: { gte: today } },
      }),
      this.prisma.order.aggregate({
        where: { outlet: { businessId: id }, status: 'SERVED', createdAt: { gte: today } },
        _sum: { totalAmount: true },
      }),
      // Distinct customers across all outlets in this business who ordered today.
      this.prisma.order.findMany({
        where: { outlet: { businessId: id }, createdAt: { gte: today }, customerId: { not: null } },
        distinct: ['customerId'],
        select: { customerId: true },
      }),
    ]);

    return {
      activeOutlets: outlets,
      todayOrders,
      todayCustomers: distinctCustomers.length,
      todayRevenue: revenue._sum.totalAmount || 0,
    };
  }
}
