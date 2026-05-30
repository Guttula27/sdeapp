"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrdersService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../config/prisma/prisma.service");
const orders_gateway_1 = require("./orders.gateway");
const client_1 = require("@prisma/client");
const translations_service_1 = require("../translations/translations.service");
const lifecycle_dispatcher_service_1 = require("../customer-alerts/lifecycle-dispatcher.service");
const pricing_service_1 = require("../pricing/pricing.service");
const rewards_service_1 = require("../rewards/rewards.service");
const service_stations_service_1 = require("../service-stations/service-stations.service");
let OrdersService = class OrdersService {
    constructor(prisma, ordersGateway, translations, dispatcher, pricing, rewards, serviceStations) {
        this.prisma = prisma;
        this.ordersGateway = ordersGateway;
        this.translations = translations;
        this.dispatcher = dispatcher;
        this.pricing = pricing;
        this.rewards = rewards;
        this.serviceStations = serviceStations;
    }
    async hydrateOrders(orders, lang) {
        if (!lang || lang === 'en' || !orders?.length)
            return orders;
        const allItems = orders.flatMap((o) => (o.items ?? []).map((oi) => oi.item).filter(Boolean));
        const allVariants = orders.flatMap((o) => (o.items ?? []).map((oi) => oi.variant).filter(Boolean));
        const allOutlets = orders.map((o) => o.outlet).filter(Boolean);
        await Promise.all([
            this.translations.hydrate('Item', allItems, ['name', 'description'], lang),
            this.translations.hydrate('Variant', allVariants, ['name', 'shortDescription'], lang),
            this.translations.hydrate('Outlet', allOutlets, ['name', 'address'], lang),
        ]);
        return orders;
    }
    async create(outletId, dto, userId) {
        const outlet = await this.prisma.outlet.findUnique({
            where: { id: outletId },
            select: { gstApplicable: true, gstPercent: true, priceIncludesGst: true, businessId: true },
        });
        const gstOn = !!outlet?.gstApplicable;
        const outletDefaultPct = gstOn ? Number(outlet?.gstPercent ?? 0) : 0;
        let viewerTagId = null;
        if (userId) {
            const a = await this.prisma.customerTagAssignment.findUnique({
                where: { userId_outletId: { userId, outletId } },
            });
            viewerTagId = a?.customerTagId ?? null;
        }
        let tableTypeId = null;
        if (dto.tableId) {
            const t = await this.prisma.table.findUnique({
                where: { id: dto.tableId },
                select: { tableTypeId: true, outletId: true },
            });
            if (t?.outletId === outletId)
                tableTypeId = t.tableTypeId;
        }
        const expanded = [];
        for (const li of dto.items) {
            const parent = await this.prisma.item.findUnique({
                where: { id: li.itemId },
                include: {
                    bundleChildren: { orderBy: { displayOrder: 'asc' } },
                },
            });
            if (parent?.isBundle) {
                if (!parent.bundleChildren.length) {
                    throw new common_1.BadRequestException('Bundle has no items configured');
                }
                let childrenForOrder = parent.bundleChildren;
                const maxPicks = parent.maxBundleSelections ?? 0;
                if (maxPicks > 0) {
                    const picks = li.bundleSelections;
                    if (!Array.isArray(picks) || picks.length !== maxPicks) {
                        throw new common_1.BadRequestException(`Bundle "${parent.name}" requires exactly ${maxPicks} selection${maxPicks === 1 ? '' : 's'}`);
                    }
                    if (new Set(picks).size !== picks.length) {
                        throw new common_1.BadRequestException(`Bundle "${parent.name}" selections must be unique`);
                    }
                    const validIds = new Set(parent.bundleChildren.map((c) => c.id));
                    for (const id of picks) {
                        if (!validIds.has(id)) {
                            throw new common_1.BadRequestException(`Bundle "${parent.name}" got an invalid selection`);
                        }
                    }
                    const bySelectedId = new Set(picks);
                    childrenForOrder = parent.bundleChildren.filter((c) => bySelectedId.has(c.id));
                }
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
            }
            else {
                expanded.push({ dto: li });
            }
        }
        const items = await this.resolveOrderItems(expanded.map((e) => e.dto), gstOn ? { viewerTagId, tableTypeId, outletDefaultPct } : null);
        for (let i = 0; i < items.length; i++) {
            const meta = expanded[i];
            if (!meta?.bundleId)
                continue;
            const line = items[i];
            line.bundleId = meta.bundleId;
            if (meta.isPrimary) {
                line.unitPrice = (meta.bundlePrice ?? 0) / Math.max(1, line.quantity);
                line.totalPrice = meta.bundlePrice ?? 0;
                if (meta.bundleGstRate !== undefined)
                    line.gstRate = meta.bundleGstRate;
                line.gstAmount = line.totalPrice * (line.gstRate / 100);
            }
            else {
                line.unitPrice = 0;
                line.totalPrice = 0;
                line.gstAmount = 0;
            }
            const bundleNote = `Bundle: ${meta.bundleName}`;
            line.notes = line.notes ? `${bundleNote} | ${line.notes}` : bundleNote;
        }
        const linesTotal = items.reduce((sum, i) => sum + i.totalPrice, 0);
        let subtotal;
        let taxAmount;
        if (gstOn && outlet?.priceIncludesGst) {
            taxAmount = items.reduce((s, i) => {
                const r = i.gstRate / 100;
                return s + (i.totalPrice - i.totalPrice / (1 + r));
            }, 0);
            subtotal = linesTotal - taxAmount;
            for (const i of items) {
                const r = i.gstRate / 100;
                const netLine = i.totalPrice / (1 + r);
                i.gstAmount = i.totalPrice - netLine;
                i.unitPrice = netLine / i.quantity;
                i.totalPrice = netLine;
            }
        }
        else {
            taxAmount = items.reduce((s, i) => s + i.gstAmount, 0);
            subtotal = linesTotal;
        }
        const sgstAmount = taxAmount / 2;
        const cgstAmount = taxAmount / 2;
        const parcelAmount = dto.isParcel ? await this.computeParcelCharge(outletId, items) : 0;
        let totalAmount = subtotal + taxAmount + parcelAmount;
        let discountAmount = 0;
        let appliedCouponId = null;
        let appliedCouponDiscount = 0;
        let appliedRewardPoints = 0;
        let appliedRewardAmount = 0;
        let resolvedCustomerId = userId;
        let resolvedStaffId;
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
        const promoLines = dto.items.map((li) => ({
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
            const preDiscount = subtotal + taxAmount + parcelAmount;
            totalAmount = quote.totalAmount;
            discountAmount = Math.max(0, preDiscount - quote.totalAmount);
            appliedCouponId = quote.coupon?.id ?? null;
            appliedCouponDiscount = quote.coupon?.amount ?? 0;
            appliedRewardPoints = quote.reward?.points ?? 0;
            appliedRewardAmount = quote.reward?.amount ?? 0;
        }
        catch (e) {
            if (dto.couponId || dto.rewardPoints)
                throw e;
        }
        const counters = await this.prisma.outlet.update({
            where: { id: outletId },
            data: {
                nextOrderSequence: { increment: 1 },
                nextTokenNumber: { increment: 1 },
            },
            select: { nextOrderSequence: true, nextTokenNumber: true, publicCode: true },
        });
        const orderSeq = counters.nextOrderSequence - 1;
        const tokenNumber = counters.nextTokenNumber - 1;
        const prefix = counters.publicCode || `OL-${outletId.slice(0, 8).toUpperCase()}`;
        const orderNumber = `ORD-${prefix}-${String(orderSeq).padStart(5, '0')}`;
        const stockDeltas = new Map();
        for (const line of items) {
            const itemId = line.itemId;
            stockDeltas.set(itemId, (stockDeltas.get(itemId) ?? 0) + line.quantity);
        }
        const order = await this.prisma.$transaction(async (tx) => {
            for (const [itemId, qty] of stockDeltas) {
                const res = await tx.item.updateMany({
                    where: { id: itemId, hasLimitedStock: true, availableQuantity: { gte: qty } },
                    data: { availableQuantity: { decrement: qty } },
                });
                if (res.count === 0) {
                    const refetch = await tx.item.findUnique({
                        where: { id: itemId },
                        select: { name: true, hasLimitedStock: true, availableQuantity: true },
                    });
                    if (refetch?.hasLimitedStock) {
                        throw new common_1.BadRequestException(refetch.availableQuantity > 0
                            ? `Only ${refetch.availableQuantity} of "${refetch.name}" left in stock`
                            : `"${refetch.name}" is out of stock`);
                    }
                }
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
                    discountAmount,
                    totalAmount,
                    items: {
                        create: items.map((it) => ({
                            ...it,
                            ...(it.bundleId ? { bundleId: it.bundleId } : {}),
                        })),
                    },
                    statusHistory: {
                        create: { status: client_1.OrderStatus.CREATED, changedBy: userId },
                    },
                    ...(dto.paymentMode
                        ? {
                            payments: {
                                create: {
                                    mode: dto.paymentMode,
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
            if (appliedRewardPoints > 0 && resolvedCustomerId) {
                const account = await tx.customerRewardAccount.upsert({
                    where: { userId: resolvedCustomerId },
                    create: { userId: resolvedCustomerId },
                    update: {},
                });
                if (account.balance < appliedRewardPoints) {
                    throw new common_1.BadRequestException('Insufficient reward points');
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
        if (order.customerId) {
            const baseUrl = process.env.CUSTOMER_APP_URL?.replace(/\/$/, '') || '';
            const receiptUrl = `${baseUrl}/receipt/${order.id}`;
            const lines = (order.items || []).map((oi) => ({
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
            this.dispatcher.fire('ORDER_PLACED', ctx).catch(() => { });
            if ((order.payments || []).some((p) => p.status === 'SUCCESS')) {
                this.dispatcher.fire('PAYMENT_RECEIVED', ctx).catch(() => { });
                this.tryEarnRewards(order.id, order.customerId, outletId, Number(order.subtotal)).catch(() => { });
            }
        }
        return order;
    }
    async findAll(outletId, filters, lang) {
        const page = Number(filters.page) || 1;
        const limit = Number(filters.limit) || 20;
        const status = filters.status;
        const where = { outletId, ...(status && { status }) };
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
                const visibility = [];
                if (tableIds.length)
                    visibility.push({ tableId: { in: tableIds } });
                if (userIsOnParcelStation) {
                    visibility.push({ isParcel: true });
                }
                else if (!parcelActive) {
                    visibility.push({ isParcel: true });
                }
                if (visibility.length === 0) {
                    where.tableId = '__none__';
                }
                else if (visibility.length === 1) {
                    Object.assign(where, visibility[0]);
                }
                else {
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
    async findAllScoped(filters, lang) {
        const page = Number(filters.page) || 1;
        const limit = Number(filters.limit) || 50;
        const where = {};
        if (filters.status)
            where.status = filters.status;
        if (filters.outletId)
            where.outletId = filters.outletId;
        if (filters.businessId)
            where.outlet = { businessId: filters.businessId };
        const [orders, total] = await Promise.all([
            this.prisma.order.findMany({
                where,
                include: {
                    items: { include: { item: true, variant: true } },
                    table: true,
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
    async findOne(id, lang) {
        const order = await this.prisma.order.findUnique({
            where: { id },
            include: {
                items: {
                    include: {
                        item: true,
                        variant: true,
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
        if (!order)
            throw new common_1.NotFoundException('Order not found');
        await this.hydrateOrders([order], lang);
        return order;
    }
    async findByOrderNumber(outletId, orderNumber, lang) {
        const trimmed = orderNumber.trim();
        if (!trimmed)
            throw new common_1.NotFoundException('Bill number is required');
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
        if (!order)
            throw new common_1.NotFoundException(`No order found with bill number ${trimmed} at this outlet`);
        await this.hydrateOrders([order], lang);
        return order;
    }
    async updateStatus(id, dto, userId) {
        const order = await this.prisma.order.findUnique({
            where: { id },
            include: { outlet: { select: { outletType: true, name: true, businessId: true } } },
        });
        if (!order)
            throw new common_1.NotFoundException('Order not found');
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
        if (dto.status === client_1.OrderStatus.READY_FOR_PICKUP && updated.customerId) {
            this.dispatcher.fire('PICKUP_READY', {
                customerId: updated.customerId,
                customerName: updated.customer?.name,
                customerPhone: updated.customer?.phone,
                businessId: order.outlet?.businessId ?? null,
                outletId: order.outletId,
                outletName: order.outlet?.name,
                orderId: updated.id,
                orderNumber: updated.orderNumber,
            }).catch(() => { });
        }
        return updated;
    }
    async tryEarnRewards(orderId, customerId, outletId, subtotal) {
        try {
            const existing = await this.prisma.rewardTransaction.findFirst({
                where: { orderId, type: 'EARN' },
                select: { id: true },
            });
            if (existing)
                return;
            await this.rewards.earnForOrder({
                userId: customerId,
                orderId,
                outletId,
                subtotal,
            });
        }
        catch {
        }
    }
    async cancel(id, userId, reason) {
        return this.updateStatus(id, { status: client_1.OrderStatus.CANCELLED, notes: reason }, userId);
    }
    async setSequences(orderId, payload) {
        const order = await this.prisma.order.findUnique({
            where: { id: orderId },
            include: { items: true },
        });
        if (!order)
            throw new common_1.NotFoundException('Order not found');
        if (payload.items?.length) {
            const byId = new Map(order.items.map((it) => [it.id, it]));
            for (const { itemId, sequenceNumber } of payload.items) {
                const item = byId.get(itemId);
                if (!item)
                    throw new common_1.BadRequestException(`Item ${itemId} is not part of this order`);
                if (item.status !== client_1.OrderItemStatus.PENDING && item.sequenceNumber !== sequenceNumber) {
                    throw new common_1.BadRequestException(`Item "${itemId}" is already ${item.status} — sequencing can only be edited on PENDING items`);
                }
                if (sequenceNumber != null && (!Number.isInteger(sequenceNumber) || sequenceNumber < 1)) {
                    throw new common_1.BadRequestException('sequenceNumber must be a positive integer or null');
                }
            }
            await this.prisma.$transaction(payload.items.map(({ itemId, sequenceNumber }) => this.prisma.orderItem.update({
                where: { id: itemId },
                data: { sequenceNumber },
            })));
        }
        if (payload.labels !== undefined) {
            await this.prisma.order.update({
                where: { id: orderId },
                data: { sequenceLabels: payload.labels === null ? null : payload.labels },
            });
        }
        await this.advanceCourseIfReady(orderId);
        const updated = await this.prisma.order.findUnique({
            where: { id: orderId },
            include: { items: { include: { item: true, variant: true } }, table: true },
        });
        if (updated)
            this.ordersGateway.emitOrderStatusUpdated(updated.outletId, updated);
        return updated;
    }
    async advanceCourseIfReady(orderId) {
        const order = await this.prisma.order.findUnique({
            where: { id: orderId },
            select: { activeSequence: true, items: { select: { sequenceNumber: true, status: true } } },
        });
        if (!order)
            return;
        let active = order.activeSequence;
        const live = order.items.filter((i) => i.status !== client_1.OrderItemStatus.CANCELLED);
        const sequenceNumbers = Array.from(new Set(live.map((i) => i.sequenceNumber).filter((n) => n != null))).sort((a, b) => a - b);
        if (sequenceNumbers.length === 0)
            return;
        while (true) {
            const atCurrent = live.filter((i) => i.sequenceNumber === active);
            if (atCurrent.length === 0) {
                const next = sequenceNumbers.find((n) => n > active);
                if (next == null)
                    break;
                active = next;
                continue;
            }
            const allDone = atCurrent.every((i) => i.status === client_1.OrderItemStatus.SERVED);
            if (!allDone)
                break;
            const next = sequenceNumbers.find((n) => n > active);
            if (next == null) {
                active = active + 1;
                break;
            }
            active = next;
        }
        if (active !== order.activeSequence) {
            await this.prisma.order.update({
                where: { id: orderId },
                data: { activeSequence: active },
            });
        }
    }
    async updateItemStatus(orderId, orderItemId, status, userId) {
        const item = await this.prisma.orderItem.findUnique({
            where: { id: orderItemId },
            include: { order: true, item: true },
        });
        if (!item || item.orderId !== orderId)
            throw new common_1.NotFoundException('Order item not found');
        if (userId) {
            const workerStation = await this.prisma.kitchenStation.findFirst({
                where: { currentWorkerId: userId, outletId: item.order.outletId, isActive: true },
                select: { id: true, isMaster: true },
            });
            if (workerStation && !workerStation.isMaster && item.item.kitchenStationId !== workerStation.id) {
                throw new common_1.ForbiddenException('You can only update items assigned to your station');
            }
        }
        this.validateItemTransition(item.status, status);
        await this.prisma.orderItem.update({
            where: { id: orderItemId },
            data: { status },
        });
        if (status === client_1.OrderItemStatus.SERVED) {
            await this.advanceCourseIfReady(orderId);
        }
        const rolledUp = await this.rollupOrderStatus(orderId, userId);
        const updated = await this.prisma.order.findUnique({
            where: { id: orderId },
            include: {
                items: { include: { item: true, variant: true } },
                table: true,
                customer: {
                    select: {
                        id: true, name: true, phone: true,
                        customerTagAssignments: { include: { customerTag: true } },
                    },
                },
                statusHistory: { orderBy: { createdAt: 'asc' } },
            },
        });
        if (updated)
            this.ordersGateway.emitOrderStatusUpdated(updated.outletId, updated);
        if (updated && status === client_1.OrderItemStatus.READY && item.status !== client_1.OrderItemStatus.READY && updated.customerId) {
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
            }).catch(() => { });
            if (rolledUp && updated.status === client_1.OrderStatus.READY) {
                this.dispatcher.fire('ORDER_READY', {
                    customerId: updated.customerId,
                    customerName: updated.customer?.name,
                    businessId: outletForBiz?.businessId ?? null,
                    outletId: updated.outletId,
                    outletName: outletForBiz?.name,
                    orderId: updated.id,
                    orderNumber: updated.orderNumber,
                }).catch(() => { });
            }
        }
        return { order: updated, rolledUp };
    }
    validateItemTransition(from, to) {
        const allowed = {
            PENDING: [client_1.OrderItemStatus.PREPARING, client_1.OrderItemStatus.CANCELLED],
            PREPARING: [client_1.OrderItemStatus.READY, client_1.OrderItemStatus.CANCELLED],
            READY: [client_1.OrderItemStatus.SERVED, client_1.OrderItemStatus.CANCELLED],
            SERVED: [],
            CANCELLED: [],
        };
        if (from === to)
            return;
        if (!allowed[from].includes(to)) {
            throw new common_1.BadRequestException(`Cannot move item from ${from} to ${to}`);
        }
    }
    async rollupOrderStatus(orderId, userId) {
        const order = await this.prisma.order.findUnique({
            where: { id: orderId },
            include: { items: { select: { status: true } } },
        });
        if (!order || order.items.length === 0)
            return null;
        const frozen = [
            client_1.OrderStatus.READY_FOR_PICKUP, client_1.OrderStatus.OUT_FOR_SERVICE,
            client_1.OrderStatus.SERVED, client_1.OrderStatus.CANCELLED,
            client_1.OrderStatus.DISPUTED, client_1.OrderStatus.RESOLVED,
            client_1.OrderStatus.FOR_REFUND, client_1.OrderStatus.REFUND_COMPLETE,
        ];
        if (frozen.includes(order.status))
            return null;
        const live = order.items.filter(i => i.status !== client_1.OrderItemStatus.CANCELLED);
        if (live.length === 0)
            return null;
        let derived = null;
        if (live.every(i => i.status === client_1.OrderItemStatus.READY || i.status === client_1.OrderItemStatus.SERVED))
            derived = client_1.OrderStatus.READY;
        else if (live.some(i => i.status === client_1.OrderItemStatus.PREPARING || i.status === client_1.OrderItemStatus.READY))
            derived = client_1.OrderStatus.PREPARING;
        if (!derived)
            return null;
        const orderFlow = [
            client_1.OrderStatus.CREATED, client_1.OrderStatus.QUEUED, client_1.OrderStatus.PREPARING, client_1.OrderStatus.READY,
        ];
        const currentIdx = orderFlow.indexOf(order.status);
        const derivedIdx = orderFlow.indexOf(derived);
        if (currentIdx < 0 || derivedIdx <= currentIdx)
            return null;
        await this.prisma.order.update({
            where: { id: orderId },
            data: {
                status: derived,
                statusHistory: { create: { status: derived, changedBy: userId, notes: 'Auto-rolled up from item statuses' } },
            },
        });
        return derived;
    }
    async resolveOrderItems(items, gstCtx) {
        return Promise.all(items.map(async (i) => {
            const item = await this.prisma.item.findUnique({
                where: { id: i.itemId },
                include: {
                    subcategory: { select: { category: { select: { menuId: true } } } },
                    customerTagPrices: gstCtx?.viewerTagId
                        ? { where: { customerTagId: gstCtx.viewerTagId } }
                        : false,
                    tableTypePrices: gstCtx?.tableTypeId
                        ? { where: { tableTypeId: gstCtx.tableTypeId } }
                        : false,
                },
            });
            if (!item)
                throw new common_1.NotFoundException(`Item ${i.itemId} not found`);
            if (!item.isAvailable)
                throw new common_1.BadRequestException(`Item "${item.name}" is not available`);
            if (item.hasLimitedStock && item.availableQuantity < i.quantity) {
                throw new common_1.BadRequestException(item.availableQuantity > 0
                    ? `Only ${item.availableQuantity} of "${item.name}" left in stock`
                    : `"${item.name}" is out of stock`);
            }
            let unitPrice = Number(item.basePrice);
            if (i.variantId) {
                const variant = await this.prisma.variant.findUnique({ where: { id: i.variantId } });
                if (variant)
                    unitPrice = Number(variant.price);
            }
            let gstRate = 0;
            if (gstCtx) {
                const ttPrice = item.tableTypePrices?.find((p) => p.tableTypeId === gstCtx.tableTypeId &&
                    (i.variantId ? p.variantId === i.variantId : !p.variantId));
                const ctPrice = item.customerTagPrices?.find((p) => p.customerTagId === gstCtx.viewerTagId &&
                    (i.variantId ? p.variantId === i.variantId : !p.variantId));
                if (ttPrice?.gstRate != null)
                    gstRate = Number(ttPrice.gstRate);
                else if (ctPrice?.gstRate != null)
                    gstRate = Number(ctPrice.gstRate);
                else if (item.gstRate != null)
                    gstRate = Number(item.gstRate);
                else
                    gstRate = gstCtx.outletDefaultPct;
            }
            const toppingNotes = [];
            if (i.toppings?.length) {
                const allowed = await this.prisma.itemTopping.findMany({
                    where: { itemId: i.itemId, toppingId: { in: i.toppings.map((t) => t.toppingId) } },
                    include: { topping: { include: { options: true } } },
                });
                const allowedMap = new Map(allowed.map(a => [a.toppingId, a]));
                for (const t of i.toppings) {
                    const link = allowedMap.get(t.toppingId);
                    if (!link)
                        throw new common_1.BadRequestException(`Topping ${t.toppingId} is not available for this item`);
                    const basePriceAdd = link.priceAdd != null ? Number(link.priceAdd) : Number(link.topping.basePriceAdd);
                    let optionLabel = '';
                    let optionAdd = 0;
                    if (t.optionId) {
                        const opt = link.topping.options.find(o => o.id === t.optionId);
                        if (!opt)
                            throw new common_1.BadRequestException(`Option ${t.optionId} not valid for ${link.topping.name}`);
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
                menuId: item.subcategory?.category?.menuId ?? null,
            };
        }));
    }
    async computeParcelCharge(outletId, items) {
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
            if (!meta)
                continue;
            if (!meta.parcelAvailable) {
                throw new common_1.BadRequestException(`Item "${meta.name}" is not available for parcel`);
            }
            if (meta.useCustomParcelCharge && meta.parcelCharge != null) {
                total += Number(meta.parcelCharge) * line.quantity;
            }
            else {
                anyUsesUniversal = true;
            }
        }
        if (anyUsesUniversal && outlet?.parcelChargeEnabled) {
            total += Number(outlet.defaultParcelCharge);
        }
        return total;
    }
    needsOutForService(outletType, tableId) {
        switch (outletType) {
            case client_1.OutletType.SELF_SERVICE:
            case client_1.OutletType.SELF_SERVICE_PARCEL:
                return false;
            case client_1.OutletType.DINE_IN_PREPAID:
            case client_1.OutletType.DINE_IN_POSTPAID:
                return true;
            case client_1.OutletType.HYBRID:
                return !!tableId;
            default:
                return true;
        }
    }
    validateStatusTransition(current, next, ctx = {}) {
        const parcelPath = !!ctx.isParcel;
        const skipService = !parcelPath && !this.needsOutForService(ctx.outletType, ctx.tableId);
        let readyNext;
        if (parcelPath) {
            readyNext = [client_1.OrderStatus.READY_FOR_PICKUP, client_1.OrderStatus.SERVED, client_1.OrderStatus.CANCELLED];
        }
        else if (skipService) {
            readyNext = [client_1.OrderStatus.SERVED, client_1.OrderStatus.CANCELLED];
        }
        else {
            readyNext = [client_1.OrderStatus.OUT_FOR_SERVICE, client_1.OrderStatus.CANCELLED];
        }
        const allowed = {
            CREATED: [client_1.OrderStatus.QUEUED, client_1.OrderStatus.CANCELLED],
            QUEUED: [client_1.OrderStatus.PREPARING, client_1.OrderStatus.CANCELLED],
            PREPARING: [client_1.OrderStatus.READY, client_1.OrderStatus.CANCELLED],
            READY: readyNext,
            READY_FOR_PICKUP: [client_1.OrderStatus.SERVED, client_1.OrderStatus.CANCELLED],
            OUT_FOR_SERVICE: [client_1.OrderStatus.SERVED],
            SERVED: [client_1.OrderStatus.DISPUTED],
            CANCELLED: [],
            DISPUTED: [client_1.OrderStatus.RESOLVED, client_1.OrderStatus.FOR_REFUND],
            RESOLVED: [],
            FOR_REFUND: [client_1.OrderStatus.REFUND_COMPLETE],
            REFUND_COMPLETE: [],
        };
        if (current === next)
            return;
        if (!allowed[current].includes(next)) {
            const reason = skipService && next === client_1.OrderStatus.OUT_FOR_SERVICE
                ? 'This outlet is counter-collect — orders go straight from READY to SERVED.'
                : `Cannot transition from ${current} to ${next}`;
            throw new common_1.BadRequestException(reason);
        }
    }
    async findOpenForTable(outletId, tableId, lang) {
        if (!tableId)
            throw new common_1.BadRequestException('tableId is required');
        const order = await this.prisma.order.findFirst({
            where: {
                outletId,
                tableId,
                isPostpaid: true,
                billRequestedAt: null,
                status: { notIn: [client_1.OrderStatus.CANCELLED, client_1.OrderStatus.SERVED, client_1.OrderStatus.REFUND_COMPLETE] },
            },
            orderBy: { createdAt: 'desc' },
            include: {
                items: { include: { item: true, variant: true } },
                table: true,
                outlet: { select: { id: true, name: true, outletType: true } },
            },
        });
        if (!order)
            return null;
        await this.hydrateOrders([order], lang);
        return order;
    }
    async appendItems(orderId, dto, userId) {
        if (!dto.items?.length)
            throw new common_1.BadRequestException('items is required');
        const existing = await this.prisma.order.findUnique({
            where: { id: orderId },
            select: {
                id: true, outletId: true, tableId: true, customerId: true, status: true,
                isPostpaid: true, billRequestedAt: true, parcelAmount: true,
            },
        });
        if (!existing)
            throw new common_1.NotFoundException('Order not found');
        if (!existing.isPostpaid)
            throw new common_1.BadRequestException('Items can only be appended to a postpaid order');
        if (existing.billRequestedAt)
            throw new common_1.BadRequestException('Bill already requested — items can no longer be appended');
        if (existing.status === client_1.OrderStatus.CANCELLED)
            throw new common_1.BadRequestException('Order is cancelled');
        const outlet = await this.prisma.outlet.findUnique({
            where: { id: existing.outletId },
            select: { gstApplicable: true, gstPercent: true, priceIncludesGst: true },
        });
        const gstOn = !!outlet?.gstApplicable;
        const outletDefaultPct = gstOn ? Number(outlet?.gstPercent ?? 0) : 0;
        let viewerTagId = null;
        if (existing.customerId) {
            const a = await this.prisma.customerTagAssignment.findUnique({
                where: { userId_outletId: { userId: existing.customerId, outletId: existing.outletId } },
            });
            viewerTagId = a?.customerTagId ?? null;
        }
        let tableTypeId = null;
        if (existing.tableId) {
            const t = await this.prisma.table.findUnique({
                where: { id: existing.tableId },
                select: { tableTypeId: true, outletId: true },
            });
            if (t?.outletId === existing.outletId)
                tableTypeId = t.tableTypeId;
        }
        const newItems = await this.resolveOrderItems(dto.items, gstOn ? { viewerTagId, tableTypeId, outletDefaultPct } : null);
        const updated = await this.prisma.$transaction(async (tx) => {
            await tx.orderItem.createMany({
                data: newItems.map((i) => ({ ...i, orderId })),
            });
            const allItems = await tx.orderItem.findMany({
                where: { orderId, status: { not: client_1.OrderItemStatus.CANCELLED } },
            });
            const linesTotal = allItems.reduce((s, i) => s + Number(i.totalPrice), 0);
            let taxAmount;
            let subtotal;
            if (gstOn && outlet?.priceIncludesGst) {
                taxAmount = allItems.reduce((s, i) => {
                    const r = Number(i.gstRate) / 100;
                    const gross = Number(i.totalPrice);
                    return s + (gross - gross / (1 + r));
                }, 0);
                subtotal = linesTotal - taxAmount;
            }
            else {
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
    async requestBill(orderId, _userId) {
        const order = await this.prisma.order.findUnique({
            where: { id: orderId },
            select: { id: true, outletId: true, isPostpaid: true, billRequestedAt: true, status: true },
        });
        if (!order)
            throw new common_1.NotFoundException('Order not found');
        if (!order.isPostpaid)
            throw new common_1.BadRequestException('Bill Now only applies to postpaid orders');
        if (order.billRequestedAt) {
            return this.findOne(orderId, null);
        }
        if (order.status === client_1.OrderStatus.CANCELLED)
            throw new common_1.BadRequestException('Order is cancelled');
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
};
exports.OrdersService = OrdersService;
exports.OrdersService = OrdersService = __decorate([
    (0, common_1.Injectable)(),
    __param(3, (0, common_1.Inject)((0, common_1.forwardRef)(() => lifecycle_dispatcher_service_1.LifecycleDispatcherService))),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        orders_gateway_1.OrdersGateway,
        translations_service_1.TranslationsService,
        lifecycle_dispatcher_service_1.LifecycleDispatcherService,
        pricing_service_1.PricingService,
        rewards_service_1.RewardsService,
        service_stations_service_1.ServiceStationsService])
], OrdersService);
//# sourceMappingURL=orders.service.js.map