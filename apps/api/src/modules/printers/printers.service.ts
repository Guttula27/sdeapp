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
  async buildKitchenReceipts(
    orderId: string,
    opts?: { stationId?: string; itemId?: string },
  ): Promise<KitchenReceipt[]> {
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
                printSeparately: true,
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

    // Per-item filter short-circuit: when the caller asks for a single
    // OrderItem, build one slip with the order's token + just that line
    // and return. Used by the kitchen card's per-item print button so
    // staff can produce a token-tagged slip for any item on demand,
    // independent of the item's printSeparately flag.
    if (opts?.itemId) {
      const li = order.items.find((x) => x.id === opts.itemId);
      if (!li) return [];
      const ks = li.item.kitchenStation;
      const printer = ks?.printer
        ? {
            id: ks.printer.id,
            name: ks.printer.name,
            connection: ks.printer.connection,
            address: ks.printer.address ?? null,
          }
        : null;
      const rawNotes = li.notes ?? '';
      const parts = rawNotes.split('|').map((s) => s.trim()).filter(Boolean);
      const toppingsPart = parts.find((p) => p.toLowerCase().startsWith('add:')) ?? null;
      const restNotes = parts.filter((p) => p !== toppingsPart).join(' | ') || null;
      return [
        {
          orderId: order.id,
          orderNumber: order.orderNumber,
          tokenNumber: order.tokenNumber ?? null,
          outletName: order.outlet.name,
          table: order.table?.number ?? null,
          section: order.section?.name ?? null,
          isParcel: order.isParcel,
          printedAt: new Date().toISOString(),
          stationId: ks?.id ?? '__unassigned__',
          stationName: ks?.name ?? 'Unassigned',
          printer,
          lines: [
            {
              itemName: li.item.name,
              variantName: li.variant?.name ?? null,
              toppings: toppingsPart ? toppingsPart.replace(/^add:\s*/i, '') : null,
              quantity: li.quantity,
              notes: restNotes,
            },
          ],
        },
      ];
    }

    // Two output shapes per order item:
    //   - Item.printSeparately = false → station bucket (one combined
    //     receipt per station, current behaviour).
    //   - Item.printSeparately = true  → its own standalone receipt with
    //     the order token + just that line. Useful for items whose
    //     variant/toppings make per-line identification critical at
    //     hand-off (e.g. a coffee with custom syrups).
    type Bucket = {
      stationId: string;
      stationName: string;
      printer: KitchenReceipt['printer'];
      lines: KitchenReceiptLine[];
    };
    const buckets = new Map<string, Bucket>();
    const standalones: KitchenReceipt[] = [];

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

    const resolvePrinter = (
      ks: any,
    ): KitchenReceipt['printer'] =>
      ks?.printer
        ? {
            id: ks.printer.id,
            name: ks.printer.name,
            connection: ks.printer.connection,
            address: ks.printer.address ?? null,
          }
        : null;

    const buildLine = (li: any): KitchenReceiptLine => {
      // Notes from order time may include "Add: Cheese, Pepperoni"
      // composed from the toppings — surface that separately on the
      // ticket and keep the customer-typed remainder under "notes".
      const rawNotes = li.notes ?? '';
      const parts = rawNotes.split('|').map((s: string) => s.trim()).filter(Boolean);
      const toppingsPart = parts.find((p: string) => p.toLowerCase().startsWith('add:')) ?? null;
      const restNotes = parts.filter((p: string) => p !== toppingsPart).join(' | ') || null;
      return {
        itemName: li.item.name,
        variantName: li.variant?.name ?? null,
        toppings: toppingsPart ? toppingsPart.replace(/^add:\s*/i, '') : null,
        quantity: li.quantity,
        notes: restNotes,
      };
    };

    for (const li of order.items) {
      const ks = li.item.kitchenStation;
      const stationId = ks?.id ?? '__unassigned__';
      const stationName = ks?.name ?? 'Unassigned';
      const printer = resolvePrinter(ks);

      if (li.item.printSeparately) {
        standalones.push({
          ...baseHeader,
          stationId,
          stationName,
          printer,
          lines: [buildLine(li)],
        });
        continue;
      }

      if (!buckets.has(stationId)) {
        buckets.set(stationId, { stationId, stationName, printer, lines: [] });
      }
      buckets.get(stationId)!.lines.push(buildLine(li));
    }

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
    for (const r of standalones) {
      if (opts?.stationId && r.stationId !== opts.stationId) continue;
      all.push(r);
    }
    return all;
  }
}
