import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../../config/prisma/prisma.service';
import { OrdersService } from '../orders/orders.service';
import { OrdersGateway } from '../orders/orders.gateway';
import { RazorpayService } from '../payments/razorpay.service';
import { RewardsService } from '../rewards/rewards.service';
import { CreateClusterOrderDto, VerifyClusterPaymentDto } from './dto/create-cluster-order.dto';
import { EncryptionService } from '../../config/crypto/encryption.service';

// One entry per outlet in the cluster's payment split. Persisted to
// ClusterOrder.routeTransfers as JSON; mirrors the structure Razorpay Route
// uses when we drop the stub flag in production.
type TransferEntry = {
  outletId: string;
  outletName: string;
  childOrderId: string;
  childOrderNumber: string;
  razorpayLinkedAccountId: string | null;
  amountInRupees: number;
  status: 'PENDING' | 'COMPLETED' | 'STUBBED' | 'BYPASSED' | 'FAILED';
  transferId?: string;
  error?: string;
};

@Injectable()
export class ClusterOrdersService {
  constructor(
    private prisma: PrismaService,
    private orders: OrdersService,
    private ordersGateway: OrdersGateway,
    private razorpay: RazorpayService,
    private rewards: RewardsService,
    private encryption: EncryptionService,
  ) {}

  // ───────────────────────────────────────────────────────────
  // CREATE: customer submits cart with items from multiple outlets.
  // We group by outletId, validate every outlet is a member of the cluster,
  // create one child Order per group (no Payment yet), wrap them in a
  // ClusterOrder parent, then create a Razorpay Route order so the client
  // can fire the checkout. Payment verification happens in `verify()`.
  // ───────────────────────────────────────────────────────────
  async create(dto: CreateClusterOrderDto, customerUserId?: string) {
    const cluster = await this.prisma.business.findUnique({
      where: { id: dto.clusterBusinessId },
    });
    if (!cluster) throw new NotFoundException('Cluster not found');
    if (!cluster.isCluster) throw new BadRequestException('That business is not a cluster');
    if (!dto.items?.length) throw new BadRequestException('Cart is empty');

    // Group cart items by outlet. Map preserves first-seen order for nicer
    // child-order numbering / display.
    const groups = new Map<string, typeof dto.items>();
    for (const it of dto.items) {
      const list = groups.get(it.outletId) ?? [];
      list.push(it);
      groups.set(it.outletId, list);
    }

    // Validate every cart outlet is a current member of this cluster.
    const outletIds = Array.from(groups.keys());
    const members = await this.prisma.clusterMember.findMany({
      where: { clusterBusinessId: cluster.id, outletId: { in: outletIds } },
      include: { outlet: { select: { id: true, name: true, razorpayLinkedAccountId: true } } },
    });
    if (members.length !== outletIds.length) {
      const memberIds = new Set(members.map((m) => m.outletId));
      const missing = outletIds.filter((id) => !memberIds.has(id));
      throw new BadRequestException(`Outlet(s) not in this cluster: ${missing.join(', ')}`);
    }

    // For a table-scoped cluster checkout we want each child order to carry
    // the *outlet's own* tableId if the cluster-level table belongs to it.
    // Other outlets get tableId=null (their kitchen treats the order as
    // counter-style for that outlet's purposes).
    const tableInfo = dto.tableId
      ? await this.prisma.table.findUnique({ where: { id: dto.tableId }, select: { id: true, outletId: true } })
      : null;

    // ── Create child orders (NO paymentMode → no Payment rows yet) ──
    // We rely on OrdersService.create() for all the heavy lifting: tax /
    // GST / parcel / stock decrement / orderNumber sequencing / lifecycle.
    // Each group becomes one child Order tagged with clusterOrderId so the
    // parent's payment verifies + closes them all together.
    const childOrders: any[] = [];
    let aggregateSubtotal = 0;
    let aggregateTax = 0;
    let aggregateParcel = 0;
    let aggregateTotal = 0;

    for (const [outletId, items] of groups.entries()) {
      const child = await this.orders.create(
        outletId,
        {
          items: items.map((i) => ({
            itemId: i.itemId,
            variantId: i.variantId,
            quantity: i.quantity,
            notes: i.notes,
            toppings: i.toppings,
          })),
          tableId: tableInfo?.outletId === outletId ? tableInfo.id : undefined,
          isParcel: dto.isParcel,
          notes: dto.notes,
          // paymentMode intentionally omitted — Payment row is attached on
          // cluster-level payment verification (verify() / bypass()).
        } as any,
        customerUserId,
      );
      childOrders.push(child);
      aggregateSubtotal += Number(child.subtotal);
      aggregateTax += Number(child.taxAmount);
      aggregateParcel += Number(child.parcelAmount);
      aggregateTotal += Number(child.totalAmount);
    }

    // ── Allocate cluster order number ────────────────────────
    const clusterOrderNumber = `CLU-${cluster.publicCode || cluster.id.slice(0, 4)}-${crypto
      .randomBytes(3)
      .toString('hex')
      .toUpperCase()}`;

    // ── Pre-compute the route split (one transfer per child) ──
    const transfers: TransferEntry[] = childOrders.map((c) => {
      const m = members.find((mm) => mm.outletId === c.outletId)!;
      return {
        outletId: c.outletId,
        outletName: m.outlet.name,
        childOrderId: c.id,
        childOrderNumber: c.orderNumber,
        // LA id is encrypted at rest — decrypt here so the precomputed
        // transfers list (and the downstream Razorpay payload) carry
        // the plaintext acc_... id Razorpay expects.
        razorpayLinkedAccountId: this.encryption.decrypt(m.outlet.razorpayLinkedAccountId),
        amountInRupees: Number(c.totalAmount),
        status: 'PENDING',
      };
    });

    // ── Create the ClusterOrder parent ───────────────────────
    const parent = await this.prisma.clusterOrder.create({
      data: {
        clusterOrderNumber,
        clusterBusinessId: cluster.id,
        customerId: customerUserId ?? null,
        tableId: dto.tableId ?? null,
        subtotal: aggregateSubtotal,
        taxAmount: aggregateTax,
        parcelAmount: aggregateParcel,
        totalAmount: aggregateTotal,
        paymentStatus: 'PENDING',
        routeTransfers: transfers as any,
      },
    });

    // ── Attach children to parent ────────────────────────────
    await this.prisma.order.updateMany({
      where: { id: { in: childOrders.map((c) => c.id) } },
      data: { clusterOrderId: parent.id },
    });

    // ── Create Razorpay Route order ──────────────────────────
    // In stub mode this returns a fake id; verify() will still flow.
    // If any LA is missing in production mode we record the gap as a soft
    // warning rather than failing — the platform can still collect and we
    // patch the LA later via reconciliation.
    let razorpayOrder: any = null;
    try {
      razorpayOrder = await this.razorpay.createRouteOrder({
        amountInRupees: aggregateTotal,
        receipt: clusterOrderNumber,
        notes: { clusterOrderId: parent.id, clusterBusinessId: cluster.id },
        transfers: transfers
          .filter((t) => t.razorpayLinkedAccountId) // skip outlets w/o LA
          .map((t) => ({
            account: t.razorpayLinkedAccountId!,
            amountInRupees: t.amountInRupees,
            notes: { childOrderId: t.childOrderId, outletId: t.outletId },
          })),
      });
    } catch (e: any) {
      // Gateway failure or missing config — leave the cluster order in
      // PENDING. Customer can retry payment or use bypass.
      razorpayOrder = null;
    }

    if (razorpayOrder) {
      await this.prisma.clusterOrder.update({
        where: { id: parent.id },
        data: { razorpayOrderId: razorpayOrder.id, paymentMethod: 'RAZORPAY' },
      });
    }

    return {
      clusterOrder: { ...parent, razorpayOrderId: razorpayOrder?.id ?? null },
      childOrders,
      razorpay: razorpayOrder
        ? {
            keyId: this.razorpay.keyId || 'rzp_stub',
            orderId: razorpayOrder.id,
            amount: razorpayOrder.amount,
            currency: razorpayOrder.currency,
            stubbed: !!razorpayOrder.stubbed,
          }
        : null,
    };
  }

  // ───────────────────────────────────────────────────────────
  // VERIFY: Razorpay Checkout posts back paymentId + signature on success.
  // We confirm the signature, persist the payment ids on the parent,
  // create per-child Payment rows so each outlet's books reconcile, and
  // flip the routeTransfers entries to COMPLETED (or STUBBED in test mode).
  // ───────────────────────────────────────────────────────────
  async verify(clusterOrderId: string, dto: VerifyClusterPaymentDto) {
    const parent = await this.prisma.clusterOrder.findUnique({
      where: { id: clusterOrderId },
      include: { childOrders: true },
    });
    if (!parent) throw new NotFoundException('Cluster order not found');
    if (parent.paymentStatus === 'SUCCESS') {
      // Idempotent — already verified, return the existing state.
      return { ok: true, alreadyPaid: true };
    }
    if (!parent.razorpayOrderId) throw new BadRequestException('No Razorpay order on this cluster order');

    // In stub mode the signature is bogus, so skip the strict check.
    const stubbed = this.razorpay.isStubbed();
    if (!stubbed) {
      const valid = this.razorpay.verifyHandlerSignature(
        parent.razorpayOrderId,
        dto.razorpayPaymentId,
        dto.razorpaySignature,
      );
      if (!valid) throw new BadRequestException('Razorpay signature mismatch');
    }

    await this.markPaid(parent.id, {
      method: 'RAZORPAY',
      razorpayPaymentId: dto.razorpayPaymentId,
      razorpaySignature: dto.razorpaySignature,
      stubbed,
    });

    return { ok: true };
  }

  // ───────────────────────────────────────────────────────────
  // BYPASS: testing-only path. Marks the cluster order paid without going
  // through Razorpay at all. Mirrors the existing single-outlet "Testing
  // Bypass" the customer payment page exposes.
  // ───────────────────────────────────────────────────────────
  async bypass(clusterOrderId: string) {
    const parent = await this.prisma.clusterOrder.findUnique({ where: { id: clusterOrderId } });
    if (!parent) throw new NotFoundException('Cluster order not found');
    if (parent.paymentStatus === 'SUCCESS') return { ok: true, alreadyPaid: true };

    await this.markPaid(parent.id, { method: 'BYPASS' });
    return { ok: true };
  }

  // Shared finalize step for verify + bypass. Creates per-child Payment
  // rows, updates the parent, rewrites the routeTransfers JSON with the
  // post-payment status, and emits orderCreated sockets so the kitchen
  // sees the new orders only AFTER payment has been confirmed.
  private async markPaid(
    clusterOrderId: string,
    opts: {
      method: 'RAZORPAY' | 'BYPASS';
      razorpayPaymentId?: string;
      razorpaySignature?: string;
      stubbed?: boolean;
    },
  ) {
    const parent = await this.prisma.clusterOrder.findUnique({
      where: { id: clusterOrderId },
      include: { childOrders: true },
    });
    if (!parent) return;

    const newTransfers = (parent.routeTransfers as unknown as TransferEntry[]).map((t) => ({
      ...t,
      status:
        opts.method === 'BYPASS'
          ? 'BYPASSED'
          : opts.stubbed
            ? 'STUBBED'
            : 'COMPLETED',
    } as TransferEntry));

    await this.prisma.$transaction([
      this.prisma.clusterOrder.update({
        where: { id: parent.id },
        data: {
          paymentMethod: opts.method,
          paymentStatus: 'SUCCESS',
          razorpayPaymentId: opts.razorpayPaymentId ?? parent.razorpayPaymentId,
          razorpaySignature: opts.razorpaySignature ?? parent.razorpaySignature,
          routeTransfers: newTransfers as any,
        },
      }),
      // One Payment row per child Order. mode='UPI' is a placeholder; the
      // actual mode (UPI/CARD/etc.) would be filled from Razorpay's payment
      // capture webhook in production.
      ...parent.childOrders.map((c) =>
        this.prisma.payment.create({
          data: {
            orderId: c.id,
            mode: 'UPI' as any,
            amount: c.totalAmount,
            status: 'SUCCESS',
            gatewayRef: opts.razorpayPaymentId ?? `cluster:${opts.method.toLowerCase()}`,
          },
        }),
      ),
    ]);

    // Re-emit orderCreated for each child so its outlet's kitchen picks it
    // up. Skipping this on initial create means unpaid cluster orders never
    // appear in the kitchen — a small but important UX guarantee.
    for (const c of parent.childOrders) {
      const fresh = await this.prisma.order.findUnique({
        where: { id: c.id },
        include: {
          items: { include: { item: true, variant: true } },
          table: true,
          outlet: { select: { id: true, name: true, address: true, gstNumber: true, upiId: true, logoUrl: true, outletType: true } },
          payments: true,
          customer: { select: { id: true, name: true, phone: true } },
        },
      });
      if (fresh) this.ordersGateway.emitOrderCreated(c.outletId, fresh);
    }

    // Reward points: credit the customer once per child order. Each child
    // earns on its own subtotal — keeps the calculation aligned with each
    // outlet's actual revenue. Idempotent against retries via the EARN
    // transaction lookup.
    if (parent.customerId) {
      for (const c of parent.childOrders) {
        try {
          const existing = await this.prisma.rewardTransaction.findFirst({
            where: { orderId: c.id, type: 'EARN' },
            select: { id: true },
          });
          if (existing) continue;
          await this.rewards.earnForOrder({
            userId: parent.customerId,
            orderId: c.id,
            clusterOrderId: parent.id,
            outletId: c.outletId,
            subtotal: Number(c.subtotal),
          });
        } catch {
          // Best-effort — don't block payment flow on a reward credit fail.
        }
      }
    }
  }

  // ───────────────────────────────────────────────────────────
  // Reads
  // ───────────────────────────────────────────────────────────
  async findOne(clusterOrderId: string) {
    const parent = await this.prisma.clusterOrder.findUnique({
      where: { id: clusterOrderId },
      include: {
        clusterBusiness: { select: { id: true, name: true, logoUrl: true, publicCode: true } },
        childOrders: {
          include: {
            items: { include: { item: true, variant: true } },
            outlet: { select: { id: true, name: true, logoUrl: true } },
            payments: true,
          },
        },
      },
    });
    if (!parent) throw new NotFoundException('Cluster order not found');
    return parent;
  }

  async listForCustomer(customerId: string) {
    return this.prisma.clusterOrder.findMany({
      where: { customerId },
      orderBy: { createdAt: 'desc' },
      include: {
        clusterBusiness: { select: { id: true, name: true, logoUrl: true } },
        childOrders: {
          select: { id: true, orderNumber: true, status: true, totalAmount: true, outlet: { select: { id: true, name: true } } },
        },
      },
    });
  }
}
