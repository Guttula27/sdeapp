import { Inject, Injectable, NotFoundException, BadRequestException, ForbiddenException, forwardRef } from '@nestjs/common';
import { PrismaService } from '../../config/prisma/prisma.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { OrdersGateway } from './orders.gateway';
import { OrderStatus, OrderItemStatus, OutletType } from '@prisma/client';
import { TranslationsService } from '../translations/translations.service';
import { LifecycleDispatcherService } from '../customer-alerts/lifecycle-dispatcher.service';

@Injectable()
export class OrdersService {
  constructor(
    private prisma: PrismaService,
    private ordersGateway: OrdersGateway,
    private translations: TranslationsService,
    @Inject(forwardRef(() => LifecycleDispatcherService))
    private dispatcher: LifecycleDispatcherService,
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

    const items = await this.resolveOrderItems(
      dto.items,
      gstOn ? { viewerTagId, tableTypeId, outletDefaultPct } : null,
    );

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

    const sgstAmount = taxAmount / 2;
    const cgstAmount = taxAmount / 2;

    const parcelAmount = dto.isParcel ? await this.computeParcelCharge(outletId, items) : 0;
    const totalAmount = subtotal + taxAmount + parcelAmount;

    // Pull-and-increment the outlet's persistent order sequence and configurable
    // token counter atomically. Atomic increment prevents collisions when two
    // orders are placed concurrently.
    const counters = await this.prisma.outlet.update({
      where: { id: outletId },
      data: {
        nextOrderSequence: { increment: 1 },
        nextTokenNumber:   { increment: 1 },
      },
      select: { nextOrderSequence: true, nextTokenNumber: true },
    });
    // We incremented first; consume the previous value for this order.
    const orderSeq    = counters.nextOrderSequence - 1;
    const tokenNumber = counters.nextTokenNumber - 1;
    const orderNumber = `ORD-${outletId.slice(0, 4).toUpperCase()}-${String(orderSeq).padStart(5, '0')}`;

    // Staff Place Order may pass a customer phone to attach (upsert a stub user)
    let resolvedCustomerId = userId;
    let resolvedStaffId: string | undefined;
    if (dto.customerPhone) {
      const phone = dto.customerPhone.trim();
      if (phone) {
        const existing = await this.prisma.user.findUnique({ where: { phone } });
        const customer = existing || await this.prisma.user.create({
          data: { phone, name: `Guest (${phone})`, status: 'ACTIVE' },
        });
        resolvedCustomerId = customer.id;
        resolvedStaffId = userId;
      }
    }

    // Aggregate quantities per item so a cart with the same item twice still
    // decrements once with the combined count.
    const stockDeltas = new Map<string, number>();
    for (const line of items) {
      stockDeltas.set(line.itemId, (stockDeltas.get(line.itemId) ?? 0) + line.quantity);
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

      return tx.order.create({
        data: {
          orderNumber,
          tokenNumber,
          outletId,
          tableId: dto.tableId,
          sectionId: dto.sectionId,
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
          discountAmount: 0,
          totalAmount,
          items: {
            create: items,
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
    });

    this.ordersGateway.emitOrderCreated(outletId, order);

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
    if (filters.callerUserId) {
      const stations = await this.prisma.serviceStation.findMany({
        where: {
          outletId,
          isActive: true,
          workers: { some: { userId: filters.callerUserId } },
        },
        select: { tables: { select: { tableId: true } } },
      });
      if (stations.length > 0) {
        const tableIds = stations.flatMap((s) => s.tables.map((t) => t.tableId));
        // Empty assignment means "no tables yet" — return nothing rather than everything.
        where.tableId = { in: tableIds.length ? tableIds : ['__none__'] };
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
        outlet: { select: { id: true, name: true, address: true, gstNumber: true, upiId: true, logoUrl: true, phone: true, outletType: true } },
        customer: {
          select: {
            id: true, name: true, phone: true,
            customerTagAssignments: { include: { customerTag: true } },
          },
        },
        payments: true,
        statusHistory: { orderBy: { createdAt: 'asc' } },
        disputes: true,
      },
    });
    if (!order) throw new NotFoundException('Order not found');
    await this.hydrateOrders([order], lang);
    return order;
  }

  async updateStatus(id: string, dto: UpdateOrderStatusDto, userId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: { outlet: { select: { outletType: true } } },
    });
    if (!order) throw new NotFoundException('Order not found');

    this.validateStatusTransition(order.status, dto.status, {
      outletType: order.outlet?.outletType,
      tableId: order.tableId,
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
    return updated;
  }

  async cancel(id: string, userId: string, reason?: string) {
    return this.updateStatus(id, { status: OrderStatus.CANCELLED, notes: reason }, userId);
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

    // Auto-rollup: derive parent order status from item statuses
    const rolledUp = await this.rollupOrderStatus(orderId, userId);

    const updated = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items:    { include: { item: true, variant: true } },
        table:    true,
        customer: {
          select: {
            id: true, name: true, phone: true,
            customerTagAssignments: { include: { customerTag: true } },
          },
        },
        statusHistory: { orderBy: { createdAt: 'asc' } },
      },
    });

    if (updated) this.ordersGateway.emitOrderStatusUpdated(updated.outletId, updated);

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
      include: { items: { select: { status: true } } },
    });
    if (!order || order.items.length === 0) return null;

    // Don't touch frozen / manual-only states
    const frozen: OrderStatus[] = [
      OrderStatus.OUT_FOR_SERVICE, OrderStatus.SERVED, OrderStatus.CANCELLED,
      OrderStatus.DISPUTED, OrderStatus.RESOLVED,
      OrderStatus.FOR_REFUND, OrderStatus.REFUND_COMPLETE,
    ];
    if (frozen.includes(order.status as OrderStatus)) return null;

    const live = order.items.filter(i => i.status !== OrderItemStatus.CANCELLED);
    if (live.length === 0) return null;  // all items cancelled — leave to manual handling

    let derived: OrderStatus | null = null;
    if (live.every(i => i.status === OrderItemStatus.READY || i.status === OrderItemStatus.SERVED)) derived = OrderStatus.READY;
    else if (live.some(i => i.status === OrderItemStatus.PREPARING || i.status === OrderItemStatus.READY)) derived = OrderStatus.PREPARING;

    if (!derived) return null;

    // Only advance forward through the auto-managed prefix of the flow
    const orderFlow: OrderStatus[] = [
      OrderStatus.CREATED, OrderStatus.QUEUED, OrderStatus.PREPARING, OrderStatus.READY,
    ];
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
   * Decide whether this order's lifecycle goes through OUT_FOR_SERVICE.
   * Table service (DINE_IN_*, or HYBRID with a tableId) needs it because a
   * server walks the dish to the table. Self-service / parcel / counter
   * collection skip it — the customer picks up from the counter, so READY
   * goes straight to SERVED.
   */
  private needsOutForService(outletType: OutletType | null | undefined, tableId: string | null | undefined): boolean {
    switch (outletType) {
      case OutletType.SELF_SERVICE:
      case OutletType.SELF_SERVICE_PARCEL:
        return false;
      case OutletType.DINE_IN_PREPAID:
      case OutletType.DINE_IN_POSTPAID:
        return true;
      case OutletType.HYBRID:
        return !!tableId; // table → table-service path; parcel/counter → skip
      default:
        // Unknown / null outlet config: be permissive so legacy orders still close.
        return true;
    }
  }

  private validateStatusTransition(
    current: OrderStatus,
    next: OrderStatus,
    ctx: { outletType?: OutletType | null; tableId?: string | null } = {},
  ) {
    const skipService = !this.needsOutForService(ctx.outletType, ctx.tableId);
    const readyNext = skipService
      ? [OrderStatus.SERVED, OrderStatus.CANCELLED]                         // counter-collect path
      : [OrderStatus.OUT_FOR_SERVICE, OrderStatus.CANCELLED];               // table-service path

    const allowed: Record<OrderStatus, OrderStatus[]> = {
      CREATED:         [OrderStatus.QUEUED, OrderStatus.CANCELLED],
      QUEUED:          [OrderStatus.PREPARING, OrderStatus.CANCELLED],
      PREPARING:       [OrderStatus.READY, OrderStatus.CANCELLED],
      READY:           readyNext,
      OUT_FOR_SERVICE: [OrderStatus.SERVED],
      SERVED:          [OrderStatus.DISPUTED],
      CANCELLED:       [],
      DISPUTED:        [OrderStatus.RESOLVED, OrderStatus.FOR_REFUND],
      RESOLVED:        [],
      FOR_REFUND:      [OrderStatus.REFUND_COMPLETE],
      REFUND_COMPLETE: [],
    };
    if (current === next) return;
    if (!allowed[current].includes(next)) {
      const reason = skipService && next === OrderStatus.OUT_FOR_SERVICE
        ? 'This outlet is counter-collect — orders go straight from READY to SERVED.'
        : `Cannot transition from ${current} to ${next}`;
      throw new BadRequestException(reason);
    }
  }

  // ─── Postpaid (Dine-in Postpaid) flow ──────────────────────────────────
  // The "open" order on a table is the unfinished postpaid one: items can
  // still be appended until Bill Now is pressed (billRequestedAt set).

  async findOpenForTable(outletId: string, tableId: string, lang: string | null) {
    if (!tableId) throw new BadRequestException('tableId is required');
    const order = await this.prisma.order.findFirst({
      where: {
        outletId,
        tableId,
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
      dto.items,
      gstOn ? { viewerTagId, tableTypeId, outletDefaultPct } : null,
    );

    // Persist new items, then recompute totals across every line on the order.
    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.orderItem.createMany({
        data: newItems.map((i) => ({ ...i, orderId })),
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
}
