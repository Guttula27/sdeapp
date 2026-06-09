import { Inject, Injectable, NotFoundException, BadRequestException, ForbiddenException, forwardRef } from '@nestjs/common';
import { PrismaService } from '../../config/prisma/prisma.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { OrdersGateway } from './orders.gateway';
import { OrderStatus, OrderItemStatus, OutletType } from '@prisma/client';
import { AuditLogService } from '../../config/logger/audit-log.service';
import { EncryptionService } from '../../config/crypto/encryption.service';
import { UserLookupService } from '../../config/crypto/user-lookup.service';
import { TranslationsService } from '../translations/translations.service';
import { LifecycleDispatcherService } from '../customer-alerts/lifecycle-dispatcher.service';
import { PricingService } from '../pricing/pricing.service';
import { RewardsService } from '../rewards/rewards.service';
import { ServiceStationsService } from '../service-stations/service-stations.service';

@Injectable()
export class OrdersService {
  constructor(
    private prisma: PrismaService,
    private ordersGateway: OrdersGateway,
    private translations: TranslationsService,
    @Inject(forwardRef(() => LifecycleDispatcherService))
    private dispatcher: LifecycleDispatcherService,
    private pricing: PricingService,
    private rewards: RewardsService,
    private serviceStations: ServiceStationsService,
    private audit: AuditLogService,
    private encryption: EncryptionService,
    private userLookup: UserLookupService,
  ) {}

  /** Hydrate items[].item, items[].variant, and outlet for a batch of orders. */
  private async hydrateOrders(orders: any[], lang: string | null | undefined) {
    if (!lang || lang === 'en' || !orders?.length) return orders;
    const allItems    = orders.flatMap((o: any) => (o.items ?? []).map((oi: any) => oi.item).filter(Boolean));
    const allVariants = orders.flatMap((o: any) => (o.items ?? []).map((oi: any) => oi.variant).filter(Boolean));
    const allOutlets  = orders.map((o: any) => o.outlet).filter(Boolean);
    await Promise.all([
      this.translations.hydrate('Item',    allItems,    ['name', 'description'], lang),
      this.translations.hydrate('Variant', allVariants, ['name', 'shortDescription'], lang),
      this.translations.hydrate('Outlet',  allOutlets,  ['name', 'address'], lang),
    ]);
    return orders;
  }

  async create(outletId: string, dto: CreateOrderDto, userId?: string) {
    // Outlet GST config — gstApplicable is the master toggle; gstPercent is
    // the fallback when an item doesn't carry its own rate.
    const outlet = await this.prisma.outlet.findUnique({
      where: { id: outletId },
      select: { gstApplicable: true, gstPercent: true, priceIncludesGst: true, businessId: true },
    });
    const gstOn = !!outlet?.gstApplicable;
    const outletDefaultPct = gstOn ? Number(outlet?.gstPercent ?? 0) : 0;

    // Resolve viewer's customer tag at this outlet (drives tag-price + tag-GST overrides).
    let viewerTagId: string | null = null;
    if (userId) {
      const a = await this.prisma.customerTagAssignment.findUnique({
        where: { userId_outletId: { userId, outletId } },
      });
      viewerTagId = a?.customerTagId ?? null;
    }

    // Resolve table type if dining-in (drives table-type-GST overrides).
    let tableTypeId: string | null = null;
    if (dto.tableId) {
      const t = await this.prisma.table.findUnique({
        where: { id: dto.tableId },
        select: { tableTypeId: true, outletId: true },
      });
      if (t?.outletId === outletId) tableTypeId = t.tableTypeId;
    }

    // Bundle expansion: an item flagged isBundle=true is rewritten into N
    // child OrderItem rows so the kitchen ticket lists each prep separately.
    // The first child carries the full bundle price; siblings have
    // totalPrice=0. The bundle metadata lives on the parent Item (price,
    // GST, name) — no separate Bundle table.
    //
    // Customer-choice bundles (maxBundleSelections > 0): the cart line
    // carries bundleSelections — the picked ItemBundleChild ids. We expand
    // only those rows after validating count + ownership.
    const expanded: { dto: any; bundleId?: string; bundleName?: string; bundlePrice?: number; bundleGstRate?: number; isPrimary?: boolean }[] = [];
    for (const li of dto.items) {
      const parent = await this.prisma.item.findUnique({
        where: { id: li.itemId },
        include: {
          bundleChildren: { orderBy: { displayOrder: 'asc' } },
        },
      });
      if (parent?.isBundle) {
        if (!parent.bundleChildren.length) {
          throw new BadRequestException('Bundle has no items configured');
        }
        let childrenForOrder = parent.bundleChildren;
        const maxPicks = parent.maxBundleSelections ?? 0;
        if (maxPicks > 0) {
          const picks = (li as any).bundleSelections as string[] | undefined;
          if (!Array.isArray(picks) || picks.length !== maxPicks) {
            throw new BadRequestException(
              `Bundle "${parent.name}" requires exactly ${maxPicks} selection${maxPicks === 1 ? '' : 's'}`,
            );
          }
          if (new Set(picks).size !== picks.length) {
            throw new BadRequestException(`Bundle "${parent.name}" selections must be unique`);
          }
          const validIds = new Set(parent.bundleChildren.map((c) => c.id));
          for (const id of picks) {
            if (!validIds.has(id)) {
              throw new BadRequestException(`Bundle "${parent.name}" got an invalid selection`);
            }
          }
          const bySelectedId = new Set(picks);
          childrenForOrder = parent.bundleChildren.filter((c) => bySelectedId.has(c.id));
        }
        // Bundle price uses the parent Item's basePrice (or selected variant
        // price if the cart line specified one — handled by resolveOrderItems
        // for the primary row below).
        const bundlePrice = Number(parent.basePrice) * li.quantity;
        const bundleGstRate = parent.gstRate != null ? Number(parent.gstRate) : undefined;
        childrenForOrder.forEach((child, idx) => {
          expanded.push({
            dto: {
              itemId: child.childItemId,
              variantId: child.variantId || undefined,
              quantity: child.quantity * li.quantity,
            },
            bundleId: parent.id,
            bundleName: parent.name,
            bundlePrice: idx === 0 ? bundlePrice : 0,
            bundleGstRate,
            isPrimary: idx === 0,
          });
        });
      } else {
        expanded.push({ dto: li });
      }
    }

    const items = await this.resolveOrderItems(
      expanded.map((e) => e.dto) as any,
      gstOn ? { viewerTagId, tableTypeId, outletDefaultPct } : null,
    );

    // Override prices for bundle child rows so the bundle's fixed price wins
    // over the sum of regular item prices. The primary row holds the full
    // bundle revenue; siblings are zeroed out.
    for (let i = 0; i < items.length; i++) {
      const meta = expanded[i];
      if (!meta?.bundleId) continue;
      const line = items[i];
      (line as any).bundleId = meta.bundleId;
      if (meta.isPrimary) {
        line.unitPrice = (meta.bundlePrice ?? 0) / Math.max(1, line.quantity);
        line.totalPrice = meta.bundlePrice ?? 0;
        if (meta.bundleGstRate !== undefined) line.gstRate = meta.bundleGstRate;
        line.gstAmount = line.totalPrice * (line.gstRate / 100);
      } else {
        line.unitPrice = 0;
        line.totalPrice = 0;
        line.gstAmount = 0;
      }
      const bundleNote = `Bundle: ${meta.bundleName}`;
      line.notes = line.notes ? `${bundleNote} | ${line.notes}` : bundleNote;
    }

    const linesTotal = items.reduce((sum, i) => sum + i.totalPrice, 0);

    // Per-line GST already computed in resolveOrderItems. Sum it up and, when
    // the outlet's prices already include GST, back the tax out of subtotal.
    let subtotal: number;
    let taxAmount: number;
    if (gstOn && outlet?.priceIncludesGst) {
      // totalPrice for each line was already gross; pull GST out using its own rate.
      taxAmount = items.reduce((s, i) => {
        const r = i.gstRate / 100;
        return s + (i.totalPrice - i.totalPrice / (1 + r));
      }, 0);
      subtotal = linesTotal - taxAmount;
      // Re-pin per-line gstAmount/unitPrice to the GST-exclusive amounts so the bill is consistent.
      for (const i of items) {
        const r = i.gstRate / 100;
        const netLine = i.totalPrice / (1 + r);
        i.gstAmount = i.totalPrice - netLine;
        i.unitPrice = netLine / i.quantity;
        i.totalPrice = netLine;
      }
    } else {
      taxAmount = items.reduce((s, i) => s + i.gstAmount, 0);
      subtotal = linesTotal;
    }

    // sgst/cgst are made `let` because they get recomputed after the
    // promotions quote — GST is on the post-discount net amount, so
    // applying coupons / rewards changes the tax (and therefore the
    // split) from what the initial gross calc gave us.
    let sgstAmount = taxAmount / 2;
    let cgstAmount = taxAmount / 2;

    const parcelAmount = dto.isParcel ? await this.computeParcelCharge(outletId, items as any) : 0;
    let totalAmount = subtotal + taxAmount + parcelAmount;
    let discountAmount = 0;
    let appliedCouponId: string | null = null;
    let appliedCouponDiscount = 0;
    let appliedRewardPoints = 0;
    let appliedRewardAmount = 0;

    // Resolve customer identity ahead of the promotions step so coupon
    // targeting + reward redemption know who they're for. The same block
    // ran later in the original flow; pulling it forward keeps it usable
    // both as a promo input and for the order create downstream.
    let resolvedCustomerId: string | undefined = userId;
    let resolvedStaffId: string | undefined;
    if (dto.customerPhone) {
      const phone = dto.customerPhone.trim();
      if (phone) {
        const existing = await this.userLookup.findByPhone(phone);
        const customer = existing || await this.prisma.user.create({
          data: { ...this.encryption.buildPhoneFields(phone), name: `Guest (${phone})`, status: 'ACTIVE' },
        });
        resolvedCustomerId = customer.id;
        resolvedStaffId = userId;
      }
    }

    // ─── Promotions waterfall ─────────────────────────────────────
    // Auto-applying discounts (bill / category / subcategory / item), one
    // customer-selected coupon, and an optional reward-point redemption.
    // PricingService is the single source of truth — the customer-side
    // /cart/quote endpoint runs the exact same code.
    // For the promo quote we use the customer's *original* cart lines,
    // not the expanded child rows. A bundle counts as one line at the
    // bundle's parent-item price; pricing handles category/subcategory
    // lookup from the parent Item.
    const promoLines: any[] = dto.items.map((li) => ({
      itemId: li.itemId,
      variantId: li.variantId,
      quantity: li.quantity,
    }));
    try {
      const quote = await this.pricing.quoteCart({
        outletId,
        lines: promoLines,
        isParcel: !!dto.isParcel,
        customerId: resolvedCustomerId,
        couponId: dto.couponId,
        rewardPoints: dto.rewardPoints,
      });
      // PricingService now applies GST on the *net* (post-discount)
      // taxable amount. Pull its recomputed taxAmount + totalAmount so
      // the persisted order matches what the customer sees on the quote
      // and the receipt. `quote.subtotal` is the taxable subtotal (gross
      // minus all discounts); the difference between the original
      // pre-tax subtotal and that is the aggregate discount that lands
      // on the bill.
      totalAmount = quote.totalAmount;
      taxAmount = quote.taxAmount;
      sgstAmount = taxAmount / 2;
      cgstAmount = taxAmount / 2;
      discountAmount = Math.max(0, subtotal - quote.subtotal);
      appliedCouponId = quote.coupon?.id ?? null;
      appliedCouponDiscount = quote.coupon?.amount ?? 0;
      appliedRewardPoints = quote.reward?.points ?? 0;
      appliedRewardAmount = quote.reward?.amount ?? 0;
    } catch (e: any) {
      // If the customer asked for a coupon / redemption and it failed, fail
      // the whole order — the customer's expectation of the bill total
      // would otherwise be off by the discount they thought they'd get.
      if (dto.couponId || dto.rewardPoints) throw e;
      // No promotions requested — silently fall back to the un-promo bill.
    }

    // Pull-and-increment the outlet's persistent order sequence and configurable
    // token counter atomically. Atomic increment prevents collisions when two
    // orders are placed concurrently.
    const counters = await this.prisma.outlet.update({
      where: { id: outletId },
      data: {
        nextOrderSequence: { increment: 1 },
        nextTokenNumber:   { increment: 1 },
      },
      select: { nextOrderSequence: true, nextTokenNumber: true, publicCode: true },
    });
    // We incremented first; consume the previous value for this order.
    const orderSeq    = counters.nextOrderSequence - 1;
    const tokenNumber = counters.nextTokenNumber - 1;
    // Prefer the outlet's publicCode (e.g. "OL-A4F23C81") as the order-number
    // prefix — it's unique by design. The legacy outletId.slice(0,4) prefix
    // collided when two outlets shared the first 4 chars of their CUID
    // (caught by the cluster smoke test on 2026-05-25).
    const prefix = counters.publicCode || `OL-${outletId.slice(0, 8).toUpperCase()}`;
    const orderNumber = `ORD-${prefix}-${String(orderSeq).padStart(5, '0')}`;

    // (customer + staff already resolved above, ahead of promotions)

    // Aggregate quantities per item so a cart with the same item twice still
    // decrements once with the combined count.
    const stockDeltas = new Map<string, number>();
    for (const line of items) {
      const itemId = (line as any).itemId as string;
      stockDeltas.set(itemId, (stockDeltas.get(itemId) ?? 0) + line.quantity);
    }

    const order = await this.prisma.$transaction(async (tx) => {
      // Atomic conditional decrement for every limited-stock item. The WHERE
      // clause re-checks availability against the latest row state, so two
      // concurrent orders racing for the same last unit can't both succeed —
      // the loser sees the affected-rows mismatch below and is bounced.
      for (const [itemId, qty] of stockDeltas) {
        const res = await tx.item.updateMany({
          where: { id: itemId, hasLimitedStock: true, availableQuantity: { gte: qty } },
          data: { availableQuantity: { decrement: qty } },
        });
        // res.count === 0 means either the item isn't limited-stock (no-op,
        // skip) OR we lost the race and there isn't enough left. Distinguish
        // by re-reading the item.
        if (res.count === 0) {
          const refetch = await tx.item.findUnique({
            where: { id: itemId },
            select: { name: true, hasLimitedStock: true, availableQuantity: true },
          });
          if (refetch?.hasLimitedStock) {
            throw new BadRequestException(
              refetch.availableQuantity > 0
                ? `Only ${refetch.availableQuantity} of "${refetch.name}" left in stock`
                : `"${refetch.name}" is out of stock`,
            );
          }
        }
        // Flip isAvailable=false once stock hits zero, so the customer menu
        // hides the item automatically until staff add more.
        await tx.item.updateMany({
          where: { id: itemId, hasLimitedStock: true, availableQuantity: { lte: 0 } },
          data: { isAvailable: false },
        });
      }

      const created = await tx.order.create({
        data: {
          orderNumber,
          tokenNumber,
          outletId,
          // Coerce empty strings to null so an FK lookup isn't attempted
          // against id=""; Razorpay/UI flows sometimes send "" for unset ids.
          tableId: dto.tableId || null,
          sectionId: dto.sectionId || null,
          customerId: resolvedCustomerId,
          staffId: resolvedStaffId,
          isParcel: dto.isParcel || false,
          isPostpaid: dto.isPostpaid || false,
          notes: dto.notes,
          subtotal,
          taxAmount,
          sgstAmount,
          cgstAmount,
          parcelAmount,
          discountAmount,
          totalAmount,
          items: {
            create: items.map((it: any) => ({
              ...it,
              ...(it.bundleId ? { bundleId: it.bundleId } : {}),
              // Postpaid: every line starts blocked behind the service-desk
              // verification gate. Default for prepaid / self-service stays
              // PENDING so the kitchen sees the order immediately.
              ...(dto.isPostpaid
                ? { status: OrderItemStatus.PENDING_VERIFICATION as any }
                : {}),
            })),
          },
          statusHistory: {
            create: { status: OrderStatus.CREATED, changedBy: userId },
          },
          ...(dto.paymentMode
            ? {
                payments: {
                  create: {
                    mode: dto.paymentMode as any,
                    amount: totalAmount,
                    status: 'SUCCESS',
                  },
                },
              }
            : {}),
        },
        include: {
          items: { include: { item: true, variant: true } },
          table: true,
          outlet: { select: { id: true, name: true, address: true, gstNumber: true, upiId: true, logoUrl: true, outletType: true } },
          payments: true,
          customer: {
            select: {
              id: true, name: true, phone: true,
              customerTagAssignments: { include: { customerTag: true } },
            },
          },
        },
      });

      // Persist the coupon redemption (ledger row + counter increment) inside
      // the same transaction as the order — atomic against double-claims.
      if (appliedCouponId && resolvedCustomerId) {
        await tx.couponUsage.create({
          data: {
            couponId: appliedCouponId,
            userId: resolvedCustomerId,
            orderId: created.id,
            discountAmount: appliedCouponDiscount,
          },
        });
        await tx.coupon.update({
          where: { id: appliedCouponId },
          data: { usesCount: { increment: 1 } },
        });
      }

      // Reward redemption — decrement balance + write the REDEEM transaction.
      // We persist inline so it fails the order if the balance race-loses.
      if (appliedRewardPoints > 0 && resolvedCustomerId) {
        const account = await tx.customerRewardAccount.upsert({
          where: { userId: resolvedCustomerId },
          create: { userId: resolvedCustomerId },
          update: {},
        });
        if (account.balance < appliedRewardPoints) {
          throw new BadRequestException('Insufficient reward points');
        }
        const updated = await tx.customerRewardAccount.update({
          where: { id: account.id },
          data: {
            balance: { decrement: appliedRewardPoints },
            lifetimeRedeemed: { increment: appliedRewardPoints },
          },
        });
        await tx.rewardTransaction.create({
          data: {
            accountId: account.id,
            userId: resolvedCustomerId,
            type: 'REDEEM',
            points: -appliedRewardPoints,
            amountValue: appliedRewardAmount,
            balanceAfter: updated.balance,
            orderId: created.id,
            outletId,
          },
        });
      }

      return created;
    });

    this.ordersGateway.emitOrderCreated(outletId, order);

    // Postpaid: ping the service desk so a staff member walks over and
    // confirms the line with the customer before kitchen sees anything.
    if (dto.isPostpaid) {
      this.ordersGateway.emitServiceDeskAlert(outletId, {
        kind: 'verify',
        orderId: order.id,
        orderNumber: order.orderNumber,
      });
    }

    // Lifecycle: ORDER_PLACED — non-blocking, so a notification failure never
    // breaks the order. If the order was paid up-front, also fire
    // PAYMENT_RECEIVED here (counter cash + bundled paymentMode case);
    // the payments service handles the deferred online-payment path.
    if (order.customerId) {
      // Customer-app deep link to the receipt page. Falls back to the path
      // alone when no public base URL is configured, which is still useful
      // when the message lands in the in-app alerts feed.
      const baseUrl = process.env.CUSTOMER_APP_URL?.replace(/\/$/, '') || '';
      const receiptUrl = `${baseUrl}/receipt/${order.id}`;

      const lines = (order.items || []).map((oi: any) => ({
        name: oi.item?.name || 'Item',
        quantity: oi.quantity,
        total: Number(oi.totalPrice),
      }));

      const ctx = {
        customerId: order.customerId,
        customerName: order.customer?.name,
        customerPhone: order.customer?.phone,
        businessId: outlet?.businessId ?? null,
        outletId,
        outletName: order.outlet?.name,
        orderId: order.id,
        orderNumber: order.orderNumber,
        amount: order.totalAmount.toString(),
        items: lines,
        subtotal: order.subtotal.toString(),
        taxAmount: order.taxAmount.toString(),
        totalAmount: order.totalAmount.toString(),
        tokenNumber: order.tokenNumber,
        receiptUrl,
      };
      this.dispatcher.fire('ORDER_PLACED', ctx).catch(() => {});
      if ((order.payments || []).some((p: any) => p.status === 'SUCCESS')) {
        this.dispatcher.fire('PAYMENT_RECEIVED', ctx).catch(() => {});
        // Bundled-payment path (counter cash, prepaid): order was paid at
        // create time so we credit earn-points right here. Deferred online
        // payments flow through PaymentsService.confirmPayment instead.
        this.tryEarnRewards(order.id, order.customerId, outletId, Number(order.subtotal)).catch(() => {});
      }
    }
    return order;
  }

  async findAll(
    outletId: string,
    filters: { status?: OrderStatus; page?: number; limit?: number; callerUserId?: string },
    lang?: string | null,
  ) {
    const page  = Number(filters.page)  || 1;
    const limit = Number(filters.limit) || 20;
    const status = filters.status;
    const where: any = { outletId, ...(status && { status }) };

    // Service-station scoping: if the caller is *only* a service-station worker
    // (not an admin / counter / kitchen role), restrict to orders placed at
    // tables assigned to any of their service stations. Admins and other
    // staff see the full list.
    //
    // Parcel station workers see every isParcel order at this outlet,
    // independent of the table-based scoping. If no parcel station has an
    // active worker, parcel orders also flow to whichever regular station
    // the user is on, so they don't get lost (the fallback the product
    // spec calls out: "parcel orders will be routed to regular service
    // station").
    if (filters.callerUserId) {
      const stations = await this.prisma.serviceStation.findMany({
        where: {
          outletId,
          isActive: true,
          workers: { some: { userId: filters.callerUserId } },
        },
        select: { isParcelStation: true, tables: { select: { tableId: true } } },
      });
      if (stations.length > 0) {
        const tableIds = stations
          .filter((s) => !s.isParcelStation)
          .flatMap((s) => s.tables.map((t) => t.tableId));
        const userIsOnParcelStation = stations.some((s) => s.isParcelStation);
        const parcelActive = await this.serviceStations.hasActiveParcelStation(outletId);

        const visibility: any[] = [];
        if (tableIds.length) visibility.push({ tableId: { in: tableIds } });
        if (userIsOnParcelStation) {
          // The parcel desk sees every parcel ticket at this outlet.
          visibility.push({ isParcel: true });
        } else if (!parcelActive) {
          // Fallback: no parcel desk staffed → regular service workers
          // also see parcel orders so they don't go unattended.
          visibility.push({ isParcel: true });
        }

        if (visibility.length === 0) {
          where.tableId = '__none__';
        } else if (visibility.length === 1) {
          Object.assign(where, visibility[0]);
        } else {
          where.OR = visibility;
        }
      }
    }

    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        include: {
          items: { include: { item: true, variant: true } },
          table: true,
          customer: {
          select: {
            id: true, name: true, phone: true,
            customerTagAssignments: { include: { customerTag: true } },
          },
        },
          payments: true,
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.order.count({ where }),
    ]);

    await this.hydrateOrders(orders, lang);
    return { orders, total, page, limit };
  }

  async findAllScoped(filters: {
    businessId?: string; outletId?: string;
    status?: OrderStatus; page?: number; limit?: number;
  }, lang?: string | null) {
    const page  = Number(filters.page)  || 1;
    const limit = Number(filters.limit) || 50;

    const where: any = {};
    if (filters.status)   where.status   = filters.status;
    if (filters.outletId) where.outletId = filters.outletId;
    if (filters.businessId) where.outlet = { businessId: filters.businessId };

    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        include: {
          items:  { include: { item: true, variant: true } },
          table:  true,
          outlet: { select: { id: true, name: true, outletType: true, business: { select: { id: true, name: true } } } },
          customer: {
          select: {
            id: true, name: true, phone: true,
            customerTagAssignments: { include: { customerTag: true } },
          },
        },
          payments: true,
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.order.count({ where }),
    ]);

    await this.hydrateOrders(orders, lang);
    return { orders, total, page, limit };
  }

  async findOne(id: string, lang?: string | null) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            item: true,
            variant: true,
            // Include the snapshot menu so receipts can group by it without
            // having to walk back through subcategory → category.
            menu: { select: { id: true, name: true } },
            review: {
              include: {
                paybackPayment: { select: { id: true, mode: true, amount: true, status: true, createdAt: true } },
                replyBy: { select: { id: true, name: true } },
              },
            },
          },
        },
        table: true,
        section: true,
        outlet: {
          select: {
            id: true, name: true, phone: true, logoUrl: true, upiId: true, outletType: true,
            // Full address breakdown so the receipt can render street /
            // city-state-pincode on separate lines instead of one comma-joined blob.
            address: true, addressLine1: true, addressLine2: true,
            city: true, state: true, pincode: true,
            gstNumber: true,
          },
        },
        customer: {
          select: {
            id: true, name: true, phone: true,
            customerTagAssignments: { include: { customerTag: true } },
          },
        },
        payments: true,
        statusHistory: { orderBy: { createdAt: 'asc' } },
        disputes: true,
        // Discount breakdown for the receipt: per-coupon row and per-redeem row.
        // The order's stored discountAmount is the aggregate; these relations
        // let the receipt list each component on its own line.
        couponUsages: {
          select: { discountAmount: true, coupon: { select: { code: true, name: true } } },
        },
      },
    });
    if (!order) throw new NotFoundException('Order not found');
    // Order doesn't expose rewardTransactions as a Prisma relation —
    // pull the REDEEM rows separately and attach so receipts can list
    // the reward redemption on its own line.
    const rewardTransactions = await this.prisma.rewardTransaction.findMany({
      where: { orderId: order.id, type: 'REDEEM' },
      select: { points: true, amountValue: true },
    });
    (order as any).rewardTransactions = rewardTransactions;
    await this.hydrateOrders([order], lang);
    return order;
  }

  // Bill-number lookup used by the cashier dispute flow. orderNumber is
  // @unique globally; we still scope the lookup to the caller's outlet so a
  // cashier at outlet A can't accidentally raise a dispute against B.
  async findByOrderNumber(outletId: string, orderNumber: string, lang?: string | null) {
    const trimmed = orderNumber.trim();
    if (!trimmed) throw new NotFoundException('Bill number is required');
    const order = await this.prisma.order.findFirst({
      where: { orderNumber: trimmed, outletId },
      include: {
        items: { include: { item: true, variant: true } },
        table: true,
        outlet: { select: { id: true, name: true } },
        customer: { select: { id: true, name: true, phone: true } },
        payments: true,
      },
    });
    if (!order) throw new NotFoundException(`No order found with bill number ${trimmed} at this outlet`);
    await this.hydrateOrders([order], lang);
    return order;
  }

  async updateStatus(id: string, dto: UpdateOrderStatusDto, userId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: { outlet: { select: { outletType: true, name: true, businessId: true } } },
    });
    if (!order) throw new NotFoundException('Order not found');

    this.validateStatusTransition(order.status, dto.status, {
      outletType: order.outlet?.outletType,
      tableId: order.tableId,
      isParcel: order.isParcel,
    });

    const updated = await this.prisma.order.update({
      where: { id },
      data: {
        status: dto.status,
        statusHistory: {
          create: { status: dto.status, changedBy: userId, notes: dto.notes },
        },
      },
      include: {
        items: { include: { item: true } },
        table: true,
        customer: {
          select: {
            id: true, name: true, phone: true,
            customerTagAssignments: { include: { customerTag: true } },
          },
        },
      },
    });

    this.ordersGateway.emitOrderStatusUpdated(order.outletId, updated);
    this.audit.orderStatusChanged({
      actorId: userId,
      orderId: updated.id,
      orderNumber: updated.orderNumber,
      outletId: updated.outletId,
      from: order.status,
      to: dto.status,
      notes: dto.notes ?? null,
    });

    // Service-desk lane routing on the new status:
    //   - self-service: kitchen-done → OUT_FOR_SERVICE → "release" lane.
    //   - table-service: kitchen-done → READY → "pickup" lane.
    // (Parcel doesn't hit a service desk — parcel-station has its own UI.)
    const shape = this.flowShape(order.outlet?.outletType, order.tableId, order.isParcel);
    if (dto.status === OrderStatus.OUT_FOR_SERVICE && shape === 'self-service') {
      this.ordersGateway.emitServiceDeskAlert(order.outletId, {
        kind: 'release',
        orderId: updated.id,
        orderNumber: updated.orderNumber,
      });
    } else if (dto.status === OrderStatus.READY && shape === 'table-service') {
      this.ordersGateway.emitServiceDeskAlert(order.outletId, {
        kind: 'pickup',
        orderId: updated.id,
        orderNumber: updated.orderNumber,
      });
    }

    // Customer-facing nudges:
    //   - READY_FOR_PICKUP → "ready, walk over and grab it" (parcel +
    //     self-service both end here).
    //   - OUT_FOR_SERVICE on the table-service lane → "your server is
    //     bringing it now." Self-service uses OUT_FOR_SERVICE for the
    //     internal pass→counter shuttle, so we don't ping the customer
    //     there — they only care about READY_FOR_PICKUP.
    if (updated.customerId) {
      const baseCtx = {
        customerId: updated.customerId,
        customerName: updated.customer?.name,
        customerPhone: updated.customer?.phone,
        businessId: order.outlet?.businessId ?? null,
        outletId: order.outletId,
        outletName: order.outlet?.name,
        orderId: updated.id,
        orderNumber: updated.orderNumber,
      };
      if (dto.status === OrderStatus.READY_FOR_PICKUP) {
        this.dispatcher.fire('PICKUP_READY', baseCtx).catch(() => {});
      } else if (dto.status === OrderStatus.OUT_FOR_SERVICE && shape === 'table-service') {
        this.dispatcher.fire('ORDER_READY', baseCtx).catch(() => {});
      } else if (dto.status === OrderStatus.SERVED) {
        this.dispatcher.fire('ORDER_SERVED', baseCtx).catch(() => {});
      }
    }
    return updated;
  }

  // Idempotent reward-earn — public so PaymentsService can call after a
  // successful capture. Guards against double-credits on retries via an
  // EARN-row lookup keyed by orderId.
  async tryEarnRewards(orderId: string, customerId: string, outletId: string, subtotal: number) {
    try {
      const existing = await this.prisma.rewardTransaction.findFirst({
        where: { orderId, type: 'EARN' },
        select: { id: true },
      });
      if (existing) return;
      await this.rewards.earnForOrder({
        userId: customerId,
        orderId,
        outletId,
        subtotal,
      });
    } catch {
      // Best-effort: a reward credit failure should never break the
      // checkout. Operational alerts pick up via the audit trail.
    }
  }

  async cancel(id: string, userId: string, reason?: string) {
    return this.updateStatus(id, { status: OrderStatus.CANCELLED, notes: reason }, userId);
  }

  /**
   * Course planner: assign items to course numbers and optionally name each
   * course. Items not listed are left as-is. Sequence on items that have
   * already progressed past PENDING is disallowed — once an item is
   * cooking, reordering it is meaningless.
   */
  async setSequences(
    orderId: string,
    payload: {
      items?: Array<{ itemId: string; sequenceNumber: number | null }>;
      labels?: Record<string, string> | null;
    },
  ) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });
    if (!order) throw new NotFoundException('Order not found');

    if (payload.items?.length) {
      const byId = new Map(order.items.map((it) => [it.id, it]));
      for (const { itemId, sequenceNumber } of payload.items) {
        const item = byId.get(itemId);
        if (!item) throw new BadRequestException(`Item ${itemId} is not part of this order`);
        // Once an item has started cooking the course-position no longer
        // changes its lifecycle, so block edits to keep the model honest.
        if (item.status !== OrderItemStatus.PENDING && item.sequenceNumber !== sequenceNumber) {
          throw new BadRequestException(
            `Item "${itemId}" is already ${item.status} — sequencing can only be edited on PENDING items`,
          );
        }
        if (sequenceNumber != null && (!Number.isInteger(sequenceNumber) || sequenceNumber < 1)) {
          throw new BadRequestException('sequenceNumber must be a positive integer or null');
        }
      }
      await this.prisma.$transaction(
        payload.items.map(({ itemId, sequenceNumber }) =>
          this.prisma.orderItem.update({
            where: { id: itemId },
            data: { sequenceNumber },
          }),
        ),
      );
    }

    if (payload.labels !== undefined) {
      await this.prisma.order.update({
        where: { id: orderId },
        data: { sequenceLabels: payload.labels === null ? null : (payload.labels as any) },
      });
    }

    // Recompute the active course — if the customer/staff shifted things
    // around such that the current course has no live items, fast-forward.
    await this.advanceCourseIfReady(orderId);

    const updated = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { items: { include: { item: true, variant: true } }, table: true },
    });
    if (updated) this.ordersGateway.emitOrderStatusUpdated(updated.outletId, updated);
    return updated;
  }

  /**
   * If every live item (not CANCELLED) at the order's current course is
   * SERVED, bump activeSequence to the next course that has any live
   * items. Repeats until it finds a course with outstanding work, or runs
   * out of courses (in which case activeSequence still advances past the
   * last course — harmless).
   */
  private async advanceCourseIfReady(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { activeSequence: true, items: { select: { sequenceNumber: true, status: true } } },
    });
    if (!order) return;

    let active = order.activeSequence;
    const live = order.items.filter((i) => i.status !== OrderItemStatus.CANCELLED);

    // Build the set of distinct sequence numbers in use (skip nulls — those
    // items are always-active and don't gate anything).
    const sequenceNumbers = Array.from(
      new Set(live.map((i) => i.sequenceNumber).filter((n): n is number => n != null)),
    ).sort((a, b) => a - b);
    if (sequenceNumbers.length === 0) return; // no sequencing configured

    while (true) {
      const atCurrent = live.filter((i) => i.sequenceNumber === active);
      if (atCurrent.length === 0) {
        // No items at this course → if a later course exists, jump to it.
        const next = sequenceNumbers.find((n) => n > active);
        if (next == null) break;
        active = next;
        continue;
      }
      const allDone = atCurrent.every((i) => i.status === OrderItemStatus.SERVED);
      if (!allDone) break;
      const next = sequenceNumbers.find((n) => n > active);
      if (next == null) { active = active + 1; break; }
      active = next;
    }

    if (active !== order.activeSequence) {
      await this.prisma.order.update({
        where: { id: orderId },
        data: { activeSequence: active },
      });
    }
  }

  async updateItemStatus(orderId: string, orderItemId: string, status: OrderItemStatus, userId?: string) {
    const item = await this.prisma.orderItem.findUnique({
      where: { id: orderItemId },
      include: { order: true, item: true },
    });
    if (!item || item.orderId !== orderId) throw new NotFoundException('Order item not found');

    // Station-scoped enforcement: if the caller is currently a station worker,
    // they can only touch items routed to their station — unless their station
    // is a master station, which sees everything.
    if (userId) {
      const workerStation = await this.prisma.kitchenStation.findFirst({
        where: { currentWorkerId: userId, outletId: item.order.outletId, isActive: true },
        select: { id: true, isMaster: true },
      });
      if (workerStation && !workerStation.isMaster && item.item.kitchenStationId !== workerStation.id) {
        throw new ForbiddenException('You can only update items assigned to your station');
      }
    }

    this.validateItemTransition(item.status, status);

    await this.prisma.orderItem.update({
      where: { id: orderItemId },
      data: { status },
    });

    // Course sequencing: when an item is SERVED, check whether the order's
    // current course is now fully done. If so, advance to the next course
    // so the kitchen sees the next batch of items. Idempotent — re-runs
    // are a no-op once the next sequence has items present.
    if (status === OrderItemStatus.SERVED) {
      await this.advanceCourseIfReady(orderId);
    }

    // Auto-rollup: derive parent order status from item statuses
    const rolledUp = await this.rollupOrderStatus(orderId, userId);

    const updated = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items:    { include: { item: true, variant: true } },
        table:    true,
        outlet:   { select: { outletType: true } },
        customer: {
          select: {
            id: true, name: true, phone: true,
            customerTagAssignments: { include: { customerTag: true } },
          },
        },
        statusHistory: { orderBy: { createdAt: 'asc' } },
      },
    });

    if (updated) {
      this.ordersGateway.emitOrderStatusUpdated(updated.outletId, updated);
      this.audit.orderItemStatusChanged({
        actorId: userId ?? null,
        orderId: updated.id,
        orderItemId,
        from: item.status,
        to: status,
      });
    }

    // Fan-out the service-desk "kitchen done" nudge whenever the rollup
    // pushes the order onto the lane the service desk owns: OUT_FOR_SERVICE
    // for self-service (release lane) or READY for table-service (pickup
    // lane). The same status transitions hit a different alert kind so
    // the UI can lane-route them.
    if (updated && rolledUp) {
      const shape = this.flowShape(
        updated.outlet?.outletType,
        updated.tableId,
        updated.isParcel,
      );
      if (rolledUp === OrderStatus.OUT_FOR_SERVICE && shape === 'self-service') {
        this.ordersGateway.emitServiceDeskAlert(updated.outletId, {
          kind: 'release',
          orderId: updated.id,
          orderNumber: updated.orderNumber,
        });
      } else if (rolledUp === OrderStatus.READY && shape === 'table-service') {
        this.ordersGateway.emitServiceDeskAlert(updated.outletId, {
          kind: 'pickup',
          orderId: updated.id,
          orderNumber: updated.orderNumber,
        });
      }
    }

    // Lifecycle: ITEM_READY → ping the customer (WhatsApp if configured +
    // in-app alert + ringtone). Fire only on the actual transition into READY,
    // and only when there's a customer attached to the order.
    if (updated && status === OrderItemStatus.READY && item.status !== OrderItemStatus.READY && updated.customerId) {
      const outletForBiz = await this.prisma.outlet.findUnique({
        where: { id: updated.outletId },
        select: { name: true, businessId: true },
      });
      this.dispatcher.fire('ITEM_READY', {
        customerId: updated.customerId,
        customerName: updated.customer?.name,
        customerPhone: updated.customer?.phone,
        businessId: outletForBiz?.businessId ?? null,
        outletId: updated.outletId,
        outletName: outletForBiz?.name,
        orderId: updated.id,
        orderItemId: orderItemId,
        orderNumber: updated.orderNumber,
        itemName: item.item?.name,
      }).catch(() => {});

      // Order-level READY rollup fires its own event so customers also see a
      // distinct "your full order is ready" alert.
      if (rolledUp && updated.status === OrderStatus.READY) {
        this.dispatcher.fire('ORDER_READY', {
          customerId: updated.customerId,
          customerName: updated.customer?.name,
          businessId: outletForBiz?.businessId ?? null,
          outletId: updated.outletId,
          outletName: outletForBiz?.name,
          orderId: updated.id,
          orderNumber: updated.orderNumber,
        }).catch(() => {});
      }
    }
    return { order: updated, rolledUp };
  }

  private validateItemTransition(from: OrderItemStatus, to: OrderItemStatus) {
    const allowed: Record<OrderItemStatus, OrderItemStatus[]> = {
      // Service desk's only moves on an unverified line: confirm (→ PENDING,
      // which puts it on the kitchen board) or strike (→ CANCELLED).
      PENDING_VERIFICATION: [OrderItemStatus.PENDING, OrderItemStatus.CANCELLED],
      PENDING:   [OrderItemStatus.PREPARING, OrderItemStatus.CANCELLED],
      PREPARING: [OrderItemStatus.READY, OrderItemStatus.CANCELLED],
      READY:     [OrderItemStatus.SERVED, OrderItemStatus.CANCELLED],
      SERVED:    [],
      CANCELLED: [],
    };
    if (from === to) return;
    if (!allowed[from].includes(to)) {
      throw new BadRequestException(`Cannot move item from ${from} to ${to}`);
    }
  }

  /**
   * Derive parent order status from its items. Only advances forward and only
   * up to READY — OUT_FOR_SERVICE / SERVED / refund states are manual.
   */
  private async rollupOrderStatus(orderId: string, userId?: string): Promise<OrderStatus | null> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: { select: { status: true } },
        outlet: { select: { outletType: true } },
      },
    });
    if (!order || order.items.length === 0) return null;

    // Don't touch frozen / manual-only states
    const frozen: OrderStatus[] = [
      OrderStatus.READY_FOR_PICKUP, OrderStatus.OUT_FOR_SERVICE,
      OrderStatus.SERVED, OrderStatus.CANCELLED,
      OrderStatus.DISPUTED, OrderStatus.RESOLVED,
      OrderStatus.FOR_REFUND, OrderStatus.REFUND_COMPLETE,
    ];
    if (frozen.includes(order.status as OrderStatus)) return null;

    // PENDING_VERIFICATION items don't exist for the kitchen, so they
    // also don't count toward rollup decisions — they're treated like
    // CANCELLED here (skipped) until service desk verifies them.
    const live = order.items.filter(
      (i) =>
        i.status !== OrderItemStatus.CANCELLED &&
        i.status !== OrderItemStatus.PENDING_VERIFICATION,
    );
    if (live.length === 0) return null;

    const shape = this.flowShape(order.outlet?.outletType, order.tableId, order.isParcel);
    // Self-service skips the order-level READY step entirely — when the
    // kitchen has finished every item, the order goes straight to
    // OUT_FOR_SERVICE so the service desk can shuttle it.
    const kitchenDoneTarget =
      shape === 'self-service' ? OrderStatus.OUT_FOR_SERVICE : OrderStatus.READY;

    let derived: OrderStatus | null = null;
    if (live.every(i => i.status === OrderItemStatus.READY || i.status === OrderItemStatus.SERVED)) {
      derived = kitchenDoneTarget;
    } else if (live.some(i => i.status === OrderItemStatus.PREPARING || i.status === OrderItemStatus.READY)) {
      derived = OrderStatus.PREPARING;
    }
    if (!derived) return null;

    // Auto-managed prefix differs by lane: self-service goes
    // CREATED → QUEUED → PREPARING → OUT_FOR_SERVICE (no order-level READY);
    // everything else goes CREATED → QUEUED → PREPARING → READY.
    const orderFlow: OrderStatus[] = shape === 'self-service'
      ? [OrderStatus.CREATED, OrderStatus.QUEUED, OrderStatus.PREPARING, OrderStatus.OUT_FOR_SERVICE]
      : [OrderStatus.CREATED, OrderStatus.QUEUED, OrderStatus.PREPARING, OrderStatus.READY];
    const currentIdx = orderFlow.indexOf(order.status as OrderStatus);
    const derivedIdx = orderFlow.indexOf(derived);
    if (currentIdx < 0 || derivedIdx <= currentIdx) return null;

    await this.prisma.order.update({
      where: { id: orderId },
      data: {
        status: derived,
        statusHistory: { create: { status: derived, changedBy: userId, notes: 'Auto-rolled up from item statuses' } },
      },
    });
    return derived;
  }

  private async resolveOrderItems(
    items: CreateOrderDto['items'],
    gstCtx: { viewerTagId: string | null; tableTypeId: string | null; outletDefaultPct: number } | null,
  ) {
    return Promise.all(
      items.map(async (i) => {
        const item = await this.prisma.item.findUnique({
          where: { id: i.itemId },
          include: {
            // Walk up to Category so we can snapshot the menuId on the
            // OrderItem — keeps historical receipt grouping stable even if
            // the category is later moved to a different menu.
            subcategory: { select: { category: { select: { menuId: true } } } },
            customerTagPrices: gstCtx?.viewerTagId
              ? { where: { customerTagId: gstCtx.viewerTagId } }
              : false,
            tableTypePrices: gstCtx?.tableTypeId
              ? { where: { tableTypeId: gstCtx.tableTypeId } }
              : false,
          },
        });
        if (!item) throw new NotFoundException(`Item ${i.itemId} not found`);
        if (!item.isAvailable) throw new BadRequestException(`Item "${item.name}" is not available`);

        // Limited-stock check: reject up-front (before the order is created) so
        // the customer sees a clean error and we don't have to roll anything
        // back. The atomic decrement in create() is still guarded by an
        // OptimisticConcurrencyControl-style condition so concurrent orders
        // can't oversell the last unit.
        if (item.hasLimitedStock && item.availableQuantity < i.quantity) {
          throw new BadRequestException(
            item.availableQuantity > 0
              ? `Only ${item.availableQuantity} of "${item.name}" left in stock`
              : `"${item.name}" is out of stock`,
          );
        }

        let unitPrice = Number(item.basePrice);
        if (i.variantId) {
          const variant = await this.prisma.variant.findUnique({ where: { id: i.variantId } });
          if (variant) unitPrice = Number(variant.price);
        }

        // Resolve GST rate: table-type > customer-tag > item default > outlet fallback.
        // Each rung also overrides price the same way (in pickItemPrice for menu);
        // here we only resolve the rate to capture for the line.
        let gstRate = 0;
        if (gstCtx) {
          const ttPrice = (item as any).tableTypePrices?.find(
            (p: any) =>
              p.tableTypeId === gstCtx.tableTypeId &&
              (i.variantId ? p.variantId === i.variantId : !p.variantId),
          );
          const ctPrice = (item as any).customerTagPrices?.find(
            (p: any) =>
              p.customerTagId === gstCtx.viewerTagId &&
              (i.variantId ? p.variantId === i.variantId : !p.variantId),
          );
          if (ttPrice?.gstRate != null) gstRate = Number(ttPrice.gstRate);
          else if (ctPrice?.gstRate != null) gstRate = Number(ctPrice.gstRate);
          else if (item.gstRate != null) gstRate = Number(item.gstRate);
          else gstRate = gstCtx.outletDefaultPct;
        }

        // Toppings: validate against item's available toppings, sum the price add,
        // and build a human-readable summary appended to notes.
        const toppingNotes: string[] = [];
        if (i.toppings?.length) {
          const allowed = await this.prisma.itemTopping.findMany({
            where: { itemId: i.itemId, toppingId: { in: i.toppings.map((t: any) => t.toppingId) } },
            include: { topping: { include: { options: true } } },
          });
          const allowedMap = new Map(allowed.map(a => [a.toppingId, a]));

          for (const t of i.toppings) {
            const link = allowedMap.get(t.toppingId);
            if (!link) throw new BadRequestException(`Topping ${t.toppingId} is not available for this item`);

            const basePriceAdd = link.priceAdd != null ? Number(link.priceAdd) : Number(link.topping.basePriceAdd);
            let optionLabel = '';
            let optionAdd = 0;
            if (t.optionId) {
              const opt = link.topping.options.find(o => o.id === t.optionId);
              if (!opt) throw new BadRequestException(`Option ${t.optionId} not valid for ${link.topping.name}`);
              optionLabel = `: ${opt.name}`;
              optionAdd = Number(opt.priceAdd);
            }
            unitPrice += basePriceAdd + optionAdd;
            toppingNotes.push(`${link.topping.name}${optionLabel}`);
          }
        }

        const composedNotes = [i.notes, toppingNotes.length ? `Add: ${toppingNotes.join(', ')}` : null]
          .filter(Boolean)
          .join(' | ') || undefined;

        const totalPrice = unitPrice * i.quantity;
        // gstAmount on a line snapshots the tax at resolved rate. Net/gross
        // semantics are reconciled by create() once it knows outlet's priceIncludesGst.
        const gstAmount = totalPrice * (gstRate / 100);
        return {
          itemId: i.itemId,
          variantId: i.variantId,
          quantity: i.quantity,
          unitPrice,
          totalPrice,
          gstRate,
          gstAmount,
          notes: composedNotes,
          menuId: (item as any).subcategory?.category?.menuId ?? null,
        };
      }),
    );
  }

  /**
   * Parcel-charge rules:
   *   - Items with `useCustomParcelCharge`: their own parcelCharge × quantity
   *   - Any other line + outlet has `parcelChargeEnabled`: add outlet.defaultParcelCharge once
   *   - Validates each item is `parcelAvailable`
   */
  private async computeParcelCharge(
    outletId: string,
    items: Array<{ itemId: string; quantity: number }>,
  ): Promise<number> {
    const outlet = await this.prisma.outlet.findUnique({
      where: { id: outletId },
      select: { parcelChargeEnabled: true, defaultParcelCharge: true },
    });
    const itemIds = items.map(i => i.itemId);
    const itemRecords = await this.prisma.item.findMany({
      where: { id: { in: itemIds } },
      select: {
        id: true, name: true,
        parcelAvailable: true, useCustomParcelCharge: true, parcelCharge: true,
      },
    });
    const map = new Map(itemRecords.map(i => [i.id, i]));

    let total = 0;
    let anyUsesUniversal = false;
    for (const line of items) {
      const meta = map.get(line.itemId);
      if (!meta) continue;
      if (!meta.parcelAvailable) {
        throw new BadRequestException(`Item "${meta.name}" is not available for parcel`);
      }
      if (meta.useCustomParcelCharge && meta.parcelCharge != null) {
        total += Number(meta.parcelCharge) * line.quantity;
      } else {
        anyUsesUniversal = true;
      }
    }
    if (anyUsesUniversal && outlet?.parcelChargeEnabled) {
      total += Number(outlet.defaultParcelCharge);
    }
    return total;
  }

  /**
   * The three lifecycle shapes the rest of the order code branches on:
   *   - 'self-service'  — kitchen-done → OUT_FOR_SERVICE → READY_FOR_PICKUP → SERVED
   *                       Service desk is the shuttle from kitchen pass to the
   *                       pickup counter and the explicit gate before the
   *                       customer can collect. No intermediate READY at the
   *                       order level (the dish does sit on the kitchen pass
   *                       briefly, but the order rolls past READY into
   *                       OUT_FOR_SERVICE as soon as the last item is done).
   *   - 'table-service' — kitchen-done → READY (on the pass) → service desk
   *                       picks up → OUT_FOR_SERVICE → SERVED.
   *   - 'parcel'        — kitchen-done → READY → parcel station packs →
   *                       READY_FOR_PICKUP → SERVED. Parcel mirrors
   *                       self-service in shape but the lane is owned by the
   *                       parcel station, not the service desk.
   *
   * Parcel orders are detected per-order (isParcel flag) and override outlet
   * type. HYBRID outlets pick lane by tableId presence.
   */
  private flowShape(
    outletType: OutletType | null | undefined,
    tableId: string | null | undefined,
    isParcel: boolean | null | undefined,
  ): 'parcel' | 'self-service' | 'table-service' {
    if (isParcel) return 'parcel';
    switch (outletType) {
      case OutletType.SELF_SERVICE:
      case OutletType.SELF_SERVICE_PARCEL:
        return 'self-service';
      case OutletType.DINE_IN_PREPAID:
      case OutletType.DINE_IN_POSTPAID:
        return 'table-service';
      case OutletType.HYBRID:
        return tableId ? 'table-service' : 'self-service';
      default:
        // Legacy / unknown: treat as table-service so existing orders keep
        // their READY → OUT_FOR_SERVICE → SERVED progression.
        return 'table-service';
    }
  }

  private validateStatusTransition(
    current: OrderStatus,
    next: OrderStatus,
    ctx: { outletType?: OutletType | null; tableId?: string | null; isParcel?: boolean } = {},
  ) {
    const shape = this.flowShape(ctx.outletType, ctx.tableId, ctx.isParcel);

    // Order-level READY only happens in the table-service and parcel lanes.
    // Self-service orders skip READY and roll PREPARING → OUT_FOR_SERVICE.
    let preparingNext: OrderStatus[];
    let readyNext: OrderStatus[];
    let outForServiceNext: OrderStatus[];
    if (shape === 'self-service') {
      preparingNext = [OrderStatus.OUT_FOR_SERVICE, OrderStatus.CANCELLED];
      readyNext = [OrderStatus.OUT_FOR_SERVICE, OrderStatus.CANCELLED]; // legacy in-flight orders
      outForServiceNext = [OrderStatus.READY_FOR_PICKUP, OrderStatus.CANCELLED];
    } else if (shape === 'parcel') {
      preparingNext = [OrderStatus.READY, OrderStatus.CANCELLED];
      readyNext = [OrderStatus.READY_FOR_PICKUP, OrderStatus.SERVED, OrderStatus.CANCELLED];
      outForServiceNext = [OrderStatus.SERVED];
    } else {
      preparingNext = [OrderStatus.READY, OrderStatus.CANCELLED];
      readyNext = [OrderStatus.OUT_FOR_SERVICE, OrderStatus.CANCELLED];
      outForServiceNext = [OrderStatus.SERVED];
    }

    const allowed: Record<OrderStatus, OrderStatus[]> = {
      CREATED:          [OrderStatus.QUEUED, OrderStatus.CANCELLED],
      QUEUED:           [OrderStatus.PREPARING, OrderStatus.CANCELLED],
      PREPARING:        preparingNext,
      READY:            readyNext,
      READY_FOR_PICKUP: [OrderStatus.SERVED, OrderStatus.CANCELLED],
      OUT_FOR_SERVICE:  outForServiceNext,
      SERVED:           [OrderStatus.DISPUTED],
      CANCELLED:        [],
      DISPUTED:         [OrderStatus.RESOLVED, OrderStatus.FOR_REFUND],
      RESOLVED:         [],
      FOR_REFUND:       [OrderStatus.REFUND_COMPLETE],
      REFUND_COMPLETE:  [],
    };
    if (current === next) return;
    if (!allowed[current].includes(next)) {
      throw new BadRequestException(`Cannot transition from ${current} to ${next}`);
    }
  }

  // ─── Postpaid (Dine-in Postpaid) flow ──────────────────────────────────
  // The "open" order on a table is the unfinished postpaid one: items can
  // still be appended until Bill Now is pressed (billRequestedAt set).

  async findOpenForTable(
    outletId: string,
    tableId: string,
    opts: { userId?: string | null; customerPhone?: string | null },
    lang: string | null,
  ) {
    if (!tableId) throw new BadRequestException('tableId is required');

    // A table can have several open postpaid tabs at once — one per
    // customer. Disambiguate by customerId: prefer an explicit phone
    // lookup (staff-driven flow where the staff JWT is not the
    // customer), fall back to the JWT user when it IS the customer
    // (PWA). With no resolvable customer we can't pick a tab safely,
    // so return null — the UI will start a new order.
    let resolvedCustomerId: string | null = null;
    const phone = opts.customerPhone?.trim();
    if (phone) {
      const cust = await this.userLookup.findByPhone(phone, { select: { id: true } });
      resolvedCustomerId = cust?.id ?? null;
      // Phone provided but unknown → no possible match. Bail before
      // querying (and definitely without falling back to userId, which
      // would be the staff user and would surface another customer's tab).
      if (!resolvedCustomerId) return null;
    } else if (opts.userId) {
      resolvedCustomerId = opts.userId;
    }
    if (!resolvedCustomerId) return null;

    const order = await this.prisma.order.findFirst({
      where: {
        outletId,
        tableId,
        customerId: resolvedCustomerId,
        isPostpaid: true,
        billRequestedAt: null,
        status: { notIn: [OrderStatus.CANCELLED, OrderStatus.SERVED, OrderStatus.REFUND_COMPLETE] },
      },
      orderBy: { createdAt: 'desc' },
      include: {
        items: { include: { item: true, variant: true } },
        table: true,
        outlet: { select: { id: true, name: true, outletType: true } },
      },
    });
    if (!order) return null;
    await this.hydrateOrders([order], lang);
    return order;
  }

  /**
   * Append new items to an existing postpaid order. Re-runs pricing against
   * the same outlet/table/customer context as the original order and rolls
   * the totals up across the full item set.
   */
  async appendItems(orderId: string, dto: CreateOrderDto, userId?: string) {
    if (!dto.items?.length) throw new BadRequestException('items is required');

    const existing = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true, outletId: true, tableId: true, customerId: true, status: true,
        isPostpaid: true, billRequestedAt: true, parcelAmount: true,
      },
    });
    if (!existing) throw new NotFoundException('Order not found');
    if (!existing.isPostpaid) throw new BadRequestException('Items can only be appended to a postpaid order');
    if (existing.billRequestedAt) throw new BadRequestException('Bill already requested — items can no longer be appended');
    if (existing.status === OrderStatus.CANCELLED) throw new BadRequestException('Order is cancelled');

    // Re-resolve pricing context the same way create() does.
    const outlet = await this.prisma.outlet.findUnique({
      where: { id: existing.outletId },
      select: { gstApplicable: true, gstPercent: true, priceIncludesGst: true },
    });
    const gstOn = !!outlet?.gstApplicable;
    const outletDefaultPct = gstOn ? Number(outlet?.gstPercent ?? 0) : 0;

    let viewerTagId: string | null = null;
    if (existing.customerId) {
      const a = await this.prisma.customerTagAssignment.findUnique({
        where: { userId_outletId: { userId: existing.customerId, outletId: existing.outletId } },
      });
      viewerTagId = a?.customerTagId ?? null;
    }

    let tableTypeId: string | null = null;
    if (existing.tableId) {
      const t = await this.prisma.table.findUnique({
        where: { id: existing.tableId },
        select: { tableTypeId: true, outletId: true },
      });
      if (t?.outletId === existing.outletId) tableTypeId = t.tableTypeId;
    }

    const newItems = await this.resolveOrderItems(
      dto.items as any,
      gstOn ? { viewerTagId, tableTypeId, outletDefaultPct } : null,
    );

    // Persist new items, then recompute totals across every line on the order.
    // Appended lines on a postpaid order — always — start in
    // PENDING_VERIFICATION so the service desk has a chance to confirm
    // them with the customer before the kitchen picks them up.
    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.orderItem.createMany({
        data: newItems.map((i) => ({
          ...i,
          orderId,
          status: OrderItemStatus.PENDING_VERIFICATION,
        })) as any,
      });

      const allItems = await tx.orderItem.findMany({
        where: { orderId, status: { not: OrderItemStatus.CANCELLED } },
      });
      const linesTotal = allItems.reduce((s, i) => s + Number(i.totalPrice), 0);
      let taxAmount: number;
      let subtotal: number;
      if (gstOn && outlet?.priceIncludesGst) {
        taxAmount = allItems.reduce((s, i) => {
          const r = Number(i.gstRate) / 100;
          const gross = Number(i.totalPrice);
          return s + (gross - gross / (1 + r));
        }, 0);
        subtotal = linesTotal - taxAmount;
      } else {
        taxAmount = allItems.reduce((s, i) => s + Number(i.gstAmount), 0);
        subtotal = linesTotal;
      }
      const sgstAmount = taxAmount / 2;
      const cgstAmount = taxAmount / 2;
      const parcelAmount = Number(existing.parcelAmount);
      const totalAmount = subtotal + taxAmount + parcelAmount;

      return tx.order.update({
        where: { id: orderId },
        data: { subtotal, taxAmount, sgstAmount, cgstAmount, totalAmount },
        include: {
          items: { include: { item: true, variant: true } },
          table: true,
          outlet: { select: { id: true, name: true, address: true, gstNumber: true, upiId: true, logoUrl: true, outletType: true } },
          payments: true,
        },
      });
    });

    this.ordersGateway.emitOrderStatusUpdated(existing.outletId, updated);
    this.ordersGateway.emitServiceDeskAlert(existing.outletId, {
      kind: 'verify',
      orderId: updated.id,
      orderNumber: updated.orderNumber,
    });
    return updated;
  }

  /** Bill Now: stamp billRequestedAt; from here on no more items can be
   *  appended and the regular payment flow takes over. */
  async requestBill(orderId: string, _userId?: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, outletId: true, isPostpaid: true, billRequestedAt: true, status: true },
    });
    if (!order) throw new NotFoundException('Order not found');
    if (!order.isPostpaid) throw new BadRequestException('Bill Now only applies to postpaid orders');
    if (order.billRequestedAt) {
      // idempotent — return the order as-is
      return this.findOne(orderId, null);
    }
    if (order.status === OrderStatus.CANCELLED) throw new BadRequestException('Order is cancelled');

    const updated = await this.prisma.order.update({
      where: { id: orderId },
      data: { billRequestedAt: new Date() },
      include: {
        items: { include: { item: true, variant: true } },
        table: true,
        outlet: { select: { id: true, name: true, address: true, gstNumber: true, upiId: true, logoUrl: true, outletType: true } },
        payments: true,
      },
    });
    this.ordersGateway.emitOrderStatusUpdated(order.outletId, updated);
    return updated;
  }

  // ─── Order log (audit trail) ──────────────────────────────────────────
  // Enriched status history: stage, time, actor name + role, notes. Gated
  // separately from VIEW_ORDERS because the actor names leak staff
  // identity — only show it to the management roles.
  async getOrderLog(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, outletId: true, orderNumber: true, createdAt: true },
    });
    if (!order) throw new NotFoundException('Order not found');

    const rows = await this.prisma.orderStatusHistory.findMany({
      where: { orderId },
      orderBy: { createdAt: 'asc' },
      include: {
        changedByUser: {
          select: {
            id: true,
            name: true,
            phone: true,
            role: { select: { name: true } },
          },
        },
      },
    });

    return {
      orderId: order.id,
      orderNumber: order.orderNumber,
      placedAt: order.createdAt,
      entries: rows.map((r) => ({
        id: r.id,
        status: r.status,
        at: r.createdAt,
        notes: r.notes,
        actor: r.changedByUser
          ? {
              id: r.changedByUser.id,
              name: r.changedByUser.name,
              phone: r.changedByUser.phone,
              role: r.changedByUser.role?.name ?? null,
            }
          : null,
      })),
    };
  }

  // ─── Service desk: postpaid verification gate ──────────────────────────
  // Service desk confirms (or strikes) lines that the customer added to a
  // postpaid order. Confirm moves PENDING_VERIFICATION → PENDING so the
  // kitchen sees them. Strike → CANCELLED. itemIds defaults to "every
  // unverified line on the order" so a "confirm all" press is one call.
  async verifyItems(orderId: string, itemIds: string[] | undefined, action: 'confirm' | 'strike', userId?: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true, outletId: true, orderNumber: true,
        items: { select: { id: true, status: true } },
      },
    });
    if (!order) throw new NotFoundException('Order not found');

    const targetIds = (itemIds && itemIds.length)
      ? new Set(itemIds)
      : null; // null = act on every unverified line
    const eligible = order.items.filter(
      (i) =>
        i.status === OrderItemStatus.PENDING_VERIFICATION &&
        (targetIds === null || targetIds.has(i.id)),
    );
    if (eligible.length === 0) {
      throw new BadRequestException('No items awaiting verification on this order');
    }

    const nextStatus = action === 'confirm'
      ? OrderItemStatus.PENDING
      : OrderItemStatus.CANCELLED;

    await this.prisma.orderItem.updateMany({
      where: { id: { in: eligible.map((i) => i.id) } },
      data: { status: nextStatus },
    });

    const updated = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: { include: { item: true, variant: true } },
        table: true,
        outlet: { select: { id: true, name: true, outletType: true } },
        customer: {
          select: {
            id: true, name: true, phone: true,
            customerTagAssignments: { include: { customerTag: true } },
          },
        },
      },
    });
    if (updated) this.ordersGateway.emitOrderStatusUpdated(updated.outletId, updated);
    this.audit.postpaidVerification({
      actorId: userId ?? null,
      orderId,
      action,
      itemCount: eligible.length,
    });

    // After confirm, ping the kitchen so they pull the now-PENDING lines.
    // (emitOrderStatusUpdated already hits the kitchen room — this is the
    // explicit notification hook for future kitchen-side toast / sound.)
    return { order: updated, verifiedCount: eligible.length, action };
  }

  // ─── Service desk: queue read for the dashboard ─────────────────────────
  // Three lanes:
  //   verify  — postpaid orders with any PENDING_VERIFICATION lines
  //   release — self-service orders sitting at OUT_FOR_SERVICE
  //   pickup  — table-service orders sitting at READY
  // Parcel orders ride in their own UI (parcel station), not this queue.
  async getServiceDeskQueue(outletId: string) {
    const include = {
      items:    { include: { item: true, variant: true } },
      table:    { select: { id: true, number: true, sectionId: true } },
      customer: { select: { id: true, name: true, phone: true } },
    };

    const outlet = await this.prisma.outlet.findUnique({
      where: { id: outletId },
      select: { id: true, outletType: true },
    });
    if (!outlet) throw new NotFoundException('Outlet not found');

    const [verifyRows, readyRows, outForServiceRows] = await Promise.all([
      this.prisma.order.findMany({
        where: {
          outletId,
          items: { some: { status: OrderItemStatus.PENDING_VERIFICATION } },
        },
        include,
        orderBy: { createdAt: 'asc' },
      }),
      // table-service "pickup" lane is fed by orders at READY whose
      // shape resolves to table-service. We pull all READY orders and
      // partition by shape below to keep the SQL simple.
      this.prisma.order.findMany({
        where: { outletId, status: OrderStatus.READY, isParcel: false },
        include,
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.order.findMany({
        where: { outletId, status: OrderStatus.OUT_FOR_SERVICE, isParcel: false },
        include,
        orderBy: { createdAt: 'asc' },
      }),
    ]);

    const partition = (rows: typeof readyRows, want: 'self-service' | 'table-service') =>
      rows.filter((o) => this.flowShape(outlet.outletType, o.tableId, o.isParcel) === want);

    return {
      verify: verifyRows,
      pickup: partition(readyRows, 'table-service'),
      release: partition(outForServiceRows, 'self-service'),
    };
  }
}
