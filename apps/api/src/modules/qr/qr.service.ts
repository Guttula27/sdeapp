import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../config/prisma/prisma.service';
import * as QRCode from 'qrcode';
import { v4 as uuidv4 } from 'uuid';
import { QRType } from '@prisma/client';

@Injectable()
export class QrService {
  constructor(private prisma: PrismaService) {}

  // ── QR URL format ────────────────────────────────────────────
  // QRs encode a thin /s/* "scan" URL that the customer SPA + Android
  // App Link handler intercepts. The actual routing decision (cluster
  // vs standalone, auth vs guest, table-bound vs walk-in) is made on
  // the client at scan time, using a tiny resolver call against the
  // API. This keeps the QR image stable across cluster join/leave
  // and across re-deploys that change the page URLs.
  //
  // Old QRs still in the wild emitted the resolved destination URL
  // directly (/order?... or /cluster/...?...). Those still work — the
  // SPA still serves both routes — but the new format is preferred
  // because (a) it survives cluster membership changes, (b) it works
  // pre-login (the auth gate stores the intent and resumes after
  // sign-in), and (c) it triggers Android App Links cleanly.
  private scanUrl(customerUrl: string, kind: 'table' | 'outlet', id: string): string {
    const base = customerUrl.replace(/\/$/, '');
    return `${base}/s/${kind}/${id}`;
  }

  async generateTableQR(tableId: string, outletId: string, customerUrl: string) {
    const code = uuidv4();
    const url = this.scanUrl(customerUrl, 'table', tableId);
    const imageUrl = await QRCode.toDataURL(url);

    const qr = await this.prisma.qRCode.upsert({
      where: { tableId },
      create: { type: QRType.TABLE, code, imageUrl, outletId, tableId },
      update: { code, imageUrl },
    });

    return { ...qr, url };
  }

  async generateOutletQR(outletId: string, customerUrl: string) {
    const code = uuidv4();
    const url = this.scanUrl(customerUrl, 'outlet', outletId);
    const imageUrl = await QRCode.toDataURL(url);

    return this.prisma.qRCode.create({
      data: { type: QRType.OUTLET, code, imageUrl, outletId },
    });
  }

  async validateQR(code: string) {
    const qr = await this.prisma.qRCode.findUnique({
      where: { code },
      include: { outlet: true, table: true },
    });
    if (!qr || !qr.isActive) return null;
    return qr;
  }

  async getOutletQRs(outletId: string) {
    return this.prisma.qRCode.findMany({ where: { outletId }, include: { table: true } });
  }

  // ── Public resolvers used by the SPA's /s/* scan handler ─────
  // Both run unauthenticated so a customer can scan a QR before
  // signing in; the SPA persists the scan target and resumes after
  // login. Each returns the minimum the client needs to decide which
  // page to navigate to (cluster vs standalone) without leaking
  // anything sensitive.

  /** Given a table id, returns the owning outlet + cluster context. */
  async resolveTableScan(tableId: string) {
    const row = await this.prisma.table.findUnique({
      where: { id: tableId },
      select: {
        id: true,
        outletId: true,
        outlet: {
          select: {
            id: true,
            clusterMembership: {
              select: { clusterBusiness: { select: { publicCode: true } } },
            },
          },
        },
      },
    });
    if (!row) return null;
    return {
      tableId: row.id,
      outletId: row.outletId,
      clusterPublicCode: row.outlet?.clusterMembership?.clusterBusiness?.publicCode ?? null,
    };
  }

  /** Given an outlet id, returns cluster context (if any). */
  async resolveOutletScan(outletId: string) {
    const row = await this.prisma.outlet.findUnique({
      where: { id: outletId },
      select: {
        id: true,
        clusterMembership: {
          select: { clusterBusiness: { select: { publicCode: true } } },
        },
      },
    });
    if (!row) return null;
    return {
      outletId: row.id,
      clusterPublicCode: row.clusterMembership?.clusterBusiness?.publicCode ?? null,
    };
  }
}
