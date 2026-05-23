import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../config/prisma/prisma.service';

@Injectable()
export class CustomerAlertsService {
  constructor(private prisma: PrismaService) {}

  list(customerId: string, opts: { unreadOnly?: boolean; limit?: number } = {}) {
    return this.prisma.customerAlert.findMany({
      where: {
        customerId,
        ...(opts.unreadOnly ? { isRead: false } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: opts.limit ?? 50,
    });
  }

  unreadCount(customerId: string) {
    return this.prisma.customerAlert.count({ where: { customerId, isRead: false } });
  }

  async markRead(customerId: string, id: string) {
    return this.prisma.customerAlert.updateMany({
      where: { id, customerId },
      data: { isRead: true },
    });
  }

  async markAllRead(customerId: string) {
    return this.prisma.customerAlert.updateMany({
      where: { customerId, isRead: false },
      data: { isRead: true },
    });
  }
}
