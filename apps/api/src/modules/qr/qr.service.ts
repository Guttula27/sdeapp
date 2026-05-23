import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../config/prisma/prisma.service';
import * as QRCode from 'qrcode';
import { v4 as uuidv4 } from 'uuid';
import { QRType } from '@prisma/client';

@Injectable()
export class QrService {
  constructor(private prisma: PrismaService) {}

  async generateTableQR(tableId: string, outletId: string, customerUrl: string) {
    const code = uuidv4();
    const url = `${customerUrl}/order?outlet=${outletId}&table=${tableId}&qr=${code}`;
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
    const url = `${customerUrl}/order?outlet=${outletId}&qr=${code}`;
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
