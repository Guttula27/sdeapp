import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../config/prisma/prisma.service';
import * as QRCode from 'qrcode';
import { v4 as uuidv4 } from 'uuid';
import { QRType } from '@prisma/client';

@Injectable()
export class QrService {
  constructor(private prisma: PrismaService) {}

  // ── Cluster-aware destination resolver ──────────────────────
  // Looks up whether the outlet has an active cluster membership; when it
  // does, the QR is encoded for the cluster shell with the outlet (and
  // optional table) pre-selected. The outlet is "cluster-exclusive while
  // linked" so any QR pointing at /order would 404 the standalone flow.
  private async resolveQrDestination(
    customerUrl: string,
    outletId: string,
    tableId: string | undefined,
    qrCode: string,
  ): Promise<string> {
    const membership = await this.prisma.clusterMember.findUnique({
      where: { outletId },
      select: { clusterBusiness: { select: { publicCode: true } } },
    });
    const base = customerUrl.replace(/\/$/, '');
    if (membership?.clusterBusiness?.publicCode) {
      const params = new URLSearchParams({
        outletId,
        qr: qrCode,
        ...(tableId ? { tableId } : {}),
      });
      return `${base}/cluster/${membership.clusterBusiness.publicCode}?${params.toString()}`;
    }
    // Standalone path — original /order URL.
    const params = new URLSearchParams({
      outlet: outletId,
      qr: qrCode,
      ...(tableId ? { table: tableId } : {}),
    });
    return `${base}/order?${params.toString()}`;
  }

  async generateTableQR(tableId: string, outletId: string, customerUrl: string) {
    const code = uuidv4();
    const url = await this.resolveQrDestination(customerUrl, outletId, tableId, code);
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
    const url = await this.resolveQrDestination(customerUrl, outletId, undefined, code);
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
}
