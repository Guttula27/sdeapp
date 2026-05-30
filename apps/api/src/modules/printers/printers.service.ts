import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../config/prisma/prisma.service';

type KitchenReceiptLine = {
  itemName: string;
  variantName: string | null;
  toppings: string | null;
  quantity: number;
  notes: string | null;
};

export type KitchenReceipt = {
  orderId: string;
  orderNumber: string;
  tokenNumber: number | null;
  outletName: string;
  table: string | null;
  section: string | null;
  isParcel: boolean;
  stationId: string;
  stationName: string;
  printer: { id: string; name: string; connection: string; address: string | null } | null;
  printedAt: string;
  lines: KitchenReceiptLine[];
};

@Injectable()
export class PrintersService {
  constructor(private prisma: PrismaService) {}

  list(outletId: string) {
    return this.prisma.printer.findMany({
      where: { outletId, isActive: true },
      orderBy: { createdAt: 'asc' },
      include: { stations: { select: { id: true, name: true } } },
    });
  }

  create(outletId: string, data: { name: string; connection?: string; address?: string; model?: string }) {
    return this.prisma.printer.create({
      data: {
        outletId,
        name: data.name,
        connection: data.connection || 'BLUETOOTH',
        address: data.address ?? null,
        model: data.model ?? null,
      },
    });
  }

  async update(id: string, data: { name?: string; connection?: string; address?: string | null; model?: string | null }) {
    const printer = await this.prisma.printer.findUnique({ where: { id } });
    if (!printer) throw new NotFoundException('Printer not found');
    return this.prisma.printer.update({ where: { id }, data });
  }

  async delete(id: string) {
    // Detach any station pointing here, then soft-delete the printer.
    await this.prisma.kitchenStation.updateMany({
      where: { printerId: id },
      data: { printerId: null },
    });
    return this.prisma.printer.update({
      where: { id },
      data: { isActive: false },
    });
  }

  // Build the kitchen-ticket payloads for an order. Items are grouped by the
  // station that owns them (via Item.kitchenStationId) — one receipt per
  // station that has at least one line. The caller decides whether to
  // actually print (auto vs. manual; printer present vs. not).
  async buildKitchenReceipts(orderId: string, opts?: { stationId?: string }): Promise<KitchenReceipt[]> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        outlet: { select: { id: true, name: true } },
        section: { select: { name: true } },
        table: { select: { number: true } },
        items: {
          include: {
            item: {
              select: {
                name: true,
                kitchenStationId: true,
                kitchenStation: {
                  select: {
                    id: true, name: true,
                    printer: { select: { id: true, name: true, connection: true, address: true } },
                  },
                },
              },
            },
            variant: { select: { name: true } },
          },
        },
      },
    });
    if (!order) throw new NotFoundException('Order not found');

    // Group lines by station. Lines on items with no station route to a
    // synthetic "Unassigned" bucket so they don't go missing.
    type Bucket = {
      stationId: string;
      stationName: string;
      printer: KitchenReceipt['printer'];
      lines: KitchenReceiptLine[];
    };
    const buckets = new Map<string, Bucket>();
    for (const li of order.items) {
      const ks = li.item.kitchenStation;
      const key = ks?.id ?? '__unassigned__';
      if (!buckets.has(key)) {
        buckets.set(key, {
          stationId: ks?.id ?? '__unassigned__',
          stationName: ks?.name ?? 'Unassigned',
          printer: ks?.printer
            ? {
                id: ks.printer.id,
                name: ks.printer.name,
                connection: ks.printer.connection,
                address: ks.printer.address ?? null,
              }
            : null,
          lines: [],
        });
      }
      // Notes from order time may include "Add: Cheese, Pepperoni" composed
      // from the toppings — surface that separately on the ticket and keep
      // the customer-typed remainder under "notes".
      const rawNotes = li.notes ?? '';
      const parts = rawNotes.split('|').map((s) => s.trim()).filter(Boolean);
      const toppingsPart = parts.find((p) => p.toLowerCase().startsWith('add:')) ?? null;
      const restNotes = parts.filter((p) => p !== toppingsPart).join(' | ') || null;
      buckets.get(key)!.lines.push({
        itemName: li.item.name,
        variantName: li.variant?.name ?? null,
        toppings: toppingsPart ? toppingsPart.replace(/^add:\s*/i, '') : null,
        quantity: li.quantity,
        notes: restNotes,
      });
    }

    const baseHeader = {
      orderId: order.id,
      orderNumber: order.orderNumber,
      tokenNumber: order.tokenNumber ?? null,
      outletName: order.outlet.name,
      table: order.table?.number ?? null,
      section: order.section?.name ?? null,
      isParcel: order.isParcel,
      printedAt: new Date().toISOString(),
    };

    const all: KitchenReceipt[] = [];
    for (const b of buckets.values()) {
      if (opts?.stationId && b.stationId !== opts.stationId) continue;
      all.push({
        ...baseHeader,
        stationId: b.stationId,
        stationName: b.stationName,
        printer: b.printer,
        lines: b.lines,
      });
    }
    return all;
  }
}
