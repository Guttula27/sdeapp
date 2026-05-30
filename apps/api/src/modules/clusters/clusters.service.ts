import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { IsInt, IsOptional, IsString } from 'class-validator';
import * as QRCode from 'qrcode';
import { PrismaService } from '../../config/prisma/prisma.service';

export class AddClusterMemberDto {
  // The outlet's cryptic publicCode (e.g. "OL-A4F23C81"). Required — clusters
  // bring outlets in from OTHER businesses, so the cluster admin uses the
  // shareable public code rather than the internal CUID.
  @IsString() outletCode!: string;
  @IsInt() @IsOptional() displayOrder?: number;
}

@Injectable()
export class ClustersService {
  constructor(private prisma: PrismaService) {}

  // Throws unless the businessId points to an isCluster=true Business. Used
  // as a guard on every cluster-scoped endpoint so a regular business id
  // can't accidentally hit cluster routes.
  private async loadCluster(clusterId: string) {
    const biz = await this.prisma.business.findUnique({ where: { id: clusterId } });
    if (!biz) throw new NotFoundException('Cluster not found');
    if (!biz.isCluster) throw new BadRequestException('This business is not a cluster');
    return biz;
  }

  // ─── Cluster detail (admin-facing) ────────────────────────
  async findOne(clusterId: string) {
    const cluster = await this.loadCluster(clusterId);
    const members = await this.prisma.clusterMember.findMany({
      where: { clusterBusinessId: clusterId },
      orderBy: { displayOrder: 'asc' },
      include: {
        outlet: {
          select: {
            id: true, publicCode: true, name: true, logoUrl: true, primaryImageUrl: true,
            outletType: true, isActive: true, razorpayLinkedAccountId: true,
            business: { select: { id: true, name: true } },
          },
        },
      },
    });
    const images = await this.prisma.businessImage.findMany({
      where: { businessId: clusterId },
      orderBy: { displayOrder: 'asc' },
    });
    return { ...cluster, members, images };
  }

  // ─── Member management ────────────────────────────────────
  async addMember(clusterId: string, dto: AddClusterMemberDto) {
    await this.loadCluster(clusterId);

    const outlet = await this.prisma.outlet.findUnique({
      where: { publicCode: dto.outletCode.trim() },
      include: { clusterMembership: true, business: true },
    });
    if (!outlet) throw new NotFoundException(`No outlet found with code ${dto.outletCode}`);
    if (outlet.business.isCluster) throw new BadRequestException(`Outlet ${outlet.name} belongs to a cluster business and cannot be a member of another cluster`);
    if (outlet.clusterMembership) {
      const target = outlet.clusterMembership.clusterBusinessId === clusterId
        ? 'this cluster' : 'another cluster';
      throw new BadRequestException(`Outlet ${outlet.name} is already a member of ${target}`);
    }

    // Place the new member at the bottom by default — preserves existing order
    // for the cluster admin's reorder UX.
    const max = await this.prisma.clusterMember.aggregate({
      where: { clusterBusinessId: clusterId },
      _max: { displayOrder: true },
    });
    const displayOrder = dto.displayOrder ?? ((max._max.displayOrder ?? -1) + 1);

    return this.prisma.clusterMember.create({
      data: { clusterBusinessId: clusterId, outletId: outlet.id, displayOrder },
      include: { outlet: true },
    });
  }

  async removeMember(clusterId: string, outletId: string) {
    await this.loadCluster(clusterId);
    const member = await this.prisma.clusterMember.findFirst({
      where: { clusterBusinessId: clusterId, outletId },
    });
    if (!member) throw new NotFoundException('That outlet is not a member of this cluster');
    await this.prisma.clusterMember.delete({ where: { id: member.id } });
    return { id: member.id, outletId };
  }

  async reorderMembers(clusterId: string, ordering: { outletId: string; displayOrder: number }[]) {
    await this.loadCluster(clusterId);
    await this.prisma.$transaction(
      ordering.map((o) => this.prisma.clusterMember.updateMany({
        where: { clusterBusinessId: clusterId, outletId: o.outletId },
        data: { displayOrder: o.displayOrder },
      })),
    );
    return { updated: ordering.length };
  }

  // ─── Public-facing: list active clusters ──────────────────
  // Used by the login page so the demo's cluster URL is discoverable
  // without an auth token. Returns minimal fields only — no member or
  // payment data leaks here. The owner contact is exposed (phone only —
  // no password) so the demo login page can show the cluster admin
  // credentials in context. Gate behind an env flag before going live.
  async listPublic() {
    const rows = await this.prisma.business.findMany({
      where: { isCluster: true, status: 'ACTIVE' },
      select: {
        id: true, name: true, publicCode: true, logoUrl: true,
        addressLine1: true, city: true,
        _count: { select: { clusterMembers: true } },
        // The Business Owner user — first non-outlet-scoped user under
        // this business is the owner per BusinessesService.create().
        users: {
          where: { outletId: null },
          orderBy: { createdAt: 'asc' },
          take: 1,
          select: { id: true, name: true, phone: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((r) => {
      const { users, ...rest } = r;
      return { ...rest, owner: users[0] ?? null };
    });
  }

  // ─── Public-facing: cluster shell + aggregated menu ───────
  // Called by the customer app when it lands on a cluster QR. Returns
  // everything the shell needs to render: cluster branding, the outlet
  // strip, and each member outlet's menu in one round-trip.
  async getPublicBundle(publicCode: string) {
    const cluster = await this.prisma.business.findUnique({
      where: { publicCode },
      include: { images: { orderBy: { displayOrder: 'asc' } } },
    });
    if (!cluster) throw new NotFoundException('Cluster not found');
    if (!cluster.isCluster) throw new BadRequestException('This code is not a cluster code');

    const members = await this.prisma.clusterMember.findMany({
      where: { clusterBusinessId: cluster.id },
      orderBy: { displayOrder: 'asc' },
      include: {
        outlet: {
          select: {
            id: true, publicCode: true, name: true, logoUrl: true, primaryImageUrl: true,
            outletType: true, parcelChargeEnabled: true, defaultParcelCharge: true,
            gstApplicable: true, gstPercent: true, priceIncludesGst: true,
            isActive: true,
          },
        },
      },
    });

    // Hydrate each active outlet's menu (categories → subcategories → items).
    // We keep this small: only fields the customer cards/grid need.
    // `menuId` is exposed so the customer shell can group categories under
    // their parent Menu (Breakfast / Lunch / Dinner) — same pattern as the
    // standalone OrderPage's multi-menu tab strip.
    const outletIds = members.map((m) => m.outlet.id);
    const categories = outletIds.length === 0 ? [] : await this.prisma.category.findMany({
      where: { outletId: { in: outletIds }, isActive: true },
      orderBy: [{ outletId: 'asc' }, { displayOrder: 'asc' }],
      select: {
        id: true, name: true, displayOrder: true, outletId: true, menuId: true, imageUrl: true,
        subcategories: {
          where: { isActive: true },
          orderBy: { displayOrder: 'asc' },
          select: {
            id: true, name: true, displayOrder: true, imageUrl: true,
            items: {
              where: { isAvailable: true, isDisplayed: true },
              orderBy: { displayOrder: 'asc' },
              select: {
                id: true, name: true, basePrice: true, thumbnailUrl: true, imageUrl: true,
                shortDescription: true, longDescription: true, description: true,
                isAvailable: true, foodGrade: true, preparationTime: true,
                variants: {
                  where: { isAvailable: true },
                  select: { id: true, name: true, price: true, shortDescription: true },
                },
                // Image gallery (besides the primary imageUrl).
                images: {
                  orderBy: { displayOrder: 'asc' },
                  select: { id: true, url: true },
                },
                // Toppings + their options — drives the customisation UI on
                // the cluster item detail page (variants + add-ons + radio
                // options like "Spicy: Less / Medium / Hot").
                itemToppings: {
                  select: {
                    id: true, priceAdd: true, isRequired: true, toppingId: true,
                    topping: {
                      select: {
                        id: true, name: true, basePriceAdd: true,
                        options: {
                          orderBy: { displayOrder: 'asc' },
                          select: { id: true, name: true, priceAdd: true },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    // Enabled-menu lookup per outlet — mirrors the per-outlet menu flag the
    // standalone /outlets/:id/menus endpoint applies. The cluster shell uses
    // this list to render the MENU tab strip when an outlet has more than
    // one enabled menu.
    const outletMenus = outletIds.length === 0 ? [] : await this.prisma.outletMenu.findMany({
      where: { outletId: { in: outletIds }, isEnabled: true },
      include: {
        menu: { select: { id: true, name: true, isDefault: true, isActive: true } },
      },
      orderBy: { displayOrder: 'asc' },
    });

    return {
      cluster: {
        id: cluster.id, publicCode: cluster.publicCode, name: cluster.name,
        description: cluster.description, address: cluster.address,
        logoUrl: cluster.logoUrl, thumbnailUrl: cluster.thumbnailUrl,
        primaryImageUrl: cluster.primaryImageUrl,
        images: cluster.images,
      },
      outlets: members.map((m) => {
        const outletCats = categories.filter((c) => c.outletId === m.outlet.id);
        // Distinct menu list — falls back to "Main Menu" when the outlet
        // hasn't enabled any (older data where Business.multipleMenusEnabled
        // is false has a single hidden default menu).
        const menus = outletMenus
          .filter((om) => om.outletId === m.outlet.id && om.menu.isActive)
          .map((om) => ({ id: om.menu.id, name: om.menu.name, isDefault: om.menu.isDefault }));
        return {
          ...m.outlet,
          displayOrder: m.displayOrder,
          categories: outletCats,
          menus,
        };
      }),
    };
  }

  // ─── Cluster QR generation ────────────────────────────────
  // Generates a single Business-level QR for the whole cluster — scanning it
  // lands the customer on /cluster/:publicCode where the outlet picker
  // appears. Re-runs return the same PNG (deterministic from publicCode).
  async generateQr(clusterId: string, customerUrl: string) {
    const cluster = await this.loadCluster(clusterId);
    const url = `${customerUrl.replace(/\/$/, '')}/cluster/${cluster.publicCode}`;
    const imageUrl = await QRCode.toDataURL(url);
    return { publicCode: cluster.publicCode, url, imageUrl };
  }
}
